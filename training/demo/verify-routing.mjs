import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const rows=readFileSync('training/demo/runs/demo-reviewed-v1/examples.jsonl','utf8').trim().split('\n').map(JSON.parse);
const row=rows.find(r=>r.split==='locked_test'&&r.task==='extraction'&&r.mode==='final');
async function post(url,path,body){const r=await fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(await r.text());return r.json();}
const first=await post('http://127.0.0.1:8080','/apply-template',{messages:row.messages});const second=await post('http://127.0.0.1:8084','/apply-template',{messages:row.messages});assert.equal(first.prompt,second.prompt);
const samples=[];
for(const [name,url,lora]of [['original-base','http://127.0.0.1:8080',[]],['adapter-server-base','http://127.0.0.1:8084',[]],['extraction','http://127.0.0.1:8084',[{id:0,scale:1}]],['questions','http://127.0.0.1:8084',[{id:1,scale:1}]],['extraction-repeat','http://127.0.0.1:8084',[{id:0,scale:1}]]]){
 const raw=await post(url,'/completion',{prompt:first.prompt,n_predict:1,temperature:0,top_k:1,top_p:1,repeat_penalty:1,seed:26,n_probs:10,cache_prompt:false,lora});samples.push({name,raw});
}
const vector=s=>new Map(s.raw.completion_probabilities[0].top_logprobs.map(p=>[p.token,p.logprob]));
const difference=(a,b)=>{const x=vector(a),y=vector(b);return Math.max(...[...x.keys()].filter(k=>y.has(k)).map(k=>Math.abs(x.get(k)-y.get(k))));};
const report={same_prompt:true,base_server_probability_delta:difference(samples[0],samples[1]),adapter_repeat_probability_delta:difference(samples[2],samples[4]),extraction_effect_delta:difference(samples[1],samples[2]),task_effect_delta:difference(samples[2],samples[3]),samples};
assert.ok(report.base_server_probability_delta<1e-5);assert.ok(report.adapter_repeat_probability_delta<1e-5);assert.ok(report.extraction_effect_delta>1e-5);assert.ok(report.task_effect_delta>1e-5);report.passed=true;writeFileSync('training/demo/routing-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,samples:undefined}));
