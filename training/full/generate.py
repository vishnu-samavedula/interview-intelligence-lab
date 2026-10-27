"""Full, resumable corpus synthesis and independent blind labels. Never certifies human gold."""
import argparse,hashlib,importlib.util,json,re
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('pilot',HERE.parent/'pilot/generate.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
CONTRACT=p.CONTRACT;FIELDS=p.FIELDS;IDS=p.IDS
Q_RUBRIC=CONTRACT['question_rubric'].split('\n\nLatest three complete exchanges, in chronological order:')[0]
HISTORY=p.obj({'after_turn':p.INTEGER,'question':p.STRING,'trigger_turn_id':p.INTEGER,'trigger_quote':p.STRING})
RENDER=p.obj({'turns':p.TRANSCRIPT['properties']['turns'],'question_cutoffs':p.arr(p.INTEGER),'history':p.arr(HISTORY)})
ANNOTATION=p.obj({'extractions':p.arr(p.obj({'cutoff':p.INTEGER,'fields':p.EXTRACTION['properties']['fields']})),'question_labels':p.arr(p.obj({'cutoff':p.INTEGER,'label':p.QUESTION}))})
INSTRUCTIONS='''Render a wholly fictional US veteran civilian-job interview using the supplied scenario. Do not copy earlier examples, stock names or the original demo transcript. The globally assigned entities are deliberate. Use a name/employer/location ONLY when its frozen field is in allowed_candidate_fields. Assigned permitted facts must all appear as candidate speech by the final response. required_fact_clauses state the exact intended relationship: tenure is CURRENT civilian tenure, interest is desired FUTURE work, and program is CURRENT work. You may paraphrase their connective language naturally, but preserve every assigned value and qualifier. Never repurpose tenure as length of a military posting or a program, or future interest as an academic subject. Do not add a forbidden field through an assumed academic credential. When degree/year are both supplied, state both clearly. Unlisted frozen fields must remain unknown: do not gratuitously state branch, degrees, titles, named technology, employer, salary, availability, interests or relocation if forbidden. Veteran context may be known to the recruiter without branch ever being stated by the candidate. Work-contribution discussion is still allowed and should be concrete.
Write 6–9 complete interviewer/candidate exchanges, consecutive IDs from 1. Every candidate answer must be a complete response, even if later split into chunks. Dates are October 2026: no contradictory calendar assumptions. Vary dialogue structure and vocabulary. Avoid filler, artificial checklist monologues and statements announcing unstated fields. Short: 170–260 total words; standard: 350–550; long: 850–1100, using substantive work context rather than repetition.
The first question cutoff is after turn 3 and the second after the final turn. The two question_intents/question_instructions are separate chronological targets; the information need can change as the meeting develops. In each recent 1/2/3-turn window specified, create its corresponding actual information need or abstention naturally. Do not include a question's answer in its visible context before that cutoff unless intended abstention. Model question history is separate, not spoken dialogue. It may contain 0–2 genuinely earlier suggestions, each grounded by an exact candidate trigger quote at or before after_turn, and after_turn <= cutoff where consumed. For previously-suggested abstention, include an equivalent earlier question about the actual candidate claim, not an imagined project. If the only visible role is a future interest, don't pretend the candidate has performed it. The final logistics answer does not erase an unresolved useful work claim in the preceding two responses.
Do not include expected answers, schema identifiers, categories, hidden plans or turn-number references in speech. Preserve all units and final fact qualifiers; corrections must actually be spoken. Never invent personal credit for a team result. Work examples should differ substantively across scenario families, not merely by names or metrics.'''
EXTRACT_RULES='''Independently extract every frozen field from each supplied visible prefix. You see candidate speech plus interviewer context, not a hidden ledger or reference answer. Return one evidence snapshot per requested cutoff, with exactly 22 fields. Unknown=null with []. Every non-null value requires contiguous exact candidate quotes and IDs; no interviewer evidence. Read all candidate corrections before labeling. Do not turn people affected into total team size, remote work into geographic relocation, last-year bonus into recurring bonus, team achievements into personal credit, or career aspirations into current experience. Military rank does not imply degrees/clearance/title. Current fields refer only to latest role. Do not infer a reason for leaving from pay. Concise supported Army/No values are valid. Preserve conditions, ranges, components, currencies and frequency. US annual salary shorthand can expand from context, never blindly scale hourly/allowances. Evidence proves source location; independently assess whether it actually supports the complete value.'''
QUESTION_RULES='''Independently label each supplied question input. Use ONLY its responses, gaps and history. Read the whole visible window: a final logistics response does not by itself erase earlier useful unresolved work/role content. Conversely do not force a question after every response. Suppress semantically equivalent recent questions even with different wording. Do not invent current work from a future aspiration or assume benefit/trade-off. A quantified technical result may leave practical value or personal ownership unresolved. No generic tools/methodology/checklist questions or user-facing turn IDs. Label actual need, not an intended quota. Return zero/one question, decision, category, short information need and an exact candidate trigger quote if asking. Abstain requires null trigger.\nApproved app rubric:\n'''+Q_RUBRIC

def validate_render(data,row):
 p.check_transcript({'turns':data['turns']})
 if len(data['turns'])<6:raise ValueError('Need at least six complete exchanges')
 if data['question_cutoffs']!=[3,len(data['turns'])]:raise ValueError('Question cutoffs must be [3, final turn]')
 candidates={t['turn_id']:t['candidate'] for t in data['turns']}
 for h in data['history']:
  if not 1<=h['trigger_turn_id']<=h['after_turn']<=len(data['turns']):raise ValueError('History must be grounded before it exists')
  if h['trigger_quote'] not in candidates[h['trigger_turn_id']]:raise ValueError('History trigger must quote actual candidate speech')
  if not h['question'].endswith('?') or re.search(r'\bturn\s+\d',h['question'],re.I):raise ValueError('Invalid user-facing history question')
 for field in ['full_name','current_employer','location']:
  if field in row['allowed_candidate_fields'] and row['allowed_candidate_fields'][field] not in ' '.join(candidates.values()):raise ValueError('Assigned '+field+' was omitted or changed')
 if row['question_intents'][0]=='abstain_previously_suggested' and not any(h['after_turn']<=3 for h in data['history']):raise ValueError('Need grounded suggestion history at first cutoff')

def inputs(render,row):
 turns=render['turns'];first=render['profile_exchange_count'] if int(row['root_id'][-4:])%2 else render['question_cutoffs'][0];ex_cutoffs=[first,len(turns)]
 qinputs=[]
 for index,cutoff in enumerate(render['question_cutoffs']):
  window=turns[:cutoff][-row['question_window_sizes'][index]:]
  history=[h['question'] for h in render['history'] if h['after_turn']<=cutoff][-6:]
  # Fixed empty gap-state is intentionally controlled, not a future annotation snapshot.
  qinputs.append({'cutoff':cutoff,'responses':window,'checklist_gaps':[{'id':f['id'],'description':f['description']} for f in FIELDS],'recently_suggested_questions':history})
 return ex_cutoffs,qinputs

def validate_labels(data,render,row):
 cuts,qinputs=inputs(render,row)
 if [x['cutoff'] for x in data['extractions']]!=cuts:raise ValueError('Wrong extraction cutoffs')
 if [x['cutoff'] for x in data['question_labels']]!=render['question_cutoffs']:raise ValueError('Wrong question cutoffs')
 for x in data['extractions']:p.check_extraction({'fields':x['fields']},render['turns'][:x['cutoff']])
 for x,q in zip(data['question_labels'],qinputs):
  p.check_question(x['label'],q['responses'],q['recently_suggested_questions'])
  if any(re.search(r'\bturn\s+\d',s,re.I) for s in x['label']['questions']):raise ValueError('No user-facing transcript turn numbers')

def run_root(row,run):
 d=run/row['root_id'];d.mkdir(parents=True,exist_ok=True)
 if (d/'result.json').exists():return json.loads((d/'result.json').read_text())
 client=p.Client(p.load_key());p.save(d/'blueprint.json',row)
 try:
  import narrative
  render=narrative.make_render(p,client,d,row)
  cuts,qinputs=inputs(render,row)
  # Each cutoff and task gets a separate request. No future turns or wider extraction
  # context can leak into an early extraction or a question-only window.
  labels={who:{'extractions':[],'question_labels':[]} for who in ['generator','independent']}
  def annotate(who,model,task,index):
   if task=='extraction':
    cutoff=cuts[index];visible=render['turns'][:cutoff]
    prompt=p.messages(EXTRACT_RULES,{'fields':FIELDS,'visible_responses':visible})
    value=client.call(d,f'extraction-{index}-{who}',model,prompt,p.EXTRACTION,lambda x:p.check_extraction(x,visible),6000)
    return who,task,index,{'cutoff':cutoff,'fields':value['fields']}
   q=qinputs[index]
   value=client.call(d,f'question-{index}-{who}',model,p.messages(QUESTION_RULES+'\nFINAL PRIORITY: assess ALL supplied responses, not only the newest. A logistics response does not cancel an unresolved grounded role, contribution, result or value question in the preceding visible responses. Do not repeat a semantically equivalent history question. A vague outcome asks quantification; a numeric result with unclear practical benefit asks value. Read candidate aspiration as future intent, not evidence of current experience.',q),p.QUESTION,lambda x:p.check_question(x,q['responses'],q['recently_suggested_questions']),1800)
   if any(re.search(r'\bturn\s+\d',t,re.I) for t in value['questions']):raise ValueError('No turn IDs in user-facing questions')
   return who,task,index,{'cutoff':q['cutoff'],'label':value}
  with ThreadPoolExecutor(max_workers=8) as pair:
   jobs=[pair.submit(annotate,who,model,task,index) for who,model in [('generator',row['generator_model']),('independent',row['reviewer_model'])] for task in ['extraction','questions'] for index in range(2)]
   collected=[job.result() for job in jobs]
  for who,task,index,value in sorted(collected,key=lambda item:item[2]):labels[who]['extractions' if task=='extraction' else 'question_labels'].append(value)
  disputes=[]
  for index,c in enumerate(cuts):
   a={v['field_id']:v for v in labels['generator']['extractions'][index]['fields']};b={v['field_id']:v for v in labels['independent']['extractions'][index]['fields']}
   for field in IDS:
    if a[field]['value']!=b[field]['value']:disputes.append({'task':'extraction','cutoff':c,'field':field,'a':a[field]['value'],'b':b[field]['value']})
  for index,q in enumerate(qinputs):
   a=labels['generator']['question_labels'][index]['label'];b=labels['independent']['question_labels'][index]['label']
   if a['decision']!=b['decision'] or a['category']!=b['category']:disputes.append({'task':'questions','cutoff':q['cutoff'],'a':a,'b':b})
  final={v['field_id']:v['value'] for v in labels['generator']['extractions'][-1]['fields']}
  forbidden=[f for f in row['forbidden_fields'] if final[f] is not None]
  omitted=[f for f in row['allowed_candidate_fields'] if final[f] is None]
  intent_drift=[{'cutoff':q['cutoff'],'observed':q['label']['category'],'intended':row['question_intents'][i]} for i,q in enumerate(labels['generator']['question_labels']) if q['label']['category']!=row['question_intents'][i]]
  result={'root_id':row['root_id'],'blueprint':row,'render':render,'labels':labels,'question_inputs':qinputs,'disputes':disputes,'support_drift':{'extra':forbidden,'missing':omitted},'question_intent_drift':intent_drift,'status':'generated_pending_semantic_review','released_for_training':False,'released_for_locked_evaluation':False}
  p.save(d/'result.json',result);p.emit({'root':row['root_id'],'status':'generated','disputes':len(disputes),'support_drift':len(forbidden)+len(omitted),'question_drift':len(intent_drift)});return result
 except Exception as error:
  p.save(d/'failure.json',{'root_id':row['root_id'],'error':str(error),'released_for_training':False});p.emit({'root':row['root_id'],'error':str(error)});return None

def main():
 args=argparse.ArgumentParser();args.add_argument('--run',default='full-v1');args.add_argument('--limit',type=int,default=750);args.add_argument('--workers',type=int,default=12);args.add_argument('--ids',default='');a=args.parse_args()
 plan=json.loads((HERE/'plan.json').read_text());rows=plan['roots'];run=HERE/'runs'/a.run;run.mkdir(parents=True,exist_ok=True)
 identity={'plan_sha256':p.digest(plan),'source_sha256':hashlib.sha256(Path(__file__).read_bytes()+(HERE/'narrative.py').read_bytes()+(HERE/'phrasebank.json').read_bytes()).hexdigest(),'contract_sha256':p.digest(CONTRACT),'policy_sha256':p.digest(p.POLICY)}
 if (run/'config.json').exists() and json.loads((run/'config.json').read_text())!=identity:raise ValueError('Configuration changed: use a new run directory')
 p.save(run/'config.json',identity)
 if a.ids:rows=[r for r in rows if r['root_id'] in a.ids.split(',')]
 rows=rows[:a.limit]
 with ThreadPoolExecutor(max_workers=a.workers) as pool:
  results=[j.result() for j in as_completed([pool.submit(run_root,r,run) for r in rows])]
 p.save(run/'progress.json',{'requested':len(rows),'completed':sum(r is not None for r in results),'released_for_training':False});p.emit({'requested':len(rows),'completed':sum(r is not None for r in results)})
if __name__=='__main__':main()
