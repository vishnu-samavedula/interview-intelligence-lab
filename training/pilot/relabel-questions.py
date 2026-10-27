"""Blind question labeling with one unambiguous input and balanced 1/2/3-exchange windows."""
from concurrent.futures import ThreadPoolExecutor,as_completed
import importlib.util,json
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('pilot_generation',HERE/'generate.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
PLAN=json.loads((HERE/'plan.json').read_text())['roots']
SOURCES=[HERE/'runs/pilot-50-v3',HERE/'runs/pilot-50-recovery-v4',HERE/'runs/pilot-50-final-root-v5']
DEST=HERE/'runs/pilot-50-questions-v5';DEST.mkdir(parents=True,exist_ok=True)
# Only the instructions, never the empty example context originally used to export the rubric.
RUBRIC=m.CONTRACT['question_rubric'].split('\n\nLatest three complete exchanges, in chronological order:')[0]

def relabel(row):
 source=next((base/row['root_id']/'result.json' for base in SOURCES if (base/row['root_id']/'result.json').exists()),None)
 if not source:return None
 result=json.loads(source.read_text());directory=DEST/row['root_id'];directory.mkdir(exist_ok=True)
 turns=result['transcript']['turns'];index=int(row['root_id'].split('-')[-1])-1
 size=index%3+1
 if row['question_outcome_intent']=='abstain_previously_suggested':size=3
 cutoff=len(turns) if size==3 else size
 window=turns[:cutoff][-3:]
 if cutoff==len(turns):snapshot=result['extraction']['final']['generator'];state='primary_annotation_at_final_cutoff'
 elif cutoff==result['live_cutoff']:snapshot=result['extraction']['mid']['generator'];state='primary_annotation_at_same_visible_cutoff'
 else:snapshot={field:{'value':None} for field in m.IDS};state='controlled_empty_no_future_state'
 ledger_path=source.parent/'ledger.json'
 history=json.loads(ledger_path.read_text())['payload']['previously_suggested_questions'][-6:] if cutoff==len(turns) else []
 question_input={'responses':window,'checklist_gaps':[{'id':field['id'],'description':field['description']} for field in m.FIELDS if snapshot[field['id']]['value'] is None],'recently_suggested_questions':history}
 prompt=m.messages('Label the single supplied visible question-generation input. Do not use future turns, hidden scenario plans or a teacher answer key. Return decision, zero/one question, category, candidate trigger turn/quote and information need. Abstain uses null trigger and empty questions. An ask trigger must be a contiguous exact quote from candidate speech in this input. Categories describe actual behavior, not quotas.\n\nApproved application instructions:\n'+RUBRIC,question_input)
 try:
  client=m.Client(m.load_key())
  with ThreadPoolExecutor(max_workers=2) as pair:
   jobs={name:pair.submit(client.call,directory,'question-'+name,model,prompt,m.QUESTION,lambda payload:m.check_question(payload,window,history),1800) for name,model in [('generator',row['generator_model']),('independent',row['reviewer_model'])]}
   labels={name:job.result() for name,job in jobs.items()}
  output={'root_id':row['root_id'],'source_result':str(source),'cutoff':cutoff,'window_size':len(window),'prior_state_source':state,'snapshot':snapshot,'input':question_input,'labels':labels,'status':'pending_human_semantic_review','released_for_training':False,'note':'Supersedes initial question annotations; uses only this input, with no empty-context scaffold.'}
  m.save(directory/'result.json',output);m.emit({'question_root':row['root_id'],'window':len(window),'decisions':[label['decision'] for label in labels.values()]})
  return output
 except Exception as error:
  m.save(directory/'failure.json',{'error':str(error),'root_id':row['root_id']});m.emit({'question_root':row['root_id'],'error':str(error)});return None

if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=4) as pool:
  results=[job.result() for job in as_completed([pool.submit(relabel,row) for row in PLAN])]
 print(json.dumps({'question_roots_labeled':sum(row is not None for row in results),'total_planned':50}),flush=True)
