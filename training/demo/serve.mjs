/** Load both task adapters into one isolated Q4 server. Explicit per-request routing is required. */
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,openSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]);
const paths=['extraction','questions'].map(t=>resolve(root,`${t}.gguf`));
if(paths.some(p=>!existsSync(p)))throw new Error('Both exported adapters must exist');
const log=openSync('/tmp/interview-trained-demo.log','a');
const child=spawn('llama-server',['-m',resolve('models/LFM2.5-2.6B-GGUF/LFM2.5-2.6B-Q4_K_M.gguf'),'--host','127.0.0.1','--port','8084','--alias','interview-trained-demo','--gpu-layers','99','--ctx-size','8192','--parallel','1','--jinja','--reasoning','off','--reasoning-budget','0','--no-warmup','--lora',paths.join(','),'--lora-init-without-apply'],{stdio:['ignore',log,log],detached:true});
child.unref();mkdirSync('.demo-pids',{recursive:true});writeFileSync('.demo-pids/trained.pid',`${child.pid}\n`);
for(let i=0;i<180;i++){
 try{const health=await fetch('http://127.0.0.1:8084/health');if(health.ok){const reset=await fetch('http://127.0.0.1:8084/lora-adapters',{method:'POST',headers:{'Content-Type':'application/json'},body:'[]'});if(!reset.ok)throw new Error('Adapter reset failed');console.log(JSON.stringify({pid:child.pid,url:'http://127.0.0.1:8084',adapters:await(await fetch('http://127.0.0.1:8084/lora-adapters')).json()}));process.exit(0);}}
 catch{}
 await new Promise(r=>setTimeout(r,1000));
}
throw new Error('Server did not become ready; inspect /tmp/interview-trained-demo.log');
