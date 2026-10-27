/** Diagnostic for UI location presets; records raw results without changing model output. */
import {writeFileSync} from 'node:fs';
import {demoCases} from '../../web/lib/static-cases.ts';
import {fields} from '../../runtime/field-contract.mjs';
import {valuesMatch} from '../../runtime/quality-scoring.mjs';
const cases=demoCases.filter(s=>s.id.startsWith('static-location-'));
const report={modelId:'lfm2.5-2.6b-demo-adapters',purpose:'location_preset_diagnostic_not_training',results:[]};
for(const scenario of cases){
 const expected=scenario.expectations.filter(e=>e.fieldId==='location').at(-1)?.value??null;
 const base={modelId:report.modelId,fields,segments:scenario.segments,previousSnapshot:[],previousQuestions:[],processedResponseCount:0};
 const record={id:scenario.id,title:scenario.title,expected};
 for(const [stage,path] of [['live','analyze'],['final','finalize']]){
  const response=await fetch(`http://127.0.0.1:8000/v1/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(base),signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(await response.text());const result=await response.json();const actual=(stage==='live'?result.checklistSnapshot:result.finalSnapshot).find(f=>f.fieldId==='location');
  record[stage]={actual:actual.value,matches:expected===null||actual.value===null?expected===actual.value:valuesMatch('location',expected,actual.value),evidence:actual.evidence,raw:result.rawExtractionPayload.location};
 }
 report.results.push(record);writeFileSync('training/demo/runs/location-presets-v1.json',JSON.stringify(report,null,2));console.log(JSON.stringify(record));
}
console.log(JSON.stringify({cases:report.results.length,liveMatches:report.results.filter(r=>r.live.matches).length,finalMatches:report.results.filter(r=>r.final.matches).length}));
