import {writeFileSync} from 'node:fs';
import {staticCases} from '../../web/lib/static-cases.ts';
import {fields} from '../../runtime/field-contract.mjs';
const scenario=staticCases.find(x=>x.id==='static-original-document');
const response=await fetch('http://127.0.0.1:8000/v1/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({modelId:'lfm2.5-2.6b-demo-adapters',segments:scenario.segments,fields,previousSnapshot:[],previousQuestions:[],processedResponseCount:0}),signal:AbortSignal.timeout(90000)});
if(!response.ok)throw new Error(await response.text());const r=await response.json();writeFileSync('/tmp/interview-salary-fix-check.json',JSON.stringify(r,null,2));
console.log(JSON.stringify({salaries:r.checklistSnapshot.filter(f=>['current_salary','target_salary'].includes(f.fieldId)).map(f=>({field:f.fieldId,value:f.value})),rawSalary:r.rawExtractionPayload.target_salary,questions:r.followUpQuestions,rawQuestionCount:r.rawFollowUpQuestions.length,rejectedQuestions:r.rejectedFollowUpQuestions}));
