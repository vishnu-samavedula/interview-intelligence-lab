# Calibration review: 20 draft conversations

These calibration cases incorporate the user’s edits and assistant-applied consistency fixes. They are not training data or held-out evaluation. Labels pass structural/quote checks; unchanged cases are not assumed approved. Each root has equivalent single/multi inputs. Coverage: 22 fields, eight veteran-interview role families, 12 ask/8 abstain. Calibration decisions follow meaning rather than a forced 50/50 quota; the production corpus balance remains a separate gate.

Review the expected meaning, required qualifiers and ask/abstain decision. Example question wording is illustrative; equivalent useful wording is acceptable. All unlisted extraction fields are unknown. Military background does not imply a degree, clearance, technical skill or civilian title. Questions may explore contribution or interests in an explicitly stated current/former role, or unresolved work impact, value and trade-offs. No invented premise or generic checklist-filling question. Concise service values and No for relocation can be correct; preserve optional detail separately. The reviewed US salary shorthand can expand to thousands when context supports it. For each case, mark accept or record the correction. User edits in cases 1, 3–8 and 19 have been carried into the source labels; reasons and related examples have been aligned. Applied corrections do not mark an entire case approved.

| Case | Accept / changes |
| --- | --- |
| calibration-01: Explicit contact correction | User edits applied; full case pending |
| calibration-02: Retraction without replacement | Consistency revised; review pending |
| calibration-03: Former program versus current employment | User edits applied; full case pending |
| calibration-04: Title promotion and tenure | User edits applied; full case pending |
| calibration-05: Current and target pay with a small allowance | User edits applied; full case pending |
| calibration-06: Salary shorthand in a US job interview | User edits applied; full case pending |
| calibration-07: Destination constraint and later negation | User edits applied; full case pending |
| calibration-08: Education and expired clearance | User edits applied; full case pending |
| calibration-09: Contribution, result and team value already clear | Consistency revised; review pending |
| calibration-10: Previously suggested follow-up is not repeated | Consistency revised; review pending |
| calibration-11: Vague impact with clear ownership | Consistency revised; review pending |
| calibration-12: Quantified team result without personal contribution | Consistency revised; review pending |
| calibration-13: Unclear nature of impact | Consistency revised; review pending |
| calibration-14: A later answer resolves the earlier claim | Consistency revised; review pending |
| calibration-15: Several opportunities, choose one | Consistency revised; review pending |
| calibration-16: Program and tools are distinct | Consistency revised; review pending |
| calibration-17: Direct reports versus contributors | Consistency revised; review pending |
| calibration-18: Interest and motivation explicitly stated | Consistency revised; review pending |
| calibration-19: Interviewer assertion corrected by the candidate | User edits applied; full case pending |
| calibration-20: Partial response and future facts withheld | Consistency revised; review pending |

## calibration-01: Explicit contact correction

**Turn 1 — Interviewer:** How should I contact you?

**Candidate:** I served in the Army from 2012 to 2020. I'm Ada Mensah in Madison. My phone is 608-555-0124. Use ada@old.example.

**Turn 2 — Interviewer:** Anything to correct?

**Candidate:** Please replace that email with ada.mensah@example.com.

Prior checklist: {"email":"ada@old.example"}.

Expected extraction:

- **phone:** 608-555-0124
- **full_name:** Ada Mensah
- **location:** Madison
- **email:** ada.mensah@example.com
- **military_service:** Army

**Question:** None.

**Reason:** Use the replacement address. Contact corrections do not warrant achievement questions.

**Also correct for military_service:** Army, 2012–2020. Branch-only is accepted; this fuller reference preserves more stated detail.

## calibration-02: Retraction without replacement

**Turn 1 — Interviewer:** May I record your contact details?

**Candidate:** Since leaving the Navy, I have been exploring civilian logistics roles. My phone is 202-555-0148.

**Turn 2 — Interviewer:** Is that still the best number?

**Candidate:** Actually, remove that number. I don't have a replacement to share yet.

Prior checklist: {"phone":"202-555-0148"}.

Expected extraction:

- **area_of_interest:** civilian logistics roles
- **military_service:** Navy
- **phone:** clear the previous value.

**Question:** None.

**Reason:** Clear the old number; do not preserve it or infer a replacement. The explicitly explored civilian logistics roles support area_of_interest, but this contact exchange does not need a career follow-up.

## calibration-03: Former program versus current employment

**Turn 1 — Interviewer:** Where did you work previously?

**Candidate:** Before my contracting roles, I served in the Air Force. I was a flight software engineer at Alder Avionics on the Sparrow program.

**Turn 2 — Interviewer:** And now?

**Candidate:** I'm currently a systems architect at Cobalt Aero. I haven't named my current program.

Prior checklist: {"current_program":"Sparrow"}.

Expected extraction:

- **current_employer:** Cobalt Aero
- **current_title:** systems architect
- **military_service:** Air Force
- **current_program:** clear the previous value.

**Question:** What did you build and contribute during your time at Alder avionics?

**Reason:** Sparrow is historical, so clear its unsupported current-field assignment. A useful follow-up can explore the contribution in the explicitly mentioned former role; it does not imply any achievement or current program.

## calibration-04: Title promotion and tenure

**Turn 1 — Interviewer:** What is your position?

**Candidate:** My background includes six years in the Army. I've worked at Fern Defense for three years as an analyst.

**Turn 2 — Interviewer:** Is that your current title?

**Candidate:** I was promoted last month; my current title is senior analyst.

Prior checklist: {"current_title":"analyst"}.

Expected extraction:

- **current_employer:** Fern Defense
- **tenure:** three years
- **current_title:** senior analyst
- **military_service:** Army

**Question:** Your areas of interest during your time as an analyst?

**Reason:** Use the promoted title and current-employer tenure. Exploring interests within the stated analyst role is a relevant career follow-up even without a vague achievement. The question itself does not establish a future area of interest.

**Also correct for military_service:** Army, six years. Branch-only is accepted; this fuller reference preserves more stated detail.

## calibration-05: Current and target pay with a small allowance

**Turn 1 — Interviewer:** What are you targeting?

**Candidate:** I left active duty in the Air Force in 2021. My current base is $165,000 annually plus a $100 monthly allowance.

**Turn 2 — Interviewer:** And for your next role?

**Candidate:** I'm targeting $185,000 annual base plus a 12 percent bonus, with no equity requirement.

Expected extraction:

- **current_salary:** $165,000 annual base plus a $100 monthly allowance
- **target_salary:** $185,000 annual base plus a 12 percent bonus; no equity requirement
- **military_service:** Air Force

**Question:** None.

**Reason:** Do not turn the $100 allowance into $100,000. Preserve units and all target qualifiers; the interviewer wording does not determine current versus target.

**Also correct for military_service:** Air Force, active duty ended 2021. Branch-only is accepted; this fuller reference preserves more stated detail.

## calibration-06: Salary shorthand in a US job interview

**Turn 1 — Interviewer:** What compensation would you want?

**Candidate:** I am a Coast Guard veteran considering civilian technical training work. For my next role, around 90.

Expected extraction:

- **target_salary:** $90,000
- **area_of_interest:** civilian technical training work
- **military_service:** Coast Guard

**Question:** None.

**Reason:** In this user-reviewed US job-interview salary context, around 90 means $90,000. The explicit uncertainty sentence was removed by the user. This convention does not scale small allowances or override hourly/foreign-currency cues. The stated technical-training interest is also extractable; no compensation follow-up is needed.

## calibration-07: Destination constraint and later negation

**Turn 1 — Interviewer:** Would you move?

**Candidate:** I served four years in the Marine Corps before moving into contracting. I would relocate only to Denver.

**Turn 2 — Interviewer:** Any update?

**Candidate:** I can no longer relocate anywhere. I can travel up to 20 percent, and I need six weeks after accepting an offer.

Prior checklist: {"relocation":"would relocate only to Denver"}.

Expected extraction:

- **relocation:** No
- **availability:** six weeks after accepting an offer
- **military_service:** Marine Corps

**Question:** None.

**Reason:** No correctly captures the latest relocation refusal and supersedes Denver. Travel permission is not relocation willingness. Preserve the start-date condition in availability.

**Also correct for military_service:** Marine Corps, four years. Branch-only is accepted; this fuller reference preserves more stated detail.

**Also correct for relocation:** cannot relocate anywhere; not willing to relocate. Travel permission does not change the refusal.

## calibration-08: Education and expired clearance

**Turn 1 — Interviewer:** Tell me about education and service.

**Candidate:** I earned a bachelor's in physics in 2017 and a master's in applied mathematics in 2019. I served in the Navy from 2010 to 2014.

**Turn 2 — Interviewer:** Do you hold a clearance?

**Candidate:** My Secret clearance expired in 2020; I don't currently hold a clearance.

Prior checklist: {"security_clearance":"Secret"}.

Expected extraction:

- **bachelors_degree:** bachelor's in physics
- **bachelors_year:** 2017
- **masters_degree:** master's in applied mathematics
- **masters_year:** 2019
- **military_service:** Navy
- **security_clearance:** clear the previous value.

**Question:** None.

**Reason:** Education years attach to their degrees. Expired clearance must not populate currently-held clearance.

**Also correct for military_service:** Navy, 2010–2014. Branch-only is accepted; this fuller reference preserves more stated detail.

## calibration-09: Contribution, result and team value already clear

**Turn 1 — Interviewer:** What did you accomplish?

**Candidate:** My testing background began during my Air Force service. I redesigned our acceptance checks and reduced rework from 18 to 11 percent over six months. That freed two technicians for other tasks without changing acceptance standards.

Expected extraction:

- **military_service:** Air Force

**Question:** None.

**Reason:** Contribution, result and operational value are clear, including unchanged acceptance standards. Do not ask a generic value or methodology question that repeats this information.

## calibration-10: Previously suggested follow-up is not repeated

**Turn 1 — Interviewer:** How did the rollout go?

**Candidate:** After serving in the Space Force, I moved into contractor network work. I led the network rollout. It was a huge success.

Previously suggested: What measurable result did the rollout achieve?

Expected extraction:

- **military_service:** Space Force

**Question:** None.

**Reason:** The outcome is vague, but the same question has already been suggested. Do not rephrase it to evade duplication.

## calibration-11: Vague impact with clear ownership

**Turn 1 — Interviewer:** What did you personally do?

**Candidate:** I served in the Army before becoming a civilian software engineer. I'm a backend engineer at Juniper Mission Systems. I rewrote the cache layer in Rust and made the service much faster.

Expected extraction:

- **current_employer:** Juniper Mission Systems
- **current_title:** backend engineer
- **key_technologies:** Rust
- **military_service:** Army

**Question:** How much faster did the service become after your cache rewrite?

**Reason:** Ownership is explicit; the size of the performance improvement is missing.

## calibration-12: Quantified team result without personal contribution

**Turn 1 — Interviewer:** Tell me about a recent result.

**Candidate:** I am transitioning out of the Marine Corps into civilian logistics. Our team reduced late spare-parts deliveries by 30 percent last quarter. I worked in that group.

Expected extraction:

- **area_of_interest:** civilian logistics
- **military_service:** Marine Corps

**Question:** What did you personally contribute to reducing late spare-parts deliveries?

**Reason:** The result is quantified, but group membership does not establish individual contribution.

**Also correct for military_service:** Marine Corps, transitioning out. Branch-only is accepted; this fuller reference preserves more stated detail.

## calibration-13: Unclear nature of impact

**Turn 1 — Interviewer:** Describe your own work.

**Candidate:** I taught maintenance courses while serving in the Army. I created a new maintenance training process. It made a real difference to our trainees.

Expected extraction:

- **military_service:** Army

**Question:** What changed for trainees because of your maintenance training process?

**Reason:** Clarify the claimed benefit before demanding a numerical metric.

**Also correct for military_service:** Army, taught maintenance courses. Branch-only is accepted; this fuller reference preserves more stated detail.

## calibration-14: A later answer resolves the earlier claim

**Turn 1 — Interviewer:** Tell me about the team result.

**Candidate:** I served in the Navy before joining the aircraft maintenance contractor. We dramatically reduced aircraft maintenance turnaround.

**Turn 2 — Interviewer:** What was your contribution?

**Candidate:** I automated the work-order checks; that cut average turnaround from ten days to six in the first quarter.

**Turn 3 — Interviewer:** Any other improvement?

**Candidate:** I also changed our inspection workflow, which made inspections much more reliable.

Expected extraction:

- **military_service:** Navy

**Question:** How did inspection reliability change after your workflow changes?

**Reason:** Do not ask about resolved maintenance turnaround. The newer inspection outcome remains vague.

## calibration-15: Several opportunities, choose one

**Turn 1 — Interviewer:** What have you delivered?

**Candidate:** During my Coast Guard service I coordinated maintenance schedules. I redesigned our scheduling process and reduced idle time substantially. We also improved supplier relationships.

**Turn 2 — Interviewer:** Which was your main responsibility?

**Candidate:** I personally owned scheduling; another manager led the supplier work.

Expected extraction:

- **military_service:** Coast Guard

**Question:** How much did idle time decrease after your scheduling changes?

**Reason:** One question on the candidate-owned result is preferable to probing someone else's work or emitting two questions.

**Also correct for military_service:** Coast Guard, coordinated maintenance schedules. Branch-only is accepted; this fuller reference preserves more stated detail.

## calibration-16: Program and tools are distinct

**Turn 1 — Interviewer:** What is your current assignment?

**Candidate:** I previously served in the Marine Corps as an analyst. I'm a data engineer at Willow Defense on the Lantern readiness reporting program. I use SQL and dbt.

**Turn 2 — Interviewer:** What did you improve?

**Candidate:** I rebuilt the reconciliation models, and reporting accuracy improved considerably.

Expected extraction:

- **current_title:** data engineer
- **current_employer:** Willow Defense
- **current_program:** Lantern readiness reporting program
- **key_technologies:** SQL and dbt
- **military_service:** Marine Corps

**Question:** What change in reporting accuracy followed your reconciliation rebuild?

**Reason:** Do not label Lantern as a technology. Ask about the unquantified accuracy outcome.

**Also correct for military_service:** Marine Corps, analyst. Branch-only is accepted; this fuller reference preserves more stated detail.

## calibration-17: Direct reports versus contributors

**Turn 1 — Interviewer:** Who do you lead?

**Candidate:** I served in the Army before working in civilian test operations. I'm a test manager at Fieldstone Test Systems. I have four direct reports and coordinate with twelve contractor contributors.

**Turn 2 — Interviewer:** What did your group achieve?

**Candidate:** We made a breakthrough in test reliability this quarter.

Expected extraction:

- **current_title:** test manager
- **current_employer:** Fieldstone Test Systems
- **team_size:** four direct reports; twelve contractor contributors
- **military_service:** Army

**Question:** What was your personal contribution to the test-reliability breakthrough?

**Reason:** Do not conflate contributors with direct reports. Either ownership clarification or a concrete reliability-result question is acceptable; emit one.

## calibration-18: Interest and motivation explicitly stated

**Turn 1 — Interviewer:** Why consider leaving, and what interests you?

**Candidate:** I am an Air Force veteran now working in defense contracting. I'm leaving because my employer is closing our division. I want to work on mission systems integration.

**Turn 2 — Interviewer:** Tell me about your work.

**Candidate:** I designed a maintenance interface that technicians said was much easier to use.

Expected extraction:

- **reason_for_leaving:** employer is closing the division
- **area_of_interest:** mission systems integration
- **military_service:** Air Force

**Question:** What concrete improvement did technicians report after using your maintenance interface?

**Reason:** Ask for a concrete outcome without inventing a measured lift. User feedback or a concrete qualitative example can satisfy the opportunity; do not require a percentage.

## calibration-19: Interviewer assertion corrected by the candidate

**Turn 1 — Interviewer:** You're the director at Beacon Defense, correct?

**Candidate:** The Navy was my first employer; these are my subsequent civilian roles. No. I'm a planner at Harbor Defense.

**Turn 2 — Interviewer:** What did you accomplish?

**Candidate:** I redesigned the maintenance schedule and reliability improved significantly.

Expected extraction:

- **current_title:** planner
- **current_employer:** Harbor Defense
- **military_service:** Navy

**Question:** How did maintenance reliability change after your scheduling redesign?

**Reason:** The candidate corrects the interviewer's assertion. Extract Harbor Defense and planner, not Beacon Defense or director. Follow up on the candidate's actual maintenance-reliability claim; the removed test-document sentence must not reappear.

## calibration-20: Partial response and future facts withheld

**Turn 1 — Interviewer:** What is your current role?

**Candidate:** I served in the Air Force before this civilian avionics role. I'm a test engineer at Silverleaf Avionics, and I hold an active Secret clearance.

**Turn 2 — Interviewer:** What have you improved?

**Candidate:** I introduced automated bench checks in Python, and throughput improved dramatically.

Expected extraction:

- **current_title:** test engineer
- **current_employer:** Silverleaf Avionics
- **security_clearance:** active Secret clearance
- **key_technologies:** Python
- **military_service:** Air Force

**Question:** How much did throughput improve after your automated bench checks?

**Reason:** At the labeled incremental cutoff, only the first two complete answers are usable. The next response is incomplete; do not infer relocation or availability from unseen continuation. A click containing only this fragment must skip inference and retain the preceding results.

**Boundary probe:** the next click contains only “I'm not”, marked incomplete. Buffer it without inference. The withheld continuation is stored separately for test construction and must never be supplied to a cutoff example.

