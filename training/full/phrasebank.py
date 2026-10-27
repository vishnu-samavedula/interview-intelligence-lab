"""Generate candidate-grounded field paraphrases once, for explicit review before use."""
import importlib.util,json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('pilot',HERE.parent/'pilot/generate.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
SCHEMA=p.obj({'fields':p.arr(p.obj({'field_id':{'type':'string','enum':p.IDS},'phrases':p.arr(p.STRING)}))})
def check(data):
 if {f['field_id'] for f in data['fields']}!=set(p.IDS) or len(data['fields'])!=22:raise ValueError('Need each field exactly once')
 for row in data['fields']:
  if len(row['phrases'])!=12:raise ValueError('Need 12 varied candidate phrases per field')
  for phrase in row['phrases']:
   if phrase.count('{value}')!=1:raise ValueError('Each phrase needs the exact {value} placeholder once')
   if '{' in phrase.replace('{value}','') or '}' in phrase.replace('{value}',''):raise ValueError('Unknown placeholder')
def run(model,index):
 d=HERE/'runs/phrasebank-v1'/str(index);d.mkdir(parents=True,exist_ok=True)
 prompt=p.messages('Create 12 semantically equivalent natural first-person candidate utterance patterns for EACH frozen extraction field. Use the literal placeholder {value} once per phrase. Each utterance must explicitly establish ONLY its intended field with unambiguous present/past/future status. Current employer/title/program/tenure refer to the CURRENT civilian job. Future work interest must be explicitly desired NEXT work, not a past duty. Salary components and units will be substituted intact. Do not assume USD or annual if the value might be hourly. Relocation value can be No, a condition, or a geography, so use a neutral lead-in that preserves its polarity. Degree year must specify bachelor vs master. Military service value is a branch, not a current civilian employer. Vary syntax and vocabulary; avoid machine labels or unnatural annotation language. Do not use interviewer speech or add a second unspecified fact. This is fictional pattern generation; patterns will be reviewed before corpus use.',{'fields':p.FIELDS})
 return {'model':model,'payload':p.Client(p.load_key()).call(d,'phrases',model,prompt,SCHEMA,check,7500)}
if __name__=='__main__':
 models=list(p.POLICY['training_generator_shares'])
 with ThreadPoolExecutor(max_workers=2) as pool:results=[f.result() for f in [pool.submit(run,m,i) for i,m in enumerate(models)]]
 p.save(HERE/'phrasebank-draft.json',{'status':'pending_semantic_review','sources':results});print('Wrote 528 draft phrases; not released.')
