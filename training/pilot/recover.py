"""Recover bounded pilot failures without weakening checks or overwriting their history."""
import copy
from concurrent.futures import ThreadPoolExecutor,as_completed
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil

HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('pilot_generation',HERE/'generate.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
PLAN=json.loads((HERE/'plan.json').read_text())['roots'];BY_ID={row['root_id']:row for row in PLAN}
SOURCE=HERE/'runs/pilot-50-v3';DEST=HERE/'runs/pilot-50-recovery-v4';DEST.mkdir(parents=True,exist_ok=True)

class RecoveryClient(m.Client):
    def call(self,directory,stage,model,messages,schema,check=None,max_tokens=6000):
        if not (directory/(stage+'.json')).exists():
            if stage=='ledger':
                schema=copy.deepcopy(schema)
                schema['properties']['turn_outline'].update({'minItems':4,'maxItems':9})
                density=BY_ID[directory.name]['density_intent']
                schema['properties']['facts']['maxItems']=5 if density=='sparse' else 13 if density=='medium' else 30
                if density=='dense':schema['properties']['facts']['minItems']=14
                messages=copy.deepcopy(messages)
                messages[0]['content']+='\nKeep the fact list within the bounded schema. Only record facts actually planned for speech; unspoken background belongs in unspoken_facts. For sparse profiles, omit the candidate name from speech if using it would exceed five supported fields. A turn outline may combine multiple facts; it is not one question per field.'
            elif stage=='render':
                ledger=json.loads((directory/'ledger.json').read_text())['payload']
                allowed=sorted({fact['field_id'] for fact in ledger['facts'] if fact['will_be_spoken']})
                messages=copy.deepcopy(messages)
                messages[0]['content']+='\nSpoken field IDs permitted by the ledger: '+json.dumps(allowed)+'. Do not introduce other profile facts. In particular candidate_name is internal unless full_name is permitted for speech. Do not fill a conventional interview checklist with invented education, contacts or logistics.'
            elif stage.startswith(('mid-','final-')):
                instruction,data=messages[0]['content'].rsplit('\n\n',1);data=json.loads(data)
                visible=data.pop('visible_responses')
                data['candidate_speech_for_quotes']=[{'turn_id':turn['turn_id'],'candidate':turn['candidate']} for turn in visible]
                data['interviewer_context_not_for_quotes']=[{'turn_id':turn['turn_id'],'interviewer':turn['interviewer']} for turn in visible]
                instruction+='\nFor evidence, quote ONLY candidate_speech_for_quotes. Never quote interviewer_context_not_for_quotes. If the candidate confirms an interviewer proposal, quote the candidate confirmation at that turn, not the interviewer sentence. Each quote is a contiguous exact substring; use separate evidence entries for separated clauses.'
                messages=m.messages(instruction,data)
        return super().call(directory,stage,model,messages,schema,check,max_tokens)

def recover(row):
    source=SOURCE/row['root_id'];target=DEST/row['root_id']
    if (target/'result.json').exists():return json.loads((target/'result.json').read_text())
    target.mkdir(exist_ok=True)
    if not (target/'recovery-lineage.json').exists():
        m.save(target/'recovery-lineage.json',{'original_run':str(source),'original_failure':json.loads((source/'failure.json').read_text()),'action':'Provider-enforced ledger bounds and explicit candidate-only quote sources. Original failures retained; no semantic values silently edited.'})
        for file in source.glob('*.json'):
            if '.attempt-' not in file.name and file.name not in ['failure.json','result.json','blueprint.json']:
                shutil.copy2(file,target/file.name)
    return m.run_root(row,DEST,RecoveryClient(m.load_key()))

if __name__=='__main__':
    rows=[row for row in PLAN if (SOURCE/row['root_id']/'failure.json').exists() and not (SOURCE/row['root_id']/'result.json').exists()]
    m.save(DEST/'recovery-config.json',{'source':str(SOURCE),'generator_sha256':hashlib.sha256((HERE/'generate.py').read_bytes()).hexdigest(),'recovery_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'root_ids':[row['root_id'] for row in rows]})
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=[future.result() for future in as_completed([pool.submit(recover,row) for row in rows])]
    print(json.dumps({'requested_recoveries':len(rows),'recovered':sum(result is not None for result in results)}),flush=True)
