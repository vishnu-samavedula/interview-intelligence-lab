"""Keep factual claims explicit while teachers vary substantive interview narratives."""
import hashlib,json,random,re
from pathlib import Path
HERE=Path(__file__).parent

def make_render(p,client,d,row):
 bank=json.loads((HERE/'phrasebank.json').read_text())['fields']
 rng=random.Random(int(row['root_id'][-4:])*7717)
 clauses={field:rng.choice(bank[field][row['split']]).replace('{value}',value) for field,value in row['allowed_candidate_fields'].items()}
 fields=list(clauses);rng.shuffle(fields)
 nprofile=1+int(row['root_id'][-4:])%3
 groups=[fields[i::nprofile] for i in range(nprofile)]
 old_field=None;old_value=None
 if row['primary_risk']=='corrections_and_retractions':
  options=[f for f in ['current_employer','current_title','email','availability','target_salary','tenure','current_program','location'] if f in clauses]
  if options:
   old_field=rng.choice(options)
   value=row['allowed_candidate_fields'][old_field]
   old_value={'current_employer':'Former '+row['internal_entities']['employer'],'current_title':'Interim Coordinator','email':'old.contact@example.com','availability':'12 weeks notice','target_salary':'$82,000 annual base','tenure':'six months','current_program':'Earlier Readiness Effort','location':'Akron, Ohio'}[old_field]
   clauses[old_field]=clauses[old_field].replace(value,old_value)
 profiles=[]
 for group in groups:
  profiles.append({'interviewer':rng.choice(['Could you confirm the relevant parts of your current situation and background?','Before we discuss your work example, what background details should I record?','Let us check your current details and qualifications.']), 'candidate':' '.join(clauses[f] for f in group)})
 correction=''
 if old_field:
  correction='I need to correct something I said earlier. '+rng.choice(bank[old_field][row['split']]).replace('{value}',row['allowed_candidate_fields'][old_field])
 elif row['primary_risk']=='current_vs_historical':
  correction='Before this civilian job I worked for a different organization. That earlier employer and its projects are not my current assignment.'
 elif row['primary_risk']=='multiple_entities_and_speakers':
  correction='The larger result belonged to the team. I would not take personal credit for every part of it.'
 elif row['primary_risk']=='evidence_and_ambiguity' and 'security_clearance' in row['forbidden_fields']:
  correction='I am not providing a security clearance level here. Please do not assume one from the work context.'
 else:
  correction=rng.choice(['Those are my current details. I would distinguish that background from the particular work example we are discussing.','Yes, that background is accurate. For the next example, I will separate my own contribution from the wider team’s work.','That captures my situation. I can talk through a different aspect of the work if useful.'])
 schema=p.obj({'early':p.TRANSCRIPT,'late':p.TRANSCRIPT,'history':p.arr(p.obj({'after_turn':p.INTEGER,'question':p.STRING,'trigger_turn_id':p.INTEGER,'trigger_quote':p.STRING}))})
 instructions='''Write two distinct but related substantive episodes from a fictional civilian job interview with a US veteran. Return exactly THREE complete interviewer/candidate exchanges per episode. early IDs 1,2,3; late IDs 4,5,6. Each episode's final answer is its question-generation cutoff. Use the stage instruction and its window_size to place the relevant claim/resolution in the actually visible LAST one/two/three responses. A one-response window must carry the necessary context inside that answer. Do not copy the wording of the instructions or any stock tracking-filter example.
This task is about work/intent narrative, NOT inventing biography. Explicit profile facts will be inserted separately. Do not state a name, employer name, formal job title, program name, degree/year, tenure, team headcount, service branch/rank, clearance, salary, phone/email, notice, relocation or future career interest. Refer to actual duties and a work situation, without a formal title. If a named technology is not in permitted_tools, do not introduce any named tools/software/frameworks or generic tooling as a biographical skill claim. Never invent a desired future specialty; role exploration can concern past/current responsibilities. All supplied profile facts remain unchanged.
Write a concrete, distinct work story about the given situation and role family. The scene constraints are substantive: vary the event, causal mechanism, contribution, limitations and observed outcome. No empty corporate filler. When the stage asks, leave precisely that useful information need unresolved; later turns in the OTHER episode can resolve it. When complete/answered abstention is intended, ensure contribution, result and practical value are genuinely clear IN THAT VISIBLE WINDOW. A number alone is insufficient. Do not introduce a new vague work claim after resolving the example. For logistics abstention, every response in that episode's visible window is a neutral administrative/closing exchange, containing no new personal checklist facts; do not sneak in a work/interest claim.
History contains only plausible earlier AI-suggested work questions, never spoken interviewer lines or admin/methodology questions. Include history ONLY for a previously_suggested stage. It must ask about the SAME remaining information need in that stage, have an exact candidate trigger quote and an after_turn at or before its consumed cutoff. No imagined projects or accomplishments in history. Suggestion history may be generated immediately after a response and presented to the next invocation at the same transcript cutoff.
Stay natural and do not mention labels, field keys, quotas, prompts or turn IDs in speech. Each candidate answer is complete; do not end on a fragment.'''
 stages=[]
 for i,cat in enumerate(row['question_intents']):
  guide=row['question_instructions'][i].replace('At both designated question cutoffs','At this cutoff').replace('At both question cutoffs','At this cutoff').replace('At both cutoffs','At this cutoff').replace('At each cutoff','At this cutoff')
  stages.append({'episode':'early' if i==0 else 'late','category':cat,'window_size':row['question_window_sizes'][i],'guide':guide})
 tokens={'short':'120–180 total words across both episodes','standard':'250–400 total words across both episodes','long':'650–850 total words across both episodes'}[row['length_intent']]
 data={'role_family':row['role_family'],'work_situation':row['work_situation'],'dialogue_style':row['dialogue_structure'],'stages':stages,'length':tokens,'permitted_tools':row['allowed_candidate_fields'].get('key_technologies','NONE; describe the work without naming tools'),'scenario_variant':row['variant'],'difficulty':row['difficulty']}
 def check(value):
  for key,ids in [('early',[1,2,3]),('late',[4,5,6])]:
   if [t['turn_id'] for t in value[key]['turns']]!=ids:raise ValueError('Each episode must have exactly three exchanges with specified IDs')
  turns=value['early']['turns']+value['late']['turns'];byid={t['turn_id']:t['candidate'] for t in turns}
  for h in value['history']:
   if not 1<=h['trigger_turn_id']<=h['after_turn']<=6 or h['trigger_quote'] not in byid[h['trigger_turn_id']]:raise ValueError('History must be grounded in already spoken candidate text')
   if not h['question'].endswith('?'):raise ValueError('History must be a question')
  for i,cat in enumerate(row['question_intents']):
   if cat=='abstain_previously_suggested' and not any(h['after_turn']<=3*(i+1) for h in value['history']):raise ValueError('Missing prior suggestion for suppression case')
  speech=' '.join(t['candidate'] for t in turns)
  if any(f in speech for f in p.IDS if '_' in f):raise ValueError('No annotation IDs in speech')
 work=client.call(d,'render',row['generator_model'],p.messages(instructions,data),schema,check,6000)
 turns=[]
 def append(t):turns.append({'turn_id':len(turns)+1,'interviewer':t['interviewer'],'candidate':t['candidate']})
 for t in profiles:append(t)
 mapping={}
 for t in work['early']['turns']:append(t);mapping[t['turn_id']]=len(turns)
 first_cut=len(turns)
 append({'interviewer':'Is there any correction or distinction we should make before continuing?','candidate':correction})
 for t in work['late']['turns']:append(t);mapping[t['turn_id']]=len(turns)
 history=[{**h,'after_turn':mapping[h['after_turn']],'trigger_turn_id':mapping[h['trigger_turn_id']]} for h in work['history']]
 result={'turns':turns,'question_cutoffs':[first_cut,len(turns)],'history':history,'profile_exchange_count':nprofile,'factual_assembly':'Preassigned fictional facts in reviewed split-specific paraphrases; model-generated work episodes. No teacher labels edited.'}
 p.save(d/'assembled-render.json',result)
 return result
