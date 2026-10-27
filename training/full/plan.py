"""Full corpus plan: split scenario families before generation; assign global entity inventories."""
import collections,hashlib,json,random
from pathlib import Path
HERE=Path(__file__).parent;ROOT=HERE.parent.parent
CONTRACT=json.loads((HERE.parent/'pilot/contract.json').read_text());IDS=[f['id'] for f in CONTRACT['fields']]
POLICY=json.loads((HERE.parent/'corpus-policy.json').read_text())
MODELS=list(POLICY['training_generator_shares'])
FIRST='Aisha Beatriz Carmen Devika Elena Farah Grace Hana Imani Jia Keiko Leila Maya Nadia Olivia Priya Quinn Rosa Sofia Talia Uma Valeria Willow Ximena Yasmin Zoe Adrian Blake Carlos Daniel Elias Felix Gabriel Hugo Idris Jamal Kenji Luis Mateo Noah Omar Pavel Rafael Samuel Theo Victor Wesley Yusuf Zane'.split()
LAST='Abbott Banerjee Calderon Duarte Erickson Figueroa Grewal Haddad Ibarra Johansson Kaur Larsen Mensah Nakamura Okafor Patel Qureshi Romero Santos Tran Usman Valdez Walker Xu Yilmaz Zhang'.split()
PREFIX='Alder Birch Cedar Delta Elm Fir Grove Harbor Indigo Juniper Keystone Laurel Mesa Northstar Orchard Prairie Quartz Ridge Sequoia Timber Union Valley Willow Zenith'.split()
SUFFIX='Aerospace Analytics Avionics Consulting Controls Cybernetics Dynamics Engineering Instruments Integration Logistics Manufacturing Networks Operations Research Robotics Sensors Simulation Software Strategies Systems Telemetry Testing Training'.split()
LOCATIONS=['Boise, Idaho','Reno, Nevada','Tulsa, Oklahoma','Madison, Wisconsin','Dayton, Ohio','Tampa, Florida','Albany, New York','Raleigh, North Carolina','Omaha, Nebraska','Salem, Oregon','Spokane, Washington','Lubbock, Texas','Duluth, Minnesota','Mobile, Alabama','Richmond, Virginia','Tempe, Arizona','Boulder, Colorado','Wichita, Kansas','Dover, Delaware','Bangor, Maine','Provo, Utah','Billings, Montana','Columbia, Missouri','Lexington, Kentucky','Topeka, Kansas','Columbus, Georgia','Fort Wayne, Indiana','Santa Fe, New Mexico','Worcester, Massachusetts','Grand Rapids, Michigan','Rapid City, South Dakota','Charleston, South Carolina','Lansing, Michigan','Trenton, New Jersey','Burlington, Vermont','Cheyenne, Wyoming','Fargo, North Dakota','Knoxville, Tennessee','Nashua, New Hampshire','Fresno, California','Baton Rouge, Louisiana','Concord, California','Des Moines, Iowa','Eugene, Oregon','Green Bay, Wisconsin','Harrisburg, Pennsylvania','Missoula, Montana','Ogden, Utah','Sioux Falls, South Dakota','Syracuse, New York']
ROLES={
'systems_engineering':(['Systems Integration Engineer','Requirements Engineer','Systems Architect','Verification Lead'],['SysML','DOORS','MATLAB','Cameo'],['interface handoffs','requirements traceability','integration dependencies','acceptance criteria','configuration drift']),
'software_cyber':(['Application Engineer','Cybersecurity Analyst','Software Engineer','Security Operations Lead'],['Rust','Python','Kubernetes','Splunk'],['deployment rollback','alert routing','access reviews','service recovery','dependency upgrades']),
'maintenance_avionics':(['Avionics Technician','Maintenance Planner','Diagnostics Engineer','Repair Operations Lead'],['ARINC 429','MIL-STD-1553','LabVIEW','oscilloscope'],['bench-test queues','fault isolation','parts substitutions','repair scheduling','repeat inspection']),
'logistics_operations':(['Supply Chain Analyst','Depot Coordinator','Inventory Planner','Operations Lead'],['SAP','Power BI','SQL','Tableau'],['stock rotation','dispatch sequencing','supplier lead times','inventory reconciliation','warehouse handoffs']),
'program_project_management':(['Program Analyst','Project Coordinator','Delivery Manager','Program Manager'],['Jira','Primavera','Microsoft Project','Smartsheet'],['scope changes','risk escalation','supplier milestones','stakeholder handoffs','budget approvals']),
' technical_training':([],[],[]),
'intelligence_analysis':(['Intelligence Analyst','Research Analyst','Geospatial Analyst','Analysis Team Lead'],['ArcGIS','QGIS','SQL','Palantir'],['source reconciliation','briefing relevance','collection gaps','confidence assessment','report prioritization']),
'quality_test':(['Quality Engineer','Test Engineer','Acceptance Lead','Reliability Analyst'],['JMP','Minitab','Python','hardware-in-the-loop testing'],['defect triage','false alarms','test sequencing','sampling coverage','root-cause classification']),
}
del ROLES[' technical_training'];ROLES['technical_training']=(['Instructional Designer','Technical Trainer','Learning Systems Specialist','Training Program Lead'],['Moodle','Articulate Storyline','Camtasia','ADDIE'],['skills transfer','qualification checks','scenario design','instructor handoffs','onboarding practice'])
RISKS=list(POLICY['extraction_primary_risk_shares'])
BEHAVIORS={
'direct_facts':'State the permitted candidate facts naturally, with specific field boundaries; do not gratuitously fill every checklist slot.',
'missing_information':'Leave several tempting facts unstated. The interviewer may ask for one; candidate politely declines or says it is not available. No hidden field value may leak.',
'corrections_and_retractions':'Explicitly correct one permitted field from an earlier plausible value to its assigned final value. State both old and replacement in candidate speech, in different completed responses. Include an explicit retraction without replacement for an otherwise absent field only if natural.',
'current_vs_historical':'Contrast a former civilian job/program with the current situation. If current employer/title/program is permitted, use its assigned value for current and a clearly former different value. If absent, keep the current one unnamed. Do not infer current_program from a military project.',
'negation_and_conditions':'Use a negation, refusal or genuine condition on a permitted fact. Make polarity and scope unambiguous; never replace an assigned final condition with an easier unconditional value.',
'numbers_units_and_ranges':'Distinguish numbers with different roles: direct reports versus people affected, salary versus allowance, hours versus years, trials versus improvement. Do not add forbidden checklist facts just to show numbers.',
'multiple_entities_and_speakers':'Let the interviewer posit an incorrect employer, title or work attribution; candidate explicitly rejects it. Distinguish a teammate’s contribution from the candidate’s work. Interviewer claims alone are not evidence.',
'evidence_and_ambiguity':'Include an ambiguous initial reference and an explicit clarification later, or a withheld/uncertain fact that stays unknown. Avoid narrator annotation.',
'response_continues_across_chunks':'Include one substantial candidate response whose final clause changes its meaning through negation, a corrected value or the actual outcome. It will be split into static chunks; the whole answer, not the first fragment, establishes meaning.',
'frozen_field_assignment':'Naturally distinguish employer, program, title and technology when these fields are permitted. A military rank is not a degree or current civilian title; interest in past duties is not automatically future preference.',
}
STRUCTURES=['candidate-led retrospective','recruiter starts with civilian work','specific incident before biography','chronological career transition','project discussion with later correction','comparison of two decisions','short eligibility screen then work example','work preference first then supporting experience','team-versus-personal attribution','return to an earlier claim','collaborative clarification of terminology','trade-off discussion then logistics','failed approach followed by result','responsibilities before technical example','interleaved career and work questions','handoff problem then practical outcome','role change during a program','past versus prospective work','constraints-first discussion','skeptical interviewer premise corrected','qualitative outcome without a metric','metric first with meaning clarified later','negative result and honest uncertainty','candidate declines an unsupported assumption','concrete mechanism followed by interest exploration']
QUESTION_GUIDES={
'ask_quantify_impact':'At both designated question cutoffs, a stated candidate work outcome is genuinely vague (not just activity volume). A useful follow-up asks its magnitude or meaningful observed change. No answer to that need in the visible window or history. Later turns may answer it.',
'ask_clarify_ownership':'At both question cutoffs, a team outcome or shared work claim leaves this candidate’s personal contribution unclear. A useful question isolates what this candidate owned, without crediting them for a colleague’s work.',
'ask_clarify_claim':'At both cutoffs, an actual work claim leaves its meaning or finding unclear. If many trials/exercises were run, the useful question asks what was learned rather than presuming an improvement.',
'ask_clarify_value_or_tradeoff':'At both cutoffs, a specific technical result (possibly quantified) lacks its practical team/operational value or has an explicitly relevant unresolved consequential trade-off. Ask neutrally, without inventing savings, compromise or risk.',
'ask_explore_role_or_interest':'At both cutoffs, an explicitly stated current/former role or professional interest warrants exploring contributions or interests. Do not assume a future aspiration was already performed in a current role.',
'abstain_already_complete':'At each cutoff the visible window clearly establishes candidate contribution, result and practical significance, with any consequential trade-off resolved. No forced methodology or numeric question remains.',
'abstain_contact_or_logistics':'At each cutoff the entire visible window is contact/compensation/availability/location administration, with no unresolved role/work claim in that window. Earlier work falls outside it or was resolved. Do not ask about checklist gaps.',
'abstain_answered_in_context':'An earlier question-visible vague claim is answered by a later response in the same window before each cutoff. Do not emit the stale question. Contribution/outcome/value are clear enough.',
'abstain_previously_suggested':'At each cutoff the only useful unresolved information need was already asked in the supplied recent model-question history. Suggestion history must be supported by actual candidate speech at or before its stored cutoff. Suppress semantic paraphrases, not just exact wording.',
}
def allocate(shares,total):
 counts={k:int(v*total) for k,v in shares.items()}
 for k in sorted(shares,key=lambda k:(-(shares[k]*total-counts[k]),k))[:total-sum(counts.values())]:counts[k]+=1
 return [k for k,c in counts.items() for _ in range(c)]
def fact_clause(field,value,index):
 forms={
 'full_name':['My name is {v}.','I am {v}.','For your records, I am {v}.'],
 'location':['I currently live in {v}.','My current home is in {v}.','I am based in {v}.'],
 'phone':['My preferred phone number is {v}.','You can call me at {v}.','For phone calls, use {v}.'],
 'email':['My preferred email is {v}.','Please email me at {v}.','The email to use is {v}.'],
 'bachelors_degree':['I hold a {v}.','I earned my {v}.','My undergraduate qualification is a {v}.'],
 'bachelors_year':["I graduated with that bachelor's degree in {v}.","My bachelor's graduation year was {v}.","I completed my undergraduate degree in {v}."],
 'masters_degree':['I earned an {v}.','My graduate degree is an {v}.','I hold an {v}.'],
 'masters_year':["I finished that master's degree in {v}.","My master's graduation year was {v}.","I completed that graduate degree in {v}."],
 'military_service':['I served in the {v}.','My military service was in the {v}.','I am a veteran of the {v}.'],
 'security_clearance':['I currently hold {v} clearance.','My current security clearance is {v}.','I maintain {v} security clearance.'],
 'current_employer':['My current employer is {v}.','I work at {v} now.','I am currently employed by {v}.'],
 'current_title':['My current job title is {v}.','In my current civilian job, I am a {v}.','I currently work as a {v}.'],
 'tenure':["I have been with my current employer for {v}.","My tenure in this current job is {v}.","I joined my current employer {v} ago."],
 'team_size':['I currently manage {v}.','My current team consists of {v}.','In this role, I supervise {v}.'],
 'current_program':['In my current job, I work on {v}.','My current program is {v}.','The program I am assigned to now is {v}.'],
 'key_technologies':['The tools I use are {v}.','I work hands-on with {v}.','My current technical toolkit includes {v}.'],
 'area_of_interest':['For my next role, I want to pursue {v}.','The future work I want is {v}.','I am interested in moving into {v}.'],
 'reason_for_leaving':['I am leaving my current job because {v}.','My reason for looking to leave is that {v}.','The reason for my move is that {v}.'],
 'current_salary':['My current pay is {v}.','I currently receive {v}.','In this job, I earn {v}.'],
 'target_salary':['For a new role, I am targeting {v}.','My desired compensation is {v}.','I am looking for {v} in my next job.'],
 'availability':['I can start after {v}.','My availability is {v}.','I need to give {v} before starting.'],
 'relocation':['Regarding relocation: {v}.','My relocation position is: {v}.','If the job requires moving: {v}.'],
 }
 return forms[field][(index//2)%len(forms[field])].format(v=value)

def main():
 rng=random.Random(261026);people=[a+' '+b for a in FIRST for b in LAST];employers=[a+' '+b for a in PREFIX for b in SUFFIX];rng.shuffle(people);rng.shuffle(employers)
 # 750 roots, 375 two-root scenario families. Related variants share split by construction.
 rows=[];offset=0;used_mechanisms=set();family_activities={}
 for split,count in [('train',500),('dev',100),('locked_test',100),('challenge',50)]:
  # Every two-root group is allocated together. Primary buckets pair adjacent generators.
  qslots=allocate(POLICY['question_primary_outcome_shares'],count);rng.shuffle(qslots)
  cats=qslots[:count//2];second_cats=qslots[count//2:]
  risks=allocate(POLICY['extraction_primary_risk_shares'],count//2);rng.shuffle(risks)
  densities=allocate({'sparse':.35,'medium':.40,'dense':.25},count);rng.shuffle(densities)
  difficulties=allocate(POLICY['difficulty_tier_shares'],count);rng.shuffle(difficulties)
  for local in range(count):
   index=offset+local;role=list(ROLES)[(local//2)%8];titles,tools,activities=ROLES[role];risk=risks[local//2];cat=cats[local//2];second_cat=second_cats[local//2];density=densities[local]
   group=(split,local//2)
   if local%2==0:
    choices=[a for a in activities if (role,risk,cat,second_cat,a) not in used_mechanisms]
    if not choices:raise ValueError('Mechanism exhausted; revise plan rather than duplicate across splits')
    activity=rng.choice(choices);used_mechanisms.add((role,risk,cat,second_cat,activity));family_activities[group]=activity
   else:activity=family_activities[group]
   # Balanced cyclic support with density spread; each field can be truly absent, including service.
   units=[['bachelors_degree','bachelors_year'],['masters_degree','masters_year']]+[[f] for f in IDS if f not in ['bachelors_degree','bachelors_year','masters_degree','masters_year']]
   rng.shuffle(units);allowed=[];capacity={'sparse':4,'medium':9,'dense':17}[density]
   for unit in units:
    if len(allowed)+len(unit)<=capacity:allowed+=unit
   values={}
   name=people[index];employer=employers[index%len(employers)]+(' Labs' if index>=len(employers) else '')
   j=index
   all_values={'full_name':name,'location':LOCATIONS[j%len(LOCATIONS)],'phone':f'(202) 555-{100+j:04d}','email':name.lower().replace(' ','.')+'@example.com','bachelors_degree':['B.S. in Mechanical Engineering','B.A. in Economics','B.S. in Computer Science','B.S. in Applied Mathematics'][j%4],'bachelors_year':str(2005+j%15),'masters_degree':['M.S. in Systems Engineering','M.S. in Applied Analytics','M.A. in Education','M.S. in Computer Science'][(j//3)%4],'masters_year':str(2021+j%4),'military_service':['Army','Navy','Marine Corps','Air Force','Coast Guard','Space Force'][(j//5)%6], 'security_clearance':['active Secret','active Top Secret/SCI'][j%2], 'current_employer':employer,'current_title':titles[j%len(titles)],'tenure':f'{1+j%8} years and {1+(j//8)%10} months','team_size':f'{3+j%13} direct reports','current_program':PREFIX[(j//7)%len(PREFIX)]+' '+['Integration','Readiness','Modernization','Validation','Transition'][(j//11)%5]+f' {1+j//120}','key_technologies':', '.join([tools[j%len(tools)],tools[(j+1)%len(tools)]]),'area_of_interest':['systems integration','security architecture','diagnostic engineering','supply chain optimization','program delivery','technical education','threat analysis','test automation'][list(ROLES).index(role)],'reason_for_leaving':['the current contract ends this year','a stated role ceiling limits further growth','the current program is losing funding','the employer is closing the local office','the current schedule conflicts with family responsibilities'][j%5],'current_salary':f'${70000+(j%40)*2000:,} annual base plus {3+j%9}% bonus','target_salary':f'${85000+(j%40)*2000:,}–${95000+(j%40)*2000:,} annual base, depending on scope','availability':f'{2+j%7} weeks notice','relocation':['No; occasional travel is acceptable','Only within the Pacific Northwest','Yes, after the school year ends','Only within 50 miles of the current city','Open to relocation within the continental US'][j%5]}
   values={k:all_values[k] for k in allowed}
   length=('short' if (local*13)%20<4 else 'standard' if (local*13)%20<15 else 'long')
   clauses={}
   for field,value in values.items():
    clauses[field]=fact_clause(field,value,index)
   rows.append({'root_id':f'full-{index+1:04d}','scenario_group_id':f'{split}-family-{local//2+1:03d}','split':split,'variant':local%2,'generator_model':MODELS[local%2],'reviewer_model':MODELS[1-local%2],'role_family':role,'template_family':f'dialogue-{local%25+1:02d}','dialogue_structure':STRUCTURES[local%25],'primary_risk':risk,'risk_instruction':BEHAVIORS[risk],'question_intent':cat,'question_instruction':QUESTION_GUIDES[cat],'question_intents':[cat,second_cat],'question_instructions':[QUESTION_GUIDES[cat],QUESTION_GUIDES[second_cat]],'density_intent':density,'difficulty':difficulties[local],'length_intent':length,'allowed_candidate_fields':values,'required_fact_clauses':clauses,'forbidden_fields':[k for k in IDS if k not in allowed],'internal_entities':{'person':name,'employer':employer,'location':all_values['location']},'work_situation':activity,'scenario_mechanism':f'{role}: {activity}; {BEHAVIORS[risk]}; {QUESTION_GUIDES[cat]}','extraction_cutoffs':'early complete response, then later complete response or final call; one final for every other root','second_extraction_mode':'final' if local%4 in [0,3] else 'live','question_window_sizes':[1 if local%5<2 else 2,3 if local%5!=0 else 2],'privacy':'Wholly fictional; never use actual customer or candidate data.'})
  offset+=count
 assert len(rows)==750 and len({r['internal_entities']['person'] for r in rows})==750
 assert len({r['internal_entities']['employer'] for r in rows})==750
 # Plan-level report is intent only. Actual spoken support, observed labels and tokens must be re-audited.
 report={}
 for split in ['train','dev','locked_test','challenge']:
  members=[r for r in rows if r['split']==split]
  report[split]={'roots':len(members),'rows_per_task':2*len(members),'families':len({r['scenario_group_id'] for r in members}),'generators':dict(collections.Counter(r['generator_model'] for r in members)),'field_support_planned':{field:sum(field in r['allowed_candidate_fields'] for r in members) for field in IDS},'question_intents':dict(collections.Counter(c for r in members for c in r['question_intents']))}
 result={'version':'full-v1','status':'planned_not_generated','field_contract':CONTRACT['field_contract'],'policy_sha256':hashlib.sha256(json.dumps(POLICY,sort_keys=True).encode()).hexdigest(),'reserved_pilot_families':True,'release_eligible':False,'report':report,'roots':rows}
 (HERE/'plan.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
