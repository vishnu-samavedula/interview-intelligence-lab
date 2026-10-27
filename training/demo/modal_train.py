"""Authorized focused-demo training/export, separate from disposable smoke artifacts."""
import hashlib,json
from datetime import datetime,timezone
from pathlib import Path
from uuid import uuid4
import modal
HERE=Path(__file__).parent
app=modal.App('veteran-interview-demo')
volume=modal.Volume.from_name('veteran-interview-smoke-v1')
image=(modal.Image.debian_slim(python_version='3.11').apt_install('git').pip_install('torch==2.8.0','transformers==4.57.1','peft==0.17.1','accelerate==1.10.1','safetensors==0.6.2','jinja2==3.1.6','sentencepiece==0.2.1','protobuf==5.29.5').env({'HF_HOME':'/artifacts/hf','TOKENIZERS_PARALLELISM':'false'}).add_local_file(HERE/'train.py','/workspace/train.py'))
@app.function(image=image,gpu='A100-80GB',volumes={'/artifacts':volume},timeout=21600,retries=0,max_containers=1)
def run_training(run_id,records):
 import sys
 sys.path.insert(0,'/workspace');from train import train
 try:return json.loads(json.dumps(train('/artifacts/demo-runs/'+run_id,records)))
 finally:volume.commit()
@app.function(image=image,volumes={'/artifacts':volume},timeout=900,retries=0)
def export(run_id):
 import subprocess
 from huggingface_hub import snapshot_download
 root=Path('/artifacts/demo-runs')/run_id;native=json.loads((root/'native-report.json').read_text());assert native['passed']
 source=Path('/tmp/llama-source');subprocess.run(['git','clone','--filter=blob:none','https://github.com/ggml-org/llama.cpp.git',str(source)],check=True);subprocess.run(['git','checkout','c1d0e7a004015f23bc0233470b747b596f29b264'],cwd=source,check=True)
 base=snapshot_download(native['model'],revision=native['revision'],local_files_only=True);report={}
 for task in ['extraction','questions']:
  target=root/(task+'.gguf');subprocess.run(['python',str(source/'convert_lora_to_gguf.py'),'--base',base,'--outfile',str(target),'--outtype','f32',str(root/task)],check=True);report[task]={'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
 (root/'export-report.json').write_text(json.dumps(report,indent=2));volume.commit();return report
@app.local_entrypoint()
def main(dataset:str='',export_only:str=''):
 if export_only:print(json.dumps(export.remote(export_only)));return
 file=Path(dataset);rows=[json.loads(l) for l in file.read_text().splitlines()];records=[r for r in rows if r['split'] in ['train','dev']]
 assert records and all(r['review_type'].startswith('cross_model') for r in records)
 assert not ({r['scenario_group_id'] for r in records if r['split']=='train'}&{r['scenario_group_id'] for r in rows if r['split']!='train'})
 run_id=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid4().hex[:8]
 manifest={'run_id':run_id,'dataset_sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'training_source_sha256':hashlib.sha256((HERE/'train.py').read_bytes()).hexdigest(),'dataset':str(file),'status':'training','experimental_not_production':True}
 (HERE/'training-run.json').write_text(json.dumps(manifest,indent=2));result=run_training.remote(run_id,records);(HERE/'native-report.json').write_text(json.dumps(result,indent=2));converted=export.remote(run_id);(HERE/'export-report.json').write_text(json.dumps(converted,indent=2));manifest['status']='trained_and_exported';(HERE/'training-run.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest))
