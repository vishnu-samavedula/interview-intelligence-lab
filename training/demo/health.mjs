import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const [page,catalog,model]=await Promise.all([fetch('http://localhost:5174/'),fetch('http://127.0.0.1:8000/v1/models'),fetch('http://127.0.0.1:8084/health')]);
assert.ok(page.ok&&catalog.ok&&model.ok);const html=await page.text(),models=await catalog.json();
assert.ok(models.models.some(m=>m.id==='lfm2.5-2.6b-demo-adapters'&&m.available));assert.ok(html.includes('Training comparison'));assert.ok(html.includes('91.3'));
const report={frontend_status:page.status,api_status:catalog.status,trained_model_status:model.status,trained_profile_available:true,comparison_rendered:true,baseline_default_preserved:models.defaultModelId==='lfm2.5-2.6b-no-think',end_to_end_api_replays:'original-base.json and original-trained.json',end_of_call_api:'original-final-trained.json'};
writeFileSync('training/demo/app-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
