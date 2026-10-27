# Veteran interview intent contrasts

11 related pairs, 22 variants. These are calibration-only draft labels, not independent training roots or held-out evaluation. Structural, exact-quote and declared-difference checks pass; human semantic review remains pending. Keep both variants and all chunk versions together in any future split assignment. Example question wording is illustrative, not an exact-match target.

Review whether only the stated fields/question decision should change. Unlisted fields remain unknown. A model must preserve meaning across the single/multi versions and the final paraphrase pair. These checks reduce reliance on memorized patterns; passing twenty examples cannot establish generalization.

## Same employers, reversed current/former status

Expected difference: current_employer; question decision stays the same.

**employer-timeline-a**

Interviewer: Walk me through your background.

Candidate: I served in the Army. I previously worked at Cobalt Defense; I now work at Juniper Systems.

- military_service: Army
- current_employer: Juniper Systems

Question: None.

**employer-timeline-b**

Interviewer: Walk me through your background.

Candidate: I served in the Army. I previously worked at Juniper Systems; I now work at Cobalt Defense.

- military_service: Army
- current_employer: Cobalt Defense

Question: None.

Why: Employer popularity and word position must not override explicitly stated chronology.

Review: pending.

## Same clearance name, active versus expired

Expected difference: security_clearance; question decision stays the same.

**clearance-status-a**

Interviewer: What is your clearance status?

Candidate: I served in the Army. My Secret clearance is active today.

- military_service: Army
- security_clearance: active Secret clearance

Question: None.

**clearance-status-b**

Interviewer: What is your clearance status?

Candidate: I served in the Army. My Secret clearance expired; I do not currently hold a clearance.

- military_service: Army

Question: None.

Why: A clearance keyword or military background does not establish currently held status.

Review: pending.

## A simulation count versus a measured result

Expected difference: no extraction value changes; question decision changes.

**activity-versus-impact-a**

Interviewer: What did you personally do?

Candidate: I served in the Army. I built a Monte Carlo simulation and ran 1,000 scenarios to characterize tracking error.

- military_service: Army
- key_technologies: Monte Carlo simulation

Question: What did the simulations reveal about tracking error?

**activity-versus-impact-b**

Interviewer: What did you personally do?

Candidate: I served in the Army. I built a Monte Carlo simulation and used the results to change the tracking filter, reducing tracking error from eight percent to three percent. That cut unnecessary operator reviews, with no increase in missed tracks.

- military_service: Army
- key_technologies: Monte Carlo simulation

Question: None.

Why: Activity volume leaves the analytical finding unresolved. The second answer states contribution, result, operational value and the relevant trade-off; abstain rather than repeating those details.

Review: pending.

## Quantified team result versus stated personal contribution

Expected difference: no extraction value changes; question decision changes.

**team-versus-personal-a**

Interviewer: Tell me about the result.

Candidate: I served in the Army. Our team reduced maintenance delays by 30 percent last quarter. I was in that group.

- military_service: Army

Question: What did you personally contribute to reducing maintenance delays?

**team-versus-personal-b**

Interviewer: Tell me about the result.

Candidate: I served in the Army. I redesigned the parts scheduling process, reducing maintenance delays by 30 percent last quarter.

- military_service: Army

Question: None.

Why: A result can be quantified while ownership remains unclear. Do not credit a team achievement to the candidate without support.

Review: pending.

## Corrected email versus retracted email without replacement

Expected difference: email; question decision stays the same.

**replace-versus-withdraw-a**

Interviewer: How should I contact you?

Candidate: I served in the Army. Use riley@old.example.

Interviewer: Anything to correct?

Candidate: Replace that address with riley.chen@example.com.

- email: riley.chen@example.com
- military_service: Army

Question: None.

**replace-versus-withdraw-b**

Interviewer: How should I contact you?

Candidate: I served in the Army. Use riley@old.example.

Interviewer: Anything to correct?

Candidate: Remove that address. I do not have a replacement to share.

- military_service: Army

Question: None.

Why: Both variants invalidate the old address. Only an explicit replacement supports a new value; an email username is not a full name.

Review: pending.

## Conditional relocation versus refusal with travel permission

Expected difference: relocation; question decision stays the same.

**relocation-polarity-a**

Interviewer: Would you relocate?

Candidate: I served in the Army. I would relocate only to Denver, and I can travel up to 20 percent.

- military_service: Army
- relocation: would relocate only to Denver; can travel up to 20 percent

Question: None.

**relocation-polarity-b**

Interviewer: Would you relocate?

Candidate: I served in the Army. I would not relocate, even to Denver, but I can travel up to 20 percent.

- military_service: Army
- relocation: would not relocate, even to Denver; can travel up to 20 percent

Question: None.

Why: Shared city and travel keywords cannot erase polarity or destination restrictions.

Review: pending.

## Military rank versus explicit education evidence

Expected difference: masters_degree; question decision stays the same.

**rank-versus-degree-a**

Interviewer: What qualifications would you like to discuss?

Candidate: I served in the Army as a captain. I have not mentioned any degree.

- military_service: Army, captain

Question: None.

**rank-versus-degree-b**

Interviewer: What qualifications would you like to discuss?

Candidate: I served in the Army as a captain. I earned a master's in systems engineering.

- masters_degree: master's in systems engineering
- military_service: Army, captain

Question: None.

Why: Rank cannot supply an unstated degree, graduation year, clearance or civilian title.

Review: pending.

## A later answer resolves the earlier vague claim

Expected difference: no extraction value changes; question decision changes.

**resolved-versus-unresolved-a**

Interviewer: Describe your work.

Candidate: I served in the Army. I rewrote the test scheduler, and throughput improved a lot.

Interviewer: What changed in throughput?

Candidate: I do not have a percentage, but it used to take a full shift to finish a batch and now it finishes before lunch.

- military_service: Army

Question: None.

**resolved-versus-unresolved-b**

Interviewer: Describe your work.

Candidate: I served in the Army. I rewrote the test scheduler, and throughput improved a lot.

Interviewer: What changed in throughput?

Candidate: The engineers were pleased; I have not explained what changed in throughput.

- military_service: Army

Question: What concrete change in batch throughput followed your scheduler rewrite?

Why: Concrete qualitative comparisons can resolve impact without a percentage. Praise alone does not state the result. These inputs have no prior suggestion history; do not treat an actual interviewer question as a previously suggested model question.

Review: pending.

## Same amounts with current and target status exchanged

Expected difference: current_salary, target_salary; question decision stays the same.

**salary-status-a**

Interviewer: Tell me about compensation.

Candidate: I served in the Army. My current annual base is $150,000, and I am targeting $175,000 annual base.

- military_service: Army
- current_salary: $150,000 annual base
- target_salary: $175,000 annual base

Question: None.

**salary-status-b**

Interviewer: Tell me about compensation.

Candidate: I served in the Army. My current annual base is $175,000, and I am targeting $150,000 annual base.

- military_service: Army
- current_salary: $175,000 annual base
- target_salary: $150,000 annual base

Question: None.

Why: A lower target is possible. Assign status from speech, not a learned assumption that targets must exceed current pay.

Review: pending.

## Different wording with the same meaning

Expected difference: no extraction value changes; question decision stays the same.

**paraphrase-invariance-a**

Interviewer: Where do you work and when can you start?

Candidate: I served in the Army. I currently work at Cedar Defense. I need three weeks after accepting an offer.

- military_service: Army
- current_employer: Cedar Defense
- availability: three weeks after accepting an offer

Question: None.

**paraphrase-invariance-b**

Interviewer: Where do you work and when can you start?

Candidate: I served in the Army. Cedar Defense is my present employer. Once I accept an offer, allow three weeks before I can join.

- military_service: Army
- current_employer: Cedar Defense
- availability: three weeks after accepting an offer

Question: None.

Why: Equivalent wording should preserve field meaning and abstention. Evidence text naturally differs.

Review: pending.

## A measured result versus explained value and trade-offs

Expected difference: no extraction value changes; question decision changes.

**metric-versus-practical-value-a**

Interviewer: What did you personally improve?

Candidate: I served in the Army. I changed the filter and reduced tracking error from 8% to 3%.

- military_service: Army

Question: What did that improvement enable for the team, and were there any trade-offs?

**metric-versus-practical-value-b**

Interviewer: What did you personally improve?

Candidate: I served in the Army. I changed the filter and reduced tracking error from 8% to 3%. Operators spent less time reviewing false tracks; the trade-off was a small increase in compute cost, which the team accepted.

- military_service: Army

Question: None.

Why: A technical metric can leave its practical value unresolved. Ask without presuming savings or a trade-off. Once the candidate states the team benefit and relevant trade-off, abstain rather than asking again.

Review: pending.

