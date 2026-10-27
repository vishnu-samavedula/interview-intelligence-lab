/** Package experimental demo data using the exact serving prompts. No production-gold claims. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {fields,FIELD_CONTRACT_VERSION} from '../../runtime/field-contract.mjs';
import {extractionMessages,questionMessages} from '../../runtime/model-prompts.mjs';
import {completedResponses} from '../../runtime/transcript-json.mjs';
import {validateExtraction} from '../../runtime/live-extraction.mjs';
import {reconcileExtraction} from '../../runtime/end-of-call.mjs';
import {digest} from '../corpus-audit.mjs';
const here=new URL('./',import.meta.url),run=resolve(process.argv[2]||JSON.parse(readFileSync(new URL('latest-run.json',here))).run_directory),plan=JSON.parse(readFileSync(new URL('plan.json',here))).roots;
function segments(turns,chunked=true){
 const result=[];
 for(const t of turns){
  const utterances=[['Interviewer',t.interviewer],['Candidate',t.candidate]];
  for(const [speaker,text]of utterances){const words=text.split(/\s+/);for(let n=0;n<words.length;n+=chunked?50:words.length){const end=Math.min(words.length,n+(chunked?50:words.length));const start=result.length*20;const date=new Date(Date.UTC(2026,9,26,12,0,start));result.push({id:`chunk-${result.length+1}`,date:date.toISOString().slice(0,10),timestamp:date.toISOString().slice(11),startSeconds:start,endSeconds:start+20,turns:[{speaker,turnId:t.turn_id,text:words.slice(n,end).join(' '),...(speaker==='Candidate'?{responseComplete:end===words.length}:{})}]});}}
 }
 return result;
}
const state=target=>fields.map(({id})=>({fieldId:id,status:target[id].value===null?'not_provided':'provided',value:target[id].value}));
function ops(target,previous=[]){const old=new Map(previous.map(x=>[x.fieldId,x.value]));return Object.fromEntries(fields.map(({id})=>[id,target[id].value===(old.get(id)??null)?{operation:'unchanged',value:null,evidence:[]}:target[id].value===null?{operation:'clear',value:null,evidence:[]}:{operation:'set',...target[id]}]));}
const rows=[],errors=[],rootReport=[];
for(const spec of plan){
 const path=resolve(run,spec.root_id,'result.json');if(!existsSync(path))continue;
 const r=JSON.parse(readFileSync(path)),turns=r.render.turns,source=segments(turns);assert.deepEqual(completedResponses(source).map(x=>x.candidate),completedResponses(segments(turns,false)).map(x=>x.candidate));
 const snapshot=Object.fromEntries(Object.entries(r.extractions).map(([cut,v])=>[cut,Object.fromEntries(v.selected.fields.map(({field_id,...x})=>[field_id,x]))]));
 const cuts=Object.keys(snapshot).map(Number).sort((a,b)=>a-b);let previous=[];
 const candidates=[];
 for(const cut of cuts){candidates.push({task:'extraction',mode:'live',cut,input:{segments:source.filter(s=>s.turns[0].turnId<=cut),previousSnapshot:previous,previousQuestions:[]},target:ops(snapshot[cut],previous),reference:snapshot[cut]});previous=state(snapshot[cut]);}
 candidates.push({task:'extraction',mode:'final',cut:turns.length,input:{segments:source,previousSnapshot:[],previousQuestions:[]},target:snapshot[turns.length],reference:snapshot[turns.length]});
 for(const [cut,q]of Object.entries(r.questions))candidates.push({task:'questions',mode:'questions',cut:Number(cut),input:{segments:source.filter(s=>s.turns[0].turnId<=Number(cut)),previousSnapshot:state(snapshot[cuts.filter(c=>c<=Number(cut)).at(-1)]),previousQuestions:q.input.recently_suggested_questions.map(question=>({question}))},target:q.selected,reference:q.selected});
 for(const [i,item]of candidates.entries()){
  try{
   const input={...item.input,fields};if(item.task==='extraction'){const errors=item.mode==='final'?reconcileExtraction(item.target,input).rejectedExtractions:validateExtraction(item.target,input).rejectedExtractionUpdates;assert.equal(errors.length,0,JSON.stringify(errors));}
   const messages=item.task==='questions'?questionMessages(input):extractionMessages({...input,finalize:item.mode==='final'});
   rows.push({id:`${spec.root_id}-${item.task}-${item.mode}-${i}`,root_id:spec.root_id,scenario_group_id:spec.scenario_group_id,split:spec.split,task:item.task,mode:item.mode,role_family:spec.role_family,generator_model:spec.generator_model,reviewer_model:spec.reviewer_model,field_contract:FIELD_CONTRACT_VERSION,messages,messages_hash:digest(messages),target:item.target,target_hash:digest(item.target),reference:item.reference,input:item.input,source_segments:source,visible_through_response:item.cut,review_type:'cross_model_experimental_not_human_gold',sample_weight:1,released_for_production:false});
  }catch(e){errors.push({root:spec.root_id,task:item.task,mode:item.mode,error:e.message});}
 }
 rootReport.push({root_id:spec.root_id,split:spec.split,turns:turns.length,chunk_reconstruction_preserved:true});
}
const partitions={};for(const r of rows){const key=`${r.split}/${r.task}`;partitions[key]=(partitions[key]||0)+1;}
writeFileSync(resolve(run,'examples.jsonl'),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');writeFileSync(resolve(run,'packaging.json'),JSON.stringify({roots:rootReport.length,rows:rows.length,partitions,errors,roots_report:rootReport,experimental:true},null,2));console.log(JSON.stringify({roots:rootReport.length,rows:rows.length,partitions,errors}));
