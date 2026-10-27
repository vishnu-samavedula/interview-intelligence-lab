import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSalary} from './salary-normalization.mjs';
const responses=new Map([[4,{interviewer:"What's your target compensation?",candidate:"My current total comp is around 178 base with a bonus that runs 10 to 15 percent. For a move I'd be looking at a base in the 205 to 215 range, but I'm flexible if there's a strong bonus or equity story."}]]);
const evidence=[{turn_id:4,quote:'For a move I would be looking at a base in the 205 to 215 range.'}];
test('salary shorthand expands a base/range and preserves bonus percentages and qualifiers',()=>{
 assert.equal(normalizeSalary('target_salary','205 to 215 range, flexible on equity',evidence,responses),'$205,000–$215,000 range, flexible on equity');
 assert.equal(normalizeSalary('current_salary','178 base with a bonus that runs 10 to 15 percent',evidence,responses),'$178,000 base with a bonus that runs 10 to 15 percent');
 assert.equal(normalizeSalary('target_salary','around 90 base',evidence,responses),'around $90,000 base');
 assert.equal(normalizeSalary('target_salary','$205k–$215k base',[],responses),'$205,000–$215,000 base');
 assert.equal(normalizeSalary('target_salary','$205,000–$215,000 base',evidence,responses),'$205,000–$215,000 base');
});
test('does not scale hourly/monthly pay, allowances, foreign currencies, percentages or other fields',()=>{
 for(const value of ['$52 an hour','$300 monthly','$90 allowance','EUR 205 to 215 base','$900 annual base','10 to 15 percent bonus'])assert.equal(normalizeSalary('current_salary',value,evidence,responses),value);
 assert.equal(normalizeSalary('team_size','205 to 215',evidence,responses),'205 to 215');
 assert.equal(normalizeSalary('target_salary','90',[],new Map()),'90');
});

test('live integration normalizes only accepted salary values and retains raw output and quotes',async()=>{
 const {validateExtraction}=await import('./live-extraction.mjs');
 const quote='My current total comp is around 178 base with a bonus that runs 10 to 15 percent. For a move I would be looking at a base in the 205 to 215 range.';
 const payload={current_salary:{operation:'set',value:'178 base, 10 to 15 percent bonus',evidence:[{turn_id:1,quote}]},target_salary:{operation:'set',value:'205 to 215 range',evidence:[{turn_id:1,quote}]}};
 const result=validateExtraction(payload,{fields:[{id:'current_salary'},{id:'target_salary'}],segments:[{id:'salary',date:'2026-10-26',timestamp:'12:00:00Z',turns:[{speaker:'Interviewer',turnId:1,text:'What are your pay expectations?'},{speaker:'Candidate',turnId:1,text:quote,responseComplete:true}]}]});
 assert.equal(result.checklistSnapshot[0].value,'$178,000 base, 10 to 15 percent bonus');
 assert.equal(result.checklistSnapshot[1].value,'$205,000–$215,000 range');
 assert.equal(result.rawExtractionPayload.target_salary.value,'205 to 215 range');
 assert.equal(result.checklistSnapshot[1].evidence[0].quote,quote);
});
