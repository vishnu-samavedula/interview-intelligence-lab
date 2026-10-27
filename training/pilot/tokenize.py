"""Native tokenizer diagnostics only; never truncate or approve draft training labels."""
import hashlib,json,os
from collections import Counter,defaultdict
from pathlib import Path
os.environ.setdefault('HF_HOME','/tmp/interview-training-hf')
os.environ.setdefault('HF_HUB_OFFLINE','1')
HERE=Path(__file__).parent
MODEL='LiquidAI/LFM2.5-2.6B';REVISION='654f9463ce32b05d0429d76fe1f580b27d4c1ac0'
def main():
 from transformers import PreTrainedTokenizerFast
 tokenizer=PreTrainedTokenizerFast.from_pretrained(MODEL,revision=REVISION,local_files_only=True)
 run=Path(json.loads((HERE/'latest-run.json').read_text())['run_directory']);file=run/'pilot-examples.jsonl'
 rows=[json.loads(line) for line in file.read_text().splitlines()];failures=[];totals=defaultdict(lambda:Counter());tasks=defaultdict(list)
 for row in rows:
  prefix=tokenizer.apply_chat_template(row['messages'],tokenize=False,add_generation_prompt=True)
  target=json.dumps(row['target'],ensure_ascii=False,separators=(',',':'))
  prefix_ids=tokenizer.encode(prefix,add_special_tokens=False)
  ids=tokenizer.encode(prefix+target+tokenizer.eos_token,add_special_tokens=False)
  stable=ids[:len(prefix_ids)]==prefix_ids
  labels=[-100]*len(prefix_ids)+ids[len(prefix_ids):]
  assert labels[:len(prefix_ids)]==[-100]*len(prefix_ids) and all(t!=-100 for t in labels[len(prefix_ids):])
  row.update(prompt_tokens=len(prefix_ids),target_tokens=len(ids)-len(prefix_ids),total_tokens=len(ids),tokenizer_revision=REVISION,completion_only_mask_checked=True,prefix_boundary_stable=stable)
  limit=8192 if row['task']=='extraction' else 4096
  if not stable or len(ids)>limit or row['target_tokens']<=0:failures.append({'id':row['example_id'],'total_tokens':len(ids),'stable':stable,'limit':limit})
  for key in ['prompt_tokens','target_tokens']:totals[row['generator_model']][key]+=row[key]
  tasks[row['task']].append(row)
 report={'model':MODEL,'revision':REVISION,'chat_template_sha256':hashlib.sha256(tokenizer.chat_template.encode()).hexdigest(),'rows':len(rows),'failures':failures,'truncated_rows':0,'completion_only_mask_checked_rows':len(rows),'tokens_by_generator':dict(totals),'by_task':{},'native_weights_downloaded':False,'training_released':False,'note':'CPU native-tokenizer diagnostic. Draft rows retained even when over limit; release remains blocked. Not an actual optimizer exposure audit.'}
 for task,items in tasks.items():
  gen={g:{key:sum(r[key] for r in items if r['generator_model']==g)/sum(r[key] for r in items) for key in ['prompt_tokens','target_tokens']} for g in totals}
  template=Counter();root=Counter()
  for row in items:template[row['template_family']]+=row['prompt_tokens'];root[row['root_id']]+=row['prompt_tokens']
  report['by_task'][task]={'rows':len(items),'total_token_range':[min(r['total_tokens'] for r in items),max(r['total_tokens'] for r in items)],'generator_token_shares':gen,'maximum_template_input_token_share':max(template.values())/sum(template.values()),'maximum_root_input_token_share':max(root.values())/sum(root.values()),'nominal_equal_example_loss_generator_shares':{g:sum(r['generator_model']==g for r in items)/len(items) for g in totals}}
 file.write_text('\n'.join(json.dumps(r) for r in rows)+'\n');(run/'tokenization-report.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))
if __name__=='__main__':main()
