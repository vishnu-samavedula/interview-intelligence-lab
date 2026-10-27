"""Resumable OpenRouter command-line corpus pilot. Fictional data; no release or training."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path
import threading
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

HERE=Path(__file__).parent
ROOT=HERE.parent.parent
CONTRACT=json.loads((HERE/'contract.json').read_text())
FIELDS=CONTRACT['fields']; IDS=[field['id'] for field in FIELDS]
POLICY=json.loads((HERE.parent/'corpus-policy.json').read_text())
PRINT_LOCK=threading.Lock()

def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def save(path,value):
    tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n');tmp.replace(path)
def emit(value):
    with PRINT_LOCK:print(json.dumps(value),flush=True)
def load_key():
    for line in (ROOT/'.env').read_text().splitlines():
        name,sep,value=line.strip().partition('=')
        if sep and name=='OPENROUTER_API_KEY' and value.strip():return value.strip().strip('\"\x27')
    raise RuntimeError('OPENROUTER_API_KEY is missing')

def obj(properties):return {'type':'object','properties':properties,'required':list(properties),'additionalProperties':False}
def arr(items):return {'type':'array','items':items}
STRING={'type':'string'};NULLSTRING={'type':['string','null']};INTEGER={'type':'integer'}
FACT=obj({'field_id':{'type':'string','enum':IDS},'value':NULLSTRING,'spoken_at_turn':INTEGER,'will_be_spoken':{'type':'boolean'}})
LEDGER=obj({'candidate_name':STRING,'service_background':STRING,'facts':arr(FACT),'turn_outline':arr(STRING),'previously_suggested_questions':arr(STRING),'question_situation':STRING,'unspoken_facts':arr(STRING)})
TRANSCRIPT=obj({'turns':arr(obj({'turn_id':INTEGER,'interviewer':STRING,'candidate':STRING}))})
EVIDENCE=arr(obj({'turn_id':INTEGER,'quote':STRING}))
EXTRACTION=obj({'fields':arr(obj({'field_id':{'type':'string','enum':IDS},'value':NULLSTRING,'evidence':EVIDENCE}))})
QUESTION=obj({'decision':{'type':'string','enum':['ask','abstain']},'questions':arr(STRING),'category':{'type':'string','enum':list(POLICY['question_primary_outcome_shares'])},'trigger_turn_id':{'type':['integer','null']},'trigger_quote':NULLSTRING,'information_need':STRING})

def schema_check(value,schema,path='root'):
    types=schema.get('type',[]);types=[types] if isinstance(types,str) else types
    matches={'object':isinstance(value,dict),'array':isinstance(value,list),'string':isinstance(value,str),'integer':type(value) is int,'boolean':type(value) is bool,'null':value is None}
    if types and not any(matches.get(kind,False) for kind in types):raise ValueError(path+' has wrong type')
    if 'enum' in schema and value not in schema['enum']:raise ValueError(path+' has invalid enum')
    if isinstance(value,dict) and 'properties' in schema:
        props=schema['properties']
        if set(value)!=set(schema['required']):raise ValueError(path+' missing or unknown keys')
        for key,item in value.items():schema_check(item,props[key],path+'.'+key)
    if isinstance(value,list) and 'items' in schema:
        for index,item in enumerate(value):schema_check(item,schema['items'],path+f'[{index}]')

def check_ledger(payload,spec):
    outlines=payload['turn_outline']
    if not 4<=len(outlines)<=9:raise ValueError('Ledger needs 4–9 turn outlines')
    latest={}
    for fact in sorted(payload['facts'],key=lambda item:item['spoken_at_turn']):
        if fact['will_be_spoken']:
            if not 1<=fact['spoken_at_turn']<=len(outlines):raise ValueError('Spoken fact turn outside outline')
            latest[fact['field_id']]=fact['value']
    count=sum(value is not None for value in latest.values())
    density=spec['density_intent']
    if not ((density=='sparse' and count<=5) or (density=='medium' and 6<=count<=13) or (density=='dense' and count>=14)):
        raise ValueError(f'Planned {density} profile has {count} supported fields. Sparse <=5, medium 6–13, dense >=14. Mark unused facts unspoken and leave their details out of every turn outline; do not produce a full-profile interview for a sparse blueprint.')

def check_transcript(payload):
    turns=payload['turns']
    if not 4<=len(turns)<=9:raise ValueError('Need 4–9 complete exchanges')
    if [turn['turn_id'] for turn in turns]!=list(range(1,len(turns)+1)):raise ValueError('Turn IDs must be ordered and consecutive')
    if any(not turn['interviewer'].strip() or not turn['candidate'].strip() for turn in turns):raise ValueError('Empty speech')
    speech=' '.join(turn['candidate']+' '+turn['interviewer'] for turn in turns)
    if not 80<=len(speech.split())<=1200:raise ValueError('Transcript must be 80–1200 words without filler')
    if any(field in speech for field in IDS if '_' in field):raise ValueError('Annotation field IDs leaked into speech')

def check_extraction(payload,turns):
    candidates={turn['turn_id']: ' '.join(turn['candidate'].split()) for turn in turns}
    rows=payload['fields']
    if len(rows)!=len(IDS) or {item['field_id'] for item in rows}!=set(IDS):raise ValueError('Need exactly one entry for each of the 22 fields')
    for item in rows:
        field=item['field_id'];value=item['value'];evidence=item['evidence']
        if value is None:
            if evidence:raise ValueError(field+' null requires empty evidence')
        elif not value.strip() or not evidence:raise ValueError(field+' needs nonempty value and candidate evidence')
        for quote in evidence:
            if not quote['quote'].strip() or ' '.join(quote['quote'].split()) not in candidates.get(quote['turn_id'],''):raise ValueError(field+' quote is not verbatim visible candidate speech: '+json.dumps(quote)+'. Each evidence entry must be one contiguous exact source substring. Do not stitch sentences around omitted words. Use separate evidence entries for non-adjacent source sentences.')

def check_question(payload,turns,history):
    ask=payload['decision']=='ask'
    if len(payload['questions']) != int(ask):raise ValueError('Question count contradicts decision')
    if ask != payload['category'].startswith('ask_'):raise ValueError('Question category contradicts decision')
    if ask:
        question=payload['questions'][0]
        if not question.endswith('?') or '\n' in question:raise ValueError('Question must be one question ending in ?')
        if question.strip().casefold() in {q.strip().casefold() for q in history}:raise ValueError('Exact previous suggestion repeated')
        candidate=next((turn['candidate'] for turn in turns if turn['turn_id']==payload['trigger_turn_id']),'')
        quote=payload['trigger_quote']
        if not quote or ' '.join(quote.split()) not in ' '.join(candidate.split()):raise ValueError('Question premise needs verbatim candidate trigger in visible window')
    elif payload['trigger_turn_id'] is not None or payload['trigger_quote'] is not None:raise ValueError('Abstain requires null trigger')

class Client:
    def __init__(self,key):self.key=key
    def call(self,directory,stage,model,messages,schema,check=None,max_tokens=6000):
        identity=digest({'model':model,'messages':messages,'schema':schema})
        cached=directory/(stage+'.json')
        if cached.exists():
            previous=json.loads(cached.read_text())
            if previous['input_sha256']!=identity:raise RuntimeError('Cached stage input changed; start a new pilot run')
            schema_check(previous['payload'],schema)
            if check:check(previous['payload'])
            return previous['payload']
        problems=[];last_content=None
        for attempt in range(3):
            retry_messages=messages+(([{'role':'assistant','content':last_content}] if last_content else [])+[{'role':'user','content':'The previous attempt failed validation: '+problems[-1]+'. Return a corrected complete schema-valid response using only visible source speech. Fix invalid quotes using contiguous source substrings or separate evidence entries; do not alter the source transcript.'}] if problems else [])
            body={'model':model,'messages':retry_messages,'temperature':0.6 if stage in ['ledger','render'] else 0,'max_tokens':max_tokens,'stream':False,'provider':{'allow_fallbacks':False,'require_parameters':True},'response_format':{'type':'json_schema','json_schema':{'name':'pilot_'+stage.replace('-','_'),'strict':True,'schema':schema}}}
            request=urllib.request.Request('https://openrouter.ai/api/v1/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+self.key,'Content-Type':'application/json','HTTP-Referer':'https://localhost/veteran-interview-pilot','X-Title':'Veteran interview corpus pilot'})
            started=time.time();record={'stage':stage,'model_requested':model,'input_sha256':identity,'attempt':attempt+1,'request':body}
            try:
                with urllib.request.urlopen(request,timeout=150) as response:raw=json.load(response)
                record['response']=raw;record['seconds']=time.time()-started
                if raw.get('error'):raise ValueError('Provider returned an error')
                choice=raw['choices'][0]
                if choice.get('finish_reason')!='stop':raise ValueError('Incomplete generation: '+str(choice.get('finish_reason')))
                if raw.get('model')!=model:raise ValueError('Returned model differs from pinned requested model')
                last_content=choice['message']['content'];payload=json.loads(last_content);schema_check(payload,schema)
                if check:check(payload)
                record['payload']=payload;record['validation']='passed'
                save(directory/(stage+f'.attempt-{attempt+1}.json'),record);save(cached,record)
                return payload
            except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,ValueError,KeyError) as error:
                message=('HTTP '+str(error.code)+': '+error.read().decode('utf-8', errors='replace')[:3000]) if isinstance(error,urllib.error.HTTPError) else str(error)
                message=message.replace(self.key,'[REDACTED]')
                record['validation']='failed';record['error']=message
                save(directory/(stage+f'.attempt-{attempt+1}.json'),record);problems.append(message)
                if isinstance(error,urllib.error.HTTPError) and error.code in [401,402,403]:raise RuntimeError('Authentication/credit/access failure: '+message) from None
                if attempt<2:time.sleep(1+attempt)
        raise RuntimeError(stage+' failed after three attempts: '+problems[-1])

def messages(instruction,data):return [{'role':'user','content':instruction+'\n\n'+json.dumps(data,ensure_ascii=False)}]

def run_root(spec,run,client):
    directory=run/spec['root_id'];directory.mkdir(exist_ok=True)
    save(directory/'blueprint.json',spec)
    try:
        # Ledger is created before rendering. Independent annotators never see this ledger or blueprint.
        ledger=client.call(directory,'ledger',spec['generator_model'],messages('Design a wholly fictional veteran job-interview scenario. Use the blueprint as the situation, not a script to copy. Invent distinct natural names and employers. Stay within the role family and make the assigned primary risk genuinely visible. Create 4–9 turn outlines and a chronology of facts/corrections across the frozen fields, with 1-based spoken turn references. Null values can explicitly retract a prior fact. Mark deliberately unspoken facts; they must never appear in the transcript or extraction. Density sparse means <=5 supported fields, medium 6–13, dense >=14. The question intent is a design target, not a forced label. For a previously-suggested case, specify one natural recent model question about the actual work claim; otherwise history is empty. Do not copy calibration/preset stories. No real people or real contact details; use example.com and fictional 555 numbers. Use conventional US salary context where appropriate, but include explicit frequency and currency when material.',{'blueprint':spec,'fields':FIELDS}),LEDGER,lambda value:check_ledger(value,spec),max_tokens=5000)
        transcript=client.call(directory,'render',spec['generator_model'],messages('Render the ledger into a natural English recruiter/candidate interview. Use only facts marked for speech at their assigned chronological point. Leave unspoken facts out. Make service history and civilian work context clear through actual candidate speech, not an annotation. Preserve corrections and interviewer/candidate attribution. Give 4–9 complete exchanges, 80–1200 total words, without repetitive filler, JSON field IDs, annotation hints or artificial statements like I have not mentioned a degree. Vary openings, order and sentence structure. Do not include the hidden ledger, intended labels or previous model suggestions in the spoken conversation.',{'ledger':ledger,'role_family':spec['role_family'],'difficulty_intent':spec['difficulty_intent']}),TRANSCRIPT,check_transcript,max_tokens=7000)
        turns=transcript['turns'];mid=max(1,len(turns)//2);annotations={}
        for cutoff,visible in [('mid',turns[:mid]),('final',turns)]:
            prompt=messages('Independently extract all frozen fields from ONLY this visible candidate transcript prefix. Do not use interviewer assumptions as candidate facts. Latest explicit correction wins; former employer/program is not current. Unknown fields are null with []. Concise military branch and No for an explicit relocation refusal are correct; supported additional detail is allowed. In a conventional US annual-salary discussion around 90 can mean $90,000, but do not scale hourly pay or small allowances, and honor explicit uncertainty. Professional interest requires candidate speech about desired/considered work. Each non-null field needs an exact candidate quote and visible turn ID. Every quote must be a contiguous source substring; do not join non-adjacent sentences while omitting intervening words. Use multiple evidence entries if necessary. Prefer short exact source clauses that support all parts of the value. Never invent a name from email, degree/clearance from rank, reason for leaving from pay, or future interest from a past job. Return the evidence schema only, as a fields list with exactly one entry for each of the 22 frozen IDs, including unknown fields.',{'fields':FIELDS,'visible_responses':visible})
            with ThreadPoolExecutor(max_workers=2) as pair:
                jobs={name:pair.submit(client.call,directory,cutoff+'-'+name,model,prompt,EXTRACTION,lambda payload,seen=visible:check_extraction(payload,seen),6000) for name,model in [('generator',spec['generator_model']),('independent',spec['reviewer_model'])]}
                annotations[cutoff]={name:{item['field_id']:{'value':item['value'],'evidence':item['evidence']} for item in job.result()['fields']} for name,job in jobs.items()}
        snapshot=annotations['final']['generator'];window=turns[-3:];history=ledger['previously_suggested_questions'][-6:]
        question_input={'responses':window,'checklist_gaps':[field for field in FIELDS if snapshot[field['id']]['value'] is None],'recently_suggested_questions':history}
        question_prompt=messages('Independently decide whether ONE useful interview follow-up is warranted now. You see only the latest three complete exchanges and explicit recent suggestion history. Explore contribution or interests in a stated current/former role, clarify ownership or a work claim, quantify an unresolved outcome, or ask about practical value/consequential trade-offs. No generic checklist completion. Quantified technical results can still leave practical value unresolved; do not assume savings or a trade-off. Do not force numerical metrics for concrete qualitative outcomes. Do not ask for already answered information, repeat/rephrase recent suggestions, or ask about contact, salary, start date or relocation. Abstain when no timely useful question remains. Ask needs a verbatim candidate trigger quote from this visible window and its turn ID. Reference wording is illustrative; accept alternative useful information needs. No grading of the candidate. Categories must describe your actual decision, not a generation quota.\n\nCurrent approved application rubric:\n'+CONTRACT['question_rubric'],question_input)
        with ThreadPoolExecutor(max_workers=2) as pair:
            jobs={name:pair.submit(client.call,directory,'question-'+name,model,question_prompt,QUESTION,lambda payload:check_question(payload,window,history),1800) for name,model in [('generator',spec['generator_model']),('independent',spec['reviewer_model'])]}
            questions={name:job.result() for name,job in jobs.items()}
        disputes=[]
        for cutoff,versions in annotations.items():
            for field in IDS:
                a=versions['generator'][field]['value'];b=versions['independent'][field]['value']
                if a!=b:disputes.append({'cutoff':cutoff,'field_id':field,'generator':a,'independent':b,'note':'Text disagreement; may be an acceptable concise/full or paraphrase difference. Semantic review required.'})
        if questions['generator']['decision']!=questions['independent']['decision']:disputes.append({'task':'questions','generator':questions['generator'],'independent':questions['independent']})
        result={'root_id':spec['root_id'],'status':'pilot_pending_human_semantic_review','split':'pilot_review_only','scenario_group_id':spec['scenario_group_id'],'generator_model':spec['generator_model'],'independent_model':spec['reviewer_model'],'transcript':transcript,'source_sha256':digest(transcript),'live_cutoff':mid,'extraction':annotations,'question_input':question_input,'questions':questions,'disputes':disputes,'released_for_training':False,'released_for_locked_evaluation':False}
        save(directory/'result.json',result)
        emit({'root':spec['root_id'],'status':'generated_and_cross_labeled','turns':len(turns),'reference_disputes':len(disputes),'question_decisions':[q['decision'] for q in questions.values()]})
        return result
    except Exception as error:
        save(directory/'failure.json',{'root_id':spec['root_id'],'status':'quarantined_incomplete','error':str(error),'released_for_training':False})
        emit({'root':spec['root_id'],'status':'quarantined_incomplete','error':str(error)})
        return None

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--run',default='');parser.add_argument('--limit',type=int,default=50);parser.add_argument('--workers',type=int,default=4)
    args=parser.parse_args()
    if not 1<=args.limit<=50 or not 1<=args.workers<=6:raise SystemExit('Bounded pilot supports 1–50 roots and 1–6 workers')
    plan=json.loads((HERE/'plan.json').read_text())
    run=HERE/'runs'/(args.run or datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    run.mkdir(parents=True,exist_ok=True)
    identity={'plan_sha256':digest(plan),'contract_sha256':digest(CONTRACT),'policy_sha256':digest(POLICY),'target_roots':50,'generator_source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    identity_path=run/'run-config.json'
    if identity_path.exists() and json.loads(identity_path.read_text())!=identity:raise SystemExit('Run configuration changed; start a new run')
    save(identity_path,identity);save(HERE/'latest-run.json',{'run_directory':str(run),'status':'running','target_roots':50})
    client=Client(load_key());results=[]
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures=[pool.submit(run_root,spec,run,client) for spec in plan['roots'][:args.limit]]
        for future in as_completed(futures):
            value=future.result()
            if value:results.append(value)
            save(run/'progress.json',{'completed':len(results),'finished_attempts':sum(job.done() for job in futures),'requested_this_invocation':args.limit,'status':'pilot_not_released'})
    save(run/'results.json',sorted(results,key=lambda value:value['root_id']))
    save(HERE/'latest-run.json',{'run_directory':str(run),'status':'generation_finished_not_released','generated_roots':len(results),'requested_roots':args.limit})
    emit({'run_directory':str(run),'generated_roots':len(results),'requested_roots':args.limit,'training_release':False})
    if len(results)!=args.limit:raise SystemExit(1)

if __name__=='__main__':main()
