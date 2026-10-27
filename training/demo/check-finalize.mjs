import {writeFileSync} from 'node:fs';
import {staticCases} from '../../web/lib/static-cases.ts';
import {fields} from '../../runtime/field-contract.mjs';
const scenario=staticCases.find(r=>r.id==='static-original-document');
const response=await fetch('http://127.0.0.1:8000/v1/finalize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({segments:scenario.segments,fields,modelId:'lfm2.5-2.6b-demo-adapters'}),signal:AbortSignal.timeout(180000)});
if(!response.ok)throw new Error(await response.text());const result=await response.json();writeFileSync('training/demo/runs/original-final-trained.json',JSON.stringify(result,null,2));console.log(JSON.stringify({fields:result.finalSnapshot.map(r=>({field:r.fieldId,value:r.value})),summary:result.summary,rejected:result.rejectedExtractions}));
