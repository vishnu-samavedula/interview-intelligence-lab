"""Blinded, subjective paired teacher ratings; not objective correctness or human gold."""
import argparse,hashlib,importlib.util,json,random
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('pilot',HERE.parent/'pilot/generate.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
SCORE=p.obj({'grounding':p.INTEGER,'relevance':p.INTEGER,'distinctness':p.INTEGER,'already_answered_count':p.INTEGER,'invented_premise_count':p.INTEGER,'notes':p.STRING})
SCHEMA=p.obj({'A':SCORE,'B':SCORE,'preference':{'type':'string','enum':['A','B','tie']},'reason':p.STRING})
PROMPT='''Compare two ranked clarifying-question lists for a veteran job interview, using ONLY the visible recent exchanges and recent suggestion history. The lists are blinded: do not assume a model identity or that a reference wording is uniquely correct. Judge each list's displayed top three, not whether it matches your favorite question. Multiple questions about distinct information needs may all be useful. Empty is appropriate when nothing useful remains.
Questions may explore actual responsibilities, personal contribution, professional interests, the meaning or size of a result, practical value to the team or a consequential trade-off. A technical metric alone may leave value unresolved. Avoid assuming savings/trade-offs or past performance from a future aspiration. A final logistical turn does not erase earlier visible useful work content. Penalize unsupported premises, already answered information, repetitions/semantic paraphrases of recent suggestions and irrelevant generic curiosity. Do not reward asking more questions merely for count.
Give grounding/relevance/distinctness each a 0–5 rating, count already-answered and invented-premise questions, and short concrete notes. Prefer the more useful, grounded set or tie when both are reasonable. This is a subjective comparative review, not a factual truth label.'''
def check(x):
 for name in ['A','B']:
  for k in ['grounding','relevance','distinctness']:
   if not 0<=x[name][k]<=5:raise ValueError('Rating outside 0–5')
def judge(root,model,out):
 base=json.loads(root.read_text());adapt=json.loads(root.with_name(root.name.replace('-base.json','-trained.json')).read_text())
 swap=random.Random(base['id']).choice([False,True]);mapping={'A':'trained' if swap else 'base','B':'base' if swap else 'trained'}
 lists={name:(adapt if profile=='trained' else base).get('displayed',[]) for name,profile in mapping.items()}
 # The student prompt contains the exact recent window. Extract it from the frozen dataset
 # rather than supplying the entire interview and accidentally grading hidden history.
 row=ROWS[base['id']];text=row['messages'][0]['content'];context=json.loads(text.split('Latest complete exchanges, in chronological order:\n',1)[1])
 d=out/base['id']/model.split('/')[-1];d.mkdir(parents=True,exist_ok=True)
 value=p.Client(p.load_key()).call(d,'blinded-review',model,p.messages(PROMPT,{'context':context,'A':lists['A'],'B':lists['B']}),SCHEMA,check,1500)
 record={'id':base['id'],'judge':model,'mapping':mapping,'ratings':value,'preference':mapping[value['preference']] if value['preference']!='tie' else 'tie','subjective':True}
 p.save(d/'result.json',record);return record
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('evaluation');a.add_argument('dataset');args=a.parse_args();run=Path(args.evaluation);out=run/'question-judges';ROWS={r['id']:r for r in [json.loads(l) for l in Path(args.dataset).read_text().splitlines()]};pairs=[]
 for file in run.glob('*-base.json'):
  r=json.loads(file.read_text());other=file.with_name(file.name.replace('-base.json','-trained.json'))
  if r['task']=='questions' and other.exists():pairs.append(file)
 models=list(p.POLICY['training_generator_shares'])
 with ThreadPoolExecutor(max_workers=4) as pool:results=[f.result() for f in as_completed([pool.submit(judge,file,model,out) for file in pairs for model in models])]
 from collections import Counter
 summary={'paired_batches':len(pairs),'ratings':len(results),'preferences':dict(Counter(r['preference'] for r in results)),'subjective_machine_review_not_human_gold':True,'scores':{}}
 for profile in ['base','trained']:
  ratings=[r['ratings'][name] for r in results for name,m in r['mapping'].items() if m==profile]
  summary['scores'][profile]={k:sum(r[k] for r in ratings)/max(1,len(ratings)) for k in ['grounding','relevance','distinctness','already_answered_count','invented_premise_count']}
 p.save(run/'question-quality.json',summary);print(json.dumps(summary,indent=2))
