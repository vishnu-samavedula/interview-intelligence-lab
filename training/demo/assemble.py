"""Merge immutable generation/recovery sources and apply explicit offline label adjudications."""
import hashlib,json,shutil
from pathlib import Path
HERE=Path(__file__).parent
SOURCES=[HERE/'runs/demo-v1',HERE/'runs/demo-recovery-v2',HERE/'runs/demo-recovery-v3']
DEST=HERE/'runs/demo-reviewed-v1'
CORRECTIONS={
 ('full-0601','relocation'):(None,'No relocation needs and being local do not establish willingness or refusal to move.'),
 ('full-0611','reason_for_leaving'):(None,'Satisfaction in a former task is not an explicit reason for leaving the current employer.'),
 ('full-0002','relocation'):(None,'Relocation assistance is a moving-cost benefit, not willingness to relocate.'),
 ('full-0021','military_service'):(None,'A role description without explicitly attributing that role to military service does not establish a military branch, role or dates.'),
 ('full-0022','availability'):(None,'Afternoon calendar blocks concern interview scheduling, not a start date or notice period.'),
 ('full-0025','location'):(None,'Locally does not identify the current city or geographic location.'),
 ('full-0059','location'):(None,'The region without any named geography does not identify a current city or location.'),
 ('full-0035','relocation'):(None,'Ability to work on site or remotely does not explicitly establish willingness to move geographically.'),
}
def main():
 DEST.mkdir(parents=True,exist_ok=True);plan=json.loads((HERE/'plan.json').read_text())['roots'];lineage=[];changes=[]
 for spec in plan:
  source=next((base/spec['root_id']/'result.json' for base in reversed(SOURCES) if (base/spec['root_id']/'result.json').exists()),None)
  if source is None:continue
  r=json.loads(source.read_text())
  for cut,entry in r['extractions'].items():
   for item in entry['selected']['fields']:
    key=(r['root_id'],item['field_id']);before=json.loads(json.dumps(item));reason=None
    if key in CORRECTIONS and item['value'] is not None:
     value,reason=CORRECTIONS[key];item['value']=value;item['evidence']=[]
    # Preserve the explicitly stated salary flexibility qualifier when the selected
    # annotation already chose the SAME amount and its quote contains that qualifier.
    expected=spec['allowed_candidate_fields'].get(item['field_id'])
    if item['field_id']=='target_salary' and item['value'] and expected and expected.startswith(item['value']) and expected!=item['value'] and any(expected in e['quote'] for e in item['evidence']):
     item['value']=expected;reason='Preserve the stated scope-dependent compensation condition, not just its amount.'
    if r['root_id']=='full-0035' and item['field_id']=='availability' and int(cut)>=6:
     turn=r['render']['turns'][5]
     if 'available to begin whenever needed' in turn['candidate']:
      item['value']='Available to begin whenever needed';item['evidence']=[{'turn_id':6,'quote':'I\'m available to begin whenever needed.'}];reason='A later explicit start-availability statement supersedes the earlier eight-week estimate.'
    if r['root_id']=='full-0611' and item['field_id']=='area_of_interest' and int(cut)==6:
     item['value']=None;item['evidence']=[];reason='Past engagement in former duties is not yet a desired future role; future interest is first stated later in turn 8.'
    if reason and before!=item:changes.append({'root_id':r['root_id'],'cutoff':cut,'before':before,'after':item,'reason':reason,'reviewer':'assistant_offline_semantic_review_not_human_gold'})
  target=DEST/r['root_id'];target.mkdir(exist_ok=True);(target/'result.json').write_text(json.dumps(r,indent=2)+'\n')
  lineage.append({'root_id':r['root_id'],'source':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'split':spec['split']})
 (DEST/'manifest.json').write_text(json.dumps({'lineage':lineage,'adjudications':changes,'experimental':True,'human_gold':False},indent=2)+'\n')
 (HERE/'latest-run.json').write_text(json.dumps({'run_directory':str(DEST.resolve()),'status':'experimental_machine_reviewed'},indent=2)+'\n')
 print(json.dumps({'merged':len(lineage),'adjudications':len(changes)}))
if __name__=='__main__':main()
