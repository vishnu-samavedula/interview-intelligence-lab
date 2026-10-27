"""Preserve original failures; resume cached successful stages with bounded provider concurrency."""
import importlib.util,json,shutil,threading
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('demo',HERE/'generate.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.Q_PROMPT=(HERE/'question-instructions.txt').read_text();m.SLOTS=threading.BoundedSemaphore(3)
Original=m.Client
class Recovery(Original):
 def call(self,d,stage,model,messages,schema,check=None,max_tokens=6000):
  if not (d/(stage+'.json')).exists() and stage.startswith('extract'):
   messages=messages+[{'role':'user','content':'For evidence, copy the entire actual candidate response verbatim if you cannot reliably copy a shorter span. Do not expand contractions (I am is not the same exact text as I’m), change punctuation, join separated clauses or substitute wording. Quote only source text. Distinguish interview scheduling from JOB START availability; locality/relocation assistance from willingness to MOVE; generic civilian responsibilities from stated MILITARY service.'}]
  return super().call(d,stage,model,messages,schema,check,max_tokens)
m.Client=Recovery
if __name__=='__main__':
 import argparse
 a=argparse.ArgumentParser();a.add_argument('--round',default='2');args=a.parse_args()
 source=HERE/'runs/demo-v1';dest=HERE/('runs/demo-recovery-v'+args.round);dest.mkdir(parents=True,exist_ok=True)
 plan=json.loads((HERE/'plan.json').read_text())['roots'];missing=[]
 for row in plan:
  if (source/row['root_id']/'result.json').exists():continue
  target=dest/row['root_id'];target.mkdir(exist_ok=True)
  for f in (source/row['root_id']).glob('*.json'):
   if '.attempt-' not in f.name and f.name not in ['failure.json','result.json'] and not (target/f.name).exists():shutil.copy2(f,target/f.name)
  missing.append(row)
 with ThreadPoolExecutor(max_workers=2) as pool:results=[f.result() for f in as_completed([pool.submit(m.run_root,r,dest) for r in missing])]
 print(json.dumps({'recoveries':sum(r is not None for r in results),'requested':len(missing),'directory':str(dest)}))
