/** Paired, deterministic base/adapted Q4 evaluation on unseen synthetic interviews. */
import {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {fields} from '../../runtime/field-contract.mjs';
import {liveExtractionSchema,validateExtraction} from '../../runtime/live-extraction.mjs';
import {finalExtractionSchema,reconcileExtraction} from '../../runtime/end-of-call.mjs';
import {questionSchema} from '../../runtime/model-prompts.mjs';
import {digest} from '../corpus-audit.mjs';
import {normalized,valuesMatch} from '../../runtime/quality-scoring.mjs';
const dataset=resolve(process.argv[2]),out=resolve(process.argv[3]||'training/demo/runs/evaluation-v1');mkdirSync(out,{recursive:true});
const rows=readFileSync(dataset,'utf8').trim().split('\n').map(JSON.parse).filter(r=>['locked_test','challenge'].includes(r.split)&&(r.mode==='final'||r.task==='questions'));
const duration=s=>normalized(s).replace(/\b(years|yrs|yr)\b/g,'year').replace(/\b(months|mos|mo)\b/g,'month').replace(/\b(weeks|wks|wk)\b/g,'week').replace(/\bdays\b/g,'day');
function matches(field,expected,actual){
 if(expected===null||actual===null)return expected===actual;
 if(valuesMatch(field,expected,actual))return true;
 if(['tenure','availability'].includes(field))return duration(expected)===duration(actual);
 if(field==='security_clearance'){
  const simplify=s=>normalized(s).replace(/\b(active|current|currently|security|clearance)\b/g,'').trim().replace(/\s+/g,' ');
  return simplify(expected)===simplify(actual);
 }
 if(field==='military_service'){
  const branch=expected.match(/\b(Army|Navy|Marine Corps|Air Force|Coast Guard|Space Force)\b/i)?.[0];
  if(branch&&normalized(actual)===normalized(branch))return true;
 }
 if(field==='relocation'&&/^no[;,. ]/i.test(expected)&&normalized(actual)==='no')return true;
 return false;
}
const profiles=(process.env.EVAL_PROFILES||'base,trained').split(',');const endpoint=process.env.EVAL_URL||'http://127.0.0.1:8084';const model=process.env.EVAL_MODEL||'interview-trained-demo';
const reports=[];
for(const r of rows){
 for(const profile of profiles){
  const path=resolve(out,`${r.id}-${profile}.json`),identity=digest({messages:r.messages,profile,target:r.reference});
  if(existsSync(path)){const cached=JSON.parse(readFileSync(path));if(cached.identity!==identity)throw new Error('Evaluation cache inputs changed');if(!cached.error){reports.push(cached);continue;}renameSync(path,path+`.failed-${Date.now()}`);}
  const started=performance.now();let report={id:r.id,root_id:r.root_id,split:r.split,task:r.task,profile,identity,reference:r.reference,input:r.input};
  try{
   const response=await fetch(`${endpoint}/v1/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages:r.messages,response_format:{type:'json_schema',json_schema:{name:r.task==='questions'?'ranked_questions':'extraction',strict:true,schema:r.task==='questions'?questionSchema:finalExtractionSchema(fields)}},max_tokens:r.task==='questions'?1024:4096,temperature:0,top_k:1,top_p:1,repeat_penalty:1,seed:26,cache_prompt:false,lora:profile==='base'?[]:[{id:r.task==='questions'?1:0,scale:1}]}),signal:AbortSignal.timeout(240000)});
   if(!response.ok)throw new Error(`HTTP ${response.status}: ${await response.text()}`);
   const raw=await response.json();report.raw=raw;report.payload=JSON.parse(raw.choices[0].message.content);report.finish_reason=raw.choices[0].finish_reason;
   if(report.finish_reason!=='stop')throw new Error('Incomplete generation');
   if(r.task==='extraction'){
    const validated=reconcileExtraction(report.payload,{...r.input,fields});report.rejected=validated.rejectedExtractions;
    const predictions=Object.fromEntries(validated.finalSnapshot.map(v=>[v.fieldId,v.value]));let tp=0,fp=0,fn=0,presenceTP=0,presenceFP=0,presenceFN=0;const details=[];
    for(const {id}of fields){const expected=r.reference[id].value,actual=predictions[id];const supported=expected!==null,predicted=actual!==null;
     if(supported&&predicted)presenceTP++;else if(supported)presenceFN++;else if(predicted)presenceFP++;
     const equal=matches(id,expected,actual);if(supported&&equal)tp++;else{if(predicted)fp++;if(supported)fn++;}
     details.push({field:id,expected,actual,normalized_match:equal});
    }
    report.scores={tp,fp,fn,presenceTP,presenceFP,presenceFN};report.details=details;
    let rawTP=0,rawFP=0,rawFN=0;
    for(const {id}of fields){const expected=r.reference[id].value,actual=report.payload[id]?.value??null;const match=matches(id,expected,actual);if(expected!==null&&match)rawTP++;else{if(actual!==null)rawFP++;if(expected!==null)rawFN++;}}
    report.raw_scores={tp:rawTP,fp:rawFP,fn:rawFN};
   }else{
    const qs=report.payload.questions;if(!Array.isArray(qs)||qs.length>6||qs.some(q=>typeof q!=='string'||!q.endsWith('?')))throw new Error('Invalid ranked question contract');
    report.displayed=qs.slice(0,3);report.count=qs.length;
   }
  }catch(e){report.error=e.message;report.error_cause=e.cause?.code;}
  report.elapsed_ms=Math.round(performance.now()-started);writeFileSync(path,JSON.stringify(report,null,2));reports.push(report);if(report.error==='fetch failed')throw new Error(`Evaluation server unavailable: ${report.error_cause||report.error}`);console.log(JSON.stringify({id:r.id,profile,ms:report.elapsed_ms,error:report.error,questions:report.count,scores:report.scores}));
 }
}
const summary={scope:'unseen_synthetic_demo_not_real_world_proof',dataset_sha256:digest(readFileSync(dataset,'utf8')),profiles:{},question_quality:'Awaiting blinded usefulness review. Exact reference wording is not a correctness criterion.'};
for(const profile of profiles){const members=reports.filter(r=>r.profile===profile),ex=members.filter(r=>r.task==='extraction');const raw={tp:0,fp:0,fn:0};for(const r of ex)for(const k in raw)raw[k]+=r.raw_scores?.[k]||0;const s={tp:0,fp:0,fn:0,presenceTP:0,presenceFP:0,presenceFN:0};for(const r of ex)for(const k in s)s[k]+=r.scores?.[k]||0;summary.profiles[profile]={rows:members.length,failures:members.filter(r=>r.error).length,extraction:{raw_model:{...raw,normalized_value_f1:2*raw.tp/Math.max(1,2*raw.tp+raw.fp+raw.fn)},rejected_fields:ex.reduce((n,r)=>n+(r.rejected?.length||0),0),...s,normalized_value_precision:s.tp/Math.max(1,s.tp+s.fp),normalized_value_recall:s.tp/Math.max(1,s.tp+s.fn),normalized_value_f1:2*s.tp/Math.max(1,2*s.tp+s.fp+s.fn),presence_f1:2*s.presenceTP/Math.max(1,2*s.presenceTP+s.presenceFP+s.presenceFN),note:'Conservative normalized text matching; inspect supported concise/full variants separately.'},question_batches:members.filter(r=>r.task==='questions').length};}
writeFileSync(resolve(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
