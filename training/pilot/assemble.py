"""Assemble immutable pilot sources and corrected question labels without promoting them."""
import json,hashlib
from pathlib import Path
HERE=Path(__file__).parent
SOURCES=[HERE/'runs/pilot-50-v3',HERE/'runs/pilot-50-recovery-v4',HERE/'runs/pilot-50-final-root-v5']
QUESTIONS=HERE/'runs/pilot-50-questions-v5'
DEST=HERE/'runs/pilot-50-review-v5'
def main():
 plan=json.loads((HERE/'plan.json').read_text())['roots'];manifest=[]
 for spec in plan:
  id=spec['root_id'];source=next(base/id/'result.json' for base in SOURCES if (base/id/'result.json').exists())
  qfile=QUESTIONS/id/'result.json'
  root=json.loads(source.read_text());q=json.loads(qfile.read_text())
  assert Path(q['source_result'])==source
  root['question_relabel']=q;root['questions']=q['labels'];root['question_input']=q['input']
  root['disputes']=[d for d in root['disputes'] if d.get('task')!='questions']
  if q['labels']['generator']['decision']!=q['labels']['independent']['decision']:
   root['disputes'].append({'task':'questions','generator':q['labels']['generator'],'independent':q['labels']['independent']})
  directory=DEST/id;directory.mkdir(parents=True,exist_ok=True)
  (directory/'result.json').write_text(json.dumps(root,indent=2)+'\n')
  manifest.append({'root_id':id,'source_result':str(source),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'question_result':str(qfile),'question_sha256':hashlib.sha256(qfile.read_bytes()).hexdigest(),'manual_scenario_seed':id=='pilot-001'})
 output={'status':'pilot_pending_human_semantic_review','roots':manifest,'api_trace_directories':[str(p) for p in SOURCES+[QUESTIONS]],'released_for_training':False,'released_for_locked_evaluation':False}
 (DEST/'manifest.json').write_text(json.dumps(output,indent=2)+'\n')
 (HERE/'latest-run.json').write_text(json.dumps({'run_directory':str(DEST.resolve()),'status':output['status'],'generated_roots':len(manifest),'requested_roots':50},indent=2)+'\n')
 print(json.dumps({'assembled_roots':len(manifest),'directory':str(DEST)}))
if __name__=='__main__':main()
