"""Seed the one repeatedly invalid ledger BEFORE rendering; never edit transcript labels."""
import importlib.util,json
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('recover',HERE/'recover.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
m=r.m;row=r.BY_ID['pilot-001'];dest=HERE/'runs/pilot-50-final-root-v5';dest.mkdir(parents=True,exist_ok=True)
ledger={'candidate_name':'','service_background':'Former US Army test lead, now a civilian radar acceptance specialist.',
'facts':[
 {'field_id':'military_service','value':'US Army, test lead','spoken_at_turn':1,'will_be_spoken':True},
 {'field_id':'current_employer','value':'Riverbend Radar Systems','spoken_at_turn':2,'will_be_spoken':True},
 {'field_id':'current_title','value':'Acceptance Test Lead','spoken_at_turn':2,'will_be_spoken':True},
 {'field_id':'current_program','value':'Aster radar acceptance program','spoken_at_turn':2,'will_be_spoken':True},
 {'field_id':'key_technologies','value':'Python and hardware-in-the-loop testing','spoken_at_turn':3,'will_be_spoken':True}],
 'turn_outline':['Discuss previous Army test-lead work without dates, rank or credentials.','Discuss current employer, role and the Aster radar acceptance program.','Discuss Python and hardware-in-the-loop testing plus a personally owned change to acceptance sequencing.','Explain a concrete before/after acceptance throughput result and why it mattered to the team.','Explain that the change freed two technicians for other tasks without lowering acceptance standards; acknowledge the modest compute trade-off already accepted by the team.'],
 'previously_suggested_questions':[],'question_situation':'Contribution, result, team value and relevant trade-off fully explained; no obligation to ask another question.',
 'unspoken_facts':['No name, contacts, location, service dates, degree, clearance, salary, notice period, relocation preference or future career interest is supplied.']}
m.check_ledger(ledger,row)
class SeededClient(r.RecoveryClient):
 def call(self,directory,stage,model,messages,schema,check=None,max_tokens=6000):
  if stage=='ledger':
   m.save(directory/'ledger.json',{'payload':ledger,'provenance':'assistant-authored scenario seed before model rendering, not an OpenRouter generation','reason':'Original Haiku ledger repeatedly violated sparse-profile bounds; no generated transcript or extraction label was edited.'})
   return ledger
  return super().call(directory,stage,model,messages,schema,check,max_tokens)
result=m.run_root(row,dest,SeededClient(m.load_key()))
if result is None:raise SystemExit(1)
