"""Experimental task LoRAs. Whole-example completion loss; dev chooses checkpoint, test untouched."""
import hashlib,json,math,random,runpy
from pathlib import Path
MODEL='LiquidAI/LFM2.5-2.6B';REVISION='654f9463ce32b05d0429d76fe1f580b27d4c1ac0'
def train(root,records):
 import torch
 import torch.nn.functional as F
 from peft import LoraConfig,get_peft_model,PeftModel
 from transformers import AutoModelForCausalLM,PreTrainedTokenizerFast
 torch.set_num_threads(8);torch.manual_seed(26);random.seed(26)
 root=Path(root);root.mkdir(parents=True,exist_ok=False)
 tokenizer=PreTrainedTokenizerFast.from_pretrained(MODEL,revision=REVISION)
 encoded={}
 for r in records:
  prefix=tokenizer.apply_chat_template(r['messages'],tokenize=False,add_generation_prompt=True);before=tokenizer.encode(prefix,add_special_tokens=False)
  ids=tokenizer.encode(prefix+json.dumps(r['target'],ensure_ascii=False,separators=(',',':'))+tokenizer.eos_token,add_special_tokens=False)
  if ids[:len(before)]!=before or len(ids)>(8192 if r['task']=='extraction' else 4096):raise ValueError('Template boundary/length failed '+r['id'])
  encoded[r['id']]={'ids':ids,'labels':[-100]*len(before)+ids[len(before):]}
 model=AutoModelForCausalLM.from_pretrained(MODEL,revision=REVISION,torch_dtype=torch.bfloat16,attn_implementation='eager',device_map={'':0},trust_remote_code=False);model.config.use_cache=False
 modules=[name for name,m in model.named_modules() if isinstance(m,torch.nn.Linear) and '.self_attn.' in name and name.rsplit('.',1)[-1] in {'q_proj','k_proj','v_proj','out_proj'}]
 frozen={n:v._version for n,v in model.named_parameters()}
 report={'model':MODEL,'revision':REVISION,'purpose':'focused_experimental_demo_not_production','train_roots':len({r['root_id'] for r in records if r['split']=='train'}),'tasks':{},'loss':'mean assistant token loss per example, equal coefficient across effective batch','target_modules':modules}
 schedule={}
 def loss(m,r):
  e=encoded[r['id']];ids=torch.tensor([e['ids']],device='cuda');labels=torch.tensor([e['labels']],device='cuda')
  out=m(input_ids=ids,use_cache=False).logits[:,:-1].float()
  return F.cross_entropy(out.reshape(-1,out.shape[-1]),labels[:,1:].reshape(-1),ignore_index=-100,reduction='mean')
 def evaluate(m,items):
  m.eval()
  with torch.no_grad():value=sum(float(loss(m,r)) for r in items)/len(items)
  return value
 for task,epochs in [('extraction',3),('questions',5)]:
  train_rows=[r for r in records if r['split']=='train' and r['task']==task];dev=[r for r in records if r['split']=='dev' and r['task']==task]
  assert train_rows and dev
  assert not ({r['scenario_group_id'] for r in train_rows}&{r['scenario_group_id'] for r in records if r['split']!='train'})
  m=get_peft_model(model,LoraConfig(r=16,lora_alpha=32,lora_dropout=.05,target_modules=modules,task_type='CAUSAL_LM'))
  m.gradient_checkpointing_enable(gradient_checkpointing_kwargs={'use_reentrant':False});m.enable_input_require_grads()
  params=[v for n,v in m.named_parameters() if v.requires_grad];assert params and all('lora_' in n for n,v in m.named_parameters() if v.requires_grad)
  optimizer=torch.optim.AdamW(params,lr=1e-4,weight_decay=.01);base_dev=evaluate(m,dev);best=base_dev;history=[];best_epoch=0;schedule[task]=[]
  for epoch in range(epochs):
   order=list(train_rows);random.Random(2600+epoch).shuffle(order);m.train();running=0.;batches=math.ceil(len(order)/4)
   schedule[task].append([r['id'] for r in order])
   for batch_index in range(batches):
    batch=order[batch_index*4:(batch_index+1)*4];optimizer.zero_grad(set_to_none=True)
    # Normalize across the WHOLE effective batch, not each microbatch separately.
    for r in batch:
     value=loss(m,r)
     if not torch.isfinite(value):raise ValueError('Nonfinite training loss')
     running+=float(value.detach());(value/len(batch)).backward()
    grad=float(torch.nn.utils.clip_grad_norm_(params,1.0));assert math.isfinite(grad)
    optimizer.step()
    if batch_index%20==0:print(json.dumps({'task':task,'epoch':epoch+1,'batch':batch_index,'batches':batches,'mean_loss':running/max(1,(batch_index+1)*4)}),flush=True)
   dev_loss=evaluate(m,dev);entry={'epoch':epoch+1,'train_loss':running/len(order),'dev_loss':dev_loss};history.append(entry);print(json.dumps({'task':task,**entry}),flush=True)
   checkpoint=root/(task+'-last');m.save_pretrained(checkpoint)
   torch.save({'optimizer':optimizer.state_dict(),'epoch':epoch+1,'rng':torch.get_rng_state(),'cuda_rng':torch.cuda.get_rng_state_all()},checkpoint/'optimizer.pt')
   if dev_loss<best or best_epoch==0:
    best=dev_loss;best_epoch=epoch+1;m.save_pretrained(root/task)
   (root/'progress.json').write_text(json.dumps({'task':task,'epochs':history},indent=2))
  model=m.unload();assert all(v._version==frozen[n] for n,v in model.named_parameters()),'Base weights changed'
  reloaded=PeftModel.from_pretrained(model,root/task,is_trainable=False);reload_dev=evaluate(reloaded,dev);assert abs(reload_dev-best)<1e-4
  model=reloaded.unload()
  report['tasks'][task]={'epochs':history,'base_dev_loss':base_dev,'best_dev_loss':best,'best_epoch':best_epoch,'reload_dev_loss':reload_dev,'train_rows':len(train_rows),'dev_rows':len(dev),'trainable_parameters':sum(v.numel() for v in params),'base_frozen':True}
  (root/'native-report.json').write_text(json.dumps(report,indent=2));(root/'schedule.json').write_text(json.dumps(schedule))
 tokenizer.save_pretrained(root/'tokenizer');report['passed']=True;report['peak_cuda_gib']=torch.cuda.max_memory_allocated()/2**30
 (root/'native-report.json').write_text(json.dumps(report,indent=2));return report
