"""Native-template length/mask check and frozen training snapshot for the focused demo."""
import argparse,hashlib,json,os
from collections import Counter,defaultdict
from pathlib import Path
os.environ.setdefault('HF_HOME','/tmp/interview-training-hf');os.environ.setdefault('HF_HUB_OFFLINE','1')
MODEL='LiquidAI/LFM2.5-2.6B';REVISION='654f9463ce32b05d0429d76fe1f580b27d4c1ac0'
def main():
 from transformers import PreTrainedTokenizerFast
 parser=argparse.ArgumentParser();parser.add_argument('file');parser.add_argument('--freeze',action='store_true');a=parser.parse_args();file=Path(a.file)
 tok=PreTrainedTokenizerFast.from_pretrained(MODEL,revision=REVISION,local_files_only=True);rows=[json.loads(l) for l in file.read_text().splitlines()];bad=[];groups=defaultdict(list)
 for r in rows:
  prefix=tok.apply_chat_template(r['messages'],tokenize=False,add_generation_prompt=True);before=tok.encode(prefix,add_special_tokens=False);after=tok.encode(prefix+json.dumps(r['target'],separators=(',',':'),ensure_ascii=False)+tok.eos_token,add_special_tokens=False)
  if after[:len(before)]!=before or len(after)>(8192 if r['task']=='extraction' else 4096):bad.append({'id':r['id'],'tokens':len(after)})
  r.update(prompt_tokens=len(before),target_tokens=len(after)-len(before),tokenizer_revision=REVISION,completion_only_mask_checked=True);groups[r['split']+'/'+r['task']].append(r)
 if bad:raise ValueError('No truncation; overlength/boundary failures: '+json.dumps(bad))
 report={'model':MODEL,'revision':REVISION,'chat_template_sha256':hashlib.sha256(tok.chat_template.encode()).hexdigest(),'rows':len(rows),'boundary_and_length_failures':bad,'partitions':{},'experimental_not_production':True}
 for key,items in groups.items():
  report['partitions'][key]={'rows':len(items),'roots':len({r['root_id'] for r in items}),'token_range':[min(r['prompt_tokens']+r['target_tokens'] for r in items),max(r['prompt_tokens']+r['target_tokens'] for r in items)],'generator_rows':dict(Counter(r['generator_model'] for r in items)),'question_counts':dict(Counter(len(r['target']['questions']) for r in items)) if items[0]['task']=='questions' else None}
 file.write_text('\n'.join(json.dumps(r) for r in rows)+'\n');file.with_name('tokenization.json').write_text(json.dumps(report,indent=2)+'\n')
 if a.freeze:
  training=[r for r in rows if r['split'] in ['train','dev']];dest=file.with_name('training-frozen.jsonl')
  if dest.exists():raise ValueError('Training snapshot exists; never overwrite a launched experiment')
  dest.write_text('\n'.join(json.dumps(r) for r in training)+'\n');print('Frozen training input:',dest)
 print(json.dumps(report,indent=2))
if __name__=='__main__':main()
