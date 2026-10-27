/** Derive student rows mechanically from reviewed-shape teacher snapshots; never promote drafts. */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { fields, FIELD_CONTRACT_VERSION } from '../../runtime/field-contract.mjs';
import { extractionMessages, questionMessages } from '../../runtime/model-prompts.mjs';
import { validateExtraction } from '../../runtime/live-extraction.mjs';
import { reconcileExtraction } from '../../runtime/end-of-call.mjs';
import { completedResponses } from '../../runtime/transcript-json.mjs';
import { digest } from '../corpus-audit.mjs';
const base=new URL('./',import.meta.url);
const latest=JSON.parse(readFileSync(new URL('./latest-run.json',base)));
const run=resolve(process.argv[2]||latest.run_directory);
const plan=JSON.parse(readFileSync(new URL('./plan.json',base))).roots;
function segments(turns, chunked=false){
  const chunks=[];let count=0;
  for(const turn of turns)for(const [speaker,text] of [['Interviewer',turn.interviewer],['Candidate',turn.candidate]]){
    const words=text.split(/\s+/);
    for(let offset=0;offset<words.length;){
      if(!chunks.length||chunked&&count>=50){
        const start=chunks.length*25;
        const receipt=new Date(Date.UTC(2026,9,23,12,0,start+25));
        chunks.push({id:`chunk-${chunks.length+1}`,date:receipt.toISOString().slice(0,10),timestamp:receipt.toISOString().slice(11),startSeconds:start,endSeconds:start+25,turns:[]});count=0;
      }
      const size=chunked?Math.min(50-count,words.length-offset):words.length;
      chunks.at(-1).turns.push({speaker,turnId:turn.turn_id,text:words.slice(offset,offset+size).join(' '),...(speaker==='Candidate'?{responseComplete:offset+size===words.length}:{})});
      count+=size;offset+=size;
    }
  }
  return chunks;
}
const snapshot=(target)=>fields.map(({id})=>({fieldId:id,status:target[id].value===null?'not_provided':'provided',value:target[id].value}));
function operations(target,previous=[]){
  const prior=new Map(previous.map(field=>[field.fieldId,field.value]));
  return Object.fromEntries(fields.map(({id})=>{const value=target[id].value,old=prior.get(id)??null;
    return [id,value===old?{operation:'unchanged',value:null,evidence:[]}:value===null?{operation:'clear',value:null,evidence:[]}:{operation:'set',value,evidence:target[id].evidence}];}));
}
const rows=[], reports=[],errors=[];
for(const name of readdirSync(run).filter(name=>name.startsWith('pilot-')).sort()){
  const file=resolve(run,name,'result.json');if(!existsSync(file))continue;
  const result=JSON.parse(readFileSync(file));const spec=plan.find(root=>root.root_id===name);
  const turns=result.transcript.turns;const full=segments(turns);const multi=segments(turns,true);const mid=segments(turns.slice(0,result.live_cutoff));
  assert.deepEqual(completedResponses(full).map(x=>x.candidate),completedResponses(multi).map(x=>x.candidate));
  const final=result.extraction.final.generator;const middle=result.extraction.mid.generator;
  const midPrior=snapshot(middle);const finalSnapshot=snapshot(final);
  const q=result.question_relabel;
  if(!q)throw new Error(`${name}: missing corrected question-window labels`);
  const candidates=[
    {task:'extraction',mode:'live',cutoff:result.live_cutoff,input:{segments:mid,previousSnapshot:[],previousQuestions:[]},target:operations(middle)},
    {task:'extraction',mode:'live',cutoff:turns.length,input:{segments:full,previousSnapshot:midPrior,previousQuestions:[]},target:operations(final,midPrior)},
    {task:'extraction',mode:'final',cutoff:turns.length,input:{segments:full,previousSnapshot:[],previousQuestions:[]},target:final},
    {task:'questions',mode:'questions',cutoff:q.cutoff,input:{segments:segments(turns.slice(0,q.cutoff)),previousSnapshot:snapshot(q.snapshot),previousQuestions:q.input.recently_suggested_questions.map(question=>({question}))},target:{questions:q.labels.generator.questions}},
  ];
  let rejected=0;
  for(const [index,item]of candidates.entries()){
    const input={...item.input,fields};
    try{
      if(item.task==='extraction'){
        const validation=item.mode==='final'?reconcileExtraction(item.target,input).rejectedExtractions:validateExtraction(item.target,input).rejectedExtractionUpdates;
        if(validation.length)throw new Error(JSON.stringify(validation));
      }
      const messages=item.task==='questions'?questionMessages(input):extractionMessages({...input,finalize:item.mode==='final'});
      rows.push({example_id:`${name}-${item.task}-${item.mode}-${index}`,root_id:name,scenario_group_id:spec.scenario_group_id,split:'pilot_review_only',task:item.task,mode:item.mode,
        template_family:spec.template_family,domain_role_family:spec.role_family,domain_scope:spec.domain_scope,field_contract:FIELD_CONTRACT_VERSION,field_definitions:fields,
        generator_model:spec.generator_model,independent_reviewer_model:spec.reviewer_model,primary_bucket_intent:item.task==='questions'?spec.question_outcome_intent:spec.primary_risk,
        question_category_observed:item.task==='questions'?result.questions.generator.category:null,source_segments:full,rendered_transcript_hash:digest(full),visible_through_response:item.cutoff,input:item.input,messages,messages_hash:digest(messages),target:item.target,target_hash:digest(item.target),
        annotation_provenance:'model_generated_cross_labeled_not_human_gold',prior_state_source:item.task==='questions'?q.prior_state_source:item.input.previousSnapshot.length?'generator_annotation_at_visible_cutoff':'empty',question_window_size:item.task==='questions'?q.window_size:null,review_status:'pending',disagreement_count:result.disputes.length,
        prompt_tokens:null,target_tokens:null,sample_weight:1,semantic_support_review:'pending',truncated:false,released_for_training:false,released_for_locked_evaluation:false});
    }catch(error){rejected++;errors.push({root:name,mode:item.mode,task:item.task,error:error.message});}
  }
  const bufferTrace=multi.map((_,index)=>completedResponses(multi.slice(0,index+1)).length);
  reports.push({root_id:name,complete_exchanges:turns.length,multi_chunks:multi.length,completed_response_counts:bufferTrace,derived_rows_rejected:rejected,reconstruction_preserved:true});
}
writeFileSync(resolve(run,'pilot-examples.jsonl'),rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
writeFileSync(resolve(run,'packaging-report.json'),JSON.stringify({roots:reports.length,rows:rows.length,errors,roots_report:reports,released_for_training:false},null,2)+'\n');
console.log(JSON.stringify({roots:reports.length,rows:rows.length,errors:errors.length,released_for_training:false}));
