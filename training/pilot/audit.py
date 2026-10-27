"""Pilot diagnostics. Does not waive production gates or certify semantic labels."""
import json,re,hashlib
from collections import Counter,defaultdict
from pathlib import Path
HERE=Path(__file__).parent

def norm(text):return ' '.join(re.findall(r'\w+',text.lower()))
def grams(text):
 words=norm(text).split();return set(' '.join(words[index:index+5]) for index in range(max(1,len(words)-4)))
def jac(a,b):return len(a&b)/max(1,len(a|b))
def distribution(items,weight=lambda item:1):
 counts=defaultdict(float)
 for key,item in items:counts[key]+=weight(item)
 total=sum(counts.values());shares={key:value/total for key,value in counts.items()} if total else {}
 return {'counts':dict(counts),'shares':shares,'effective_groups':1/sum(value*value for value in shares.values()) if shares else 0}

def audit(run):
 plan=json.loads((HERE/'plan.json').read_text())['roots'];by_id={item['root_id']:item for item in plan}
 roots=[];failures=[];requests=[]
 for directory in sorted(run.glob('pilot-*')):
  if (directory/'result.json').exists():roots.append(json.loads((directory/'result.json').read_text()))
  elif (directory/'failure.json').exists():failures.append(json.loads((directory/'failure.json').read_text()))
 manifest=json.loads((run/'manifest.json').read_text()) if (run/'manifest.json').exists() else {}
 trace_dirs=[Path(path) for path in manifest.get('api_trace_directories',[str(run)])]
 seen=set()
 for trace_dir in trace_dirs:
  for file in trace_dir.glob('pilot-*/*.attempt-*.json'):
   directory=file.parent
   item=json.loads(file.read_text());usage=item.get('response',{}).get('usage',{})
   identity=item.get('response',{}).get('id') or str(file)
   if identity in seen:continue
   seen.add(identity)
   requests.append({'root':directory.name,'stage':item['stage'],'model':item['model_requested'],'provider':item.get('response',{}).get('provider'),'id':item.get('response',{}).get('id'),'validation':item.get('validation'),'error':item.get('error'),'prompt_tokens':usage.get('prompt_tokens',0),'completion_tokens':usage.get('completion_tokens',0),'cost':usage.get('cost',0) or 0})
 report={'status':'pilot_pending_review_not_a_release','planned_roots':len(plan),'generated_cross_labeled_roots':len(roots),'quarantined_incomplete_roots':failures,'generator_roots':dict(Counter(root['generator_model'] for root in roots)),
 'role_families':dict(Counter(by_id[root['root_id']]['role_family'] for root in roots)),'primary_risks_intended':dict(Counter(by_id[root['root_id']]['primary_risk'] for root in roots)),
 'template_concentration':distribution([(by_id[root['root_id']]['template_family'],root) for root in roots]),'question_decisions':dict(Counter(root['questions']['generator']['decision'] for root in roots)),
 'question_decision_disagreements':[root['root_id'] for root in roots if root['questions']['generator']['decision']!=root['questions']['independent']['decision']],
 'reference_disputes_total':sum(len(root['disputes']) for root in roots),'reference_disputes_are_not_automatically_errors':True,'density_drift':[],'field_support':{},'entity_concentration':{},'near_duplicate_flags':[],
 'request_counts':dict(Counter(item['model'] for item in requests)),'provider_usage':dict(Counter(str(item['provider']) for item in requests)),
 'prompt_tokens_by_model':dict(Counter()),'completion_tokens_by_model':dict(Counter()),'reported_cost_usd':sum(item['cost'] for item in requests),'failed_attempts':[item for item in requests if item['validation']!='passed'],
 'release_eligible':False,'outstanding_gates':['Human semantic labels and question usefulness review','Semantic duplicate embedding/taxonomy review','Production root/support/exposure quotas; a 50-root pilot cannot satisfy them','Role and primary-risk tags are design intent until semantic review']}
 report['question_window_sizes']=dict(Counter(root['question_relabel']['window_size'] for root in roots))
 if not (run/'tokenization-report.json').exists():report['outstanding_gates'].append('Native tokenizer lengths and mask validation on derived rows')
 else:report['tokenization']=json.loads((run/'tokenization-report.json').read_text())
 report['first_name_concentration']=dict(Counter(norm(root['extraction']['final']['generator']['full_name']['value']).split()[0] for root in roots if root['extraction']['final']['generator']['full_name']['value']))
 for key in ['prompt_tokens','completion_tokens']:
  counts=Counter()
  for item in requests:counts[item['model']]+=item[key]
  report[key+'_by_model']=dict(counts)
 for field in json.loads((HERE/'contract.json').read_text())['fields']:
  id=field['id'];report['field_support'][id]={'supported_roots':sum(root['extraction']['final']['generator'][id]['value'] is not None for root in roots),'unsupported_roots':sum(root['extraction']['final']['generator'][id]['value'] is None for root in roots)}
 for root in roots:
  count=sum(value['value'] is not None for value in root['extraction']['final']['generator'].values());actual='sparse' if count<=5 else 'medium' if count<=13 else 'dense'
  wanted=by_id[root['root_id']]['density_intent']
  if actual!=wanted:report['density_drift'].append({'root':root['root_id'],'intended':wanted,'observed_from_primary_label':actual,'supported_fields':count})
 for field in ['full_name','current_employer','location']:
  values=Counter(norm(root['extraction']['final']['generator'][field]['value']) for root in roots if root['extraction']['final']['generator'][field]['value'])
  report['entity_concentration'][field]={'unique':len(values),'most_common':values.most_common(8),'maximum_share_of_roots':max(values.values(),default=0)/max(1,len(roots))}
 text=[]
 for root in roots:
  words=' '.join(turn['interviewer']+' '+turn['candidate'] for turn in root['transcript']['turns']);masked=words
  for field in ['full_name','current_employer','location']:
   value=root['extraction']['final']['generator'][field]['value']
   if value:masked=re.sub(re.escape(value),' ENTITY ',masked,flags=re.I)
  masked=re.sub(r'\d+',' NUMBER ',masked)
  text.append((root['root_id'],norm(words),grams(words),grams(masked)))
 for index,left in enumerate(text):
  for right in text[index+1:]:
   score=max(jac(left[2],right[2]),jac(left[3],right[3]))
   if left[1]==right[1] or score>=0.8:report['near_duplicate_flags'].append({'roots':[left[0],right[0]],'score':score,'exact':left[1]==right[1]})
 if (run/'packaging-report.json').exists():report['packaging']=json.loads((run/'packaging-report.json').read_text())
 (run/'audit-report.json').write_text(json.dumps(report,indent=2)+'\n')
 return report,roots

if __name__=='__main__':
 import sys
 run=Path(sys.argv[1]) if len(sys.argv)>1 else Path(json.loads((HERE/'latest-run.json').read_text())['run_directory'])
 report,roots=audit(run)
 print(json.dumps({key:report[key] for key in ['generated_cross_labeled_roots','generator_roots','question_decisions','reported_cost_usd','release_eligible']},indent=2))
