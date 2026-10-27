/** Calibration-only meaning contrasts; never count related variants as independent roots. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fields, FIELD_CONTRACT_VERSION } from "../runtime/field-contract.mjs";
import { completedResponses } from "../runtime/transcript-json.mjs";
import { reconcileExtraction } from "../runtime/end-of-call.mjs";

// facts: field, value, turn ID, verbatim candidate quote. All unlisted fields stay unknown.
const groups = [
  {
    id: "employer-timeline", title: "Same employers, reversed current/former status", relation: "meaning_changes", changed_fields: ["current_employer"],
    variants: [
      { id: "a", turns: [["Walk me through your background.", "I served in the Army. I previously worked at Cobalt Defense; I now work at Juniper Systems."]], facts: [["current_employer", "Juniper Systems", 1, "I now work at Juniper Systems"]], question: null },
      { id: "b", turns: [["Walk me through your background.", "I served in the Army. I previously worked at Juniper Systems; I now work at Cobalt Defense."]], facts: [["current_employer", "Cobalt Defense", 1, "I now work at Cobalt Defense"]], question: null },
    ],
    rationale: "Employer popularity and word position must not override explicitly stated chronology.",
  },
  {
    id: "clearance-status", title: "Same clearance name, active versus expired", relation: "meaning_changes", changed_fields: ["security_clearance"],
    variants: [
      { id: "a", turns: [["What is your clearance status?", "I served in the Army. My Secret clearance is active today."]], facts: [["security_clearance", "active Secret clearance", 1, "My Secret clearance is active today"]], question: null },
      { id: "b", turns: [["What is your clearance status?", "I served in the Army. My Secret clearance expired; I do not currently hold a clearance."]], facts: [], question: null },
    ],
    rationale: "A clearance keyword or military background does not establish currently held status.",
  },
  {
    id: "activity-versus-impact", title: "A simulation count versus a measured result", relation: "meaning_changes", changed_fields: [], question_decision_changes: true,
    variants: [
      { id: "a", turns: [["What did you personally do?", "I served in the Army. I built a Monte Carlo simulation and ran 1,000 scenarios to characterize tracking error."]], facts: [["key_technologies", "Monte Carlo simulation", 1, "I built a Monte Carlo simulation"]], question: "What did the simulations reveal about tracking error?" },
      { id: "b", turns: [["What did you personally do?", "I served in the Army. I built a Monte Carlo simulation and used the results to change the tracking filter, reducing tracking error from eight percent to three percent. That cut unnecessary operator reviews, with no increase in missed tracks."]], facts: [["key_technologies", "Monte Carlo simulation", 1, "I built a Monte Carlo simulation"]], question: null },
    ],
    rationale: "Activity volume leaves the analytical finding unresolved. The second answer states contribution, result, operational value and the relevant trade-off; abstain rather than repeating those details.",
  },
  {
    id: "team-versus-personal", title: "Quantified team result versus stated personal contribution", relation: "meaning_changes", changed_fields: [], question_decision_changes: true,
    variants: [
      { id: "a", turns: [["Tell me about the result.", "I served in the Army. Our team reduced maintenance delays by 30 percent last quarter. I was in that group."]], facts: [], question: "What did you personally contribute to reducing maintenance delays?" },
      { id: "b", turns: [["Tell me about the result.", "I served in the Army. I redesigned the parts scheduling process, reducing maintenance delays by 30 percent last quarter."]], facts: [], question: null },
    ],
    rationale: "A result can be quantified while ownership remains unclear. Do not credit a team achievement to the candidate without support.",
  },
  {
    id: "replace-versus-withdraw", title: "Corrected email versus retracted email without replacement", relation: "meaning_changes", changed_fields: ["email"],
    variants: [
      { id: "a", turns: [["How should I contact you?", "I served in the Army. Use riley@old.example."], ["Anything to correct?", "Replace that address with riley.chen@example.com."]], facts: [["email", "riley.chen@example.com", 2, "Replace that address with riley.chen@example.com"]], question: null },
      { id: "b", turns: [["How should I contact you?", "I served in the Army. Use riley@old.example."], ["Anything to correct?", "Remove that address. I do not have a replacement to share."]], facts: [], question: null },
    ],
    rationale: "Both variants invalidate the old address. Only an explicit replacement supports a new value; an email username is not a full name.",
  },
  {
    id: "relocation-polarity", title: "Conditional relocation versus refusal with travel permission", relation: "meaning_changes", changed_fields: ["relocation"],
    variants: [
      { id: "a", turns: [["Would you relocate?", "I served in the Army. I would relocate only to Denver, and I can travel up to 20 percent."]], facts: [["relocation", "would relocate only to Denver; can travel up to 20 percent", 1, "I would relocate only to Denver, and I can travel up to 20 percent"]], question: null },
      { id: "b", turns: [["Would you relocate?", "I served in the Army. I would not relocate, even to Denver, but I can travel up to 20 percent."]], facts: [["relocation", "would not relocate, even to Denver; can travel up to 20 percent", 1, "I would not relocate, even to Denver, but I can travel up to 20 percent"]], question: null },
    ],
    rationale: "Shared city and travel keywords cannot erase polarity or destination restrictions.",
  },
  {
    id: "rank-versus-degree", title: "Military rank versus explicit education evidence", relation: "meaning_changes", changed_fields: ["masters_degree"],
    variants: [
      { id: "a", turns: [["What qualifications would you like to discuss?", "I served in the Army as a captain. I have not mentioned any degree."]], facts: [["military_service", "Army, captain", 1, "I served in the Army as a captain"]], question: null },
      { id: "b", turns: [["What qualifications would you like to discuss?", "I served in the Army as a captain. I earned a master's in systems engineering."]], facts: [["military_service", "Army, captain", 1, "I served in the Army as a captain"], ["masters_degree", "master's in systems engineering", 1, "I earned a master's in systems engineering"]], question: null },
    ],
    rationale: "Rank cannot supply an unstated degree, graduation year, clearance or civilian title.",
  },
  {
    id: "resolved-versus-unresolved", title: "A later answer resolves the earlier vague claim", relation: "meaning_changes", changed_fields: [], question_decision_changes: true,
    variants: [
      { id: "a", turns: [["Describe your work.", "I served in the Army. I rewrote the test scheduler, and throughput improved a lot."], ["What changed in throughput?", "I do not have a percentage, but it used to take a full shift to finish a batch and now it finishes before lunch."]], facts: [], question: null },
      { id: "b", turns: [["Describe your work.", "I served in the Army. I rewrote the test scheduler, and throughput improved a lot."], ["What changed in throughput?", "The engineers were pleased; I have not explained what changed in throughput."]], facts: [], question: "What concrete change in batch throughput followed your scheduler rewrite?" },
    ],
    rationale: "Concrete qualitative comparisons can resolve impact without a percentage. Praise alone does not state the result. These inputs have no prior suggestion history; do not treat an actual interviewer question as a previously suggested model question.",
  },
  {
    id: "salary-status", title: "Same amounts with current and target status exchanged", relation: "meaning_changes", changed_fields: ["current_salary", "target_salary"],
    variants: [
      { id: "a", turns: [["Tell me about compensation.", "I served in the Army. My current annual base is $150,000, and I am targeting $175,000 annual base."]], facts: [["current_salary", "$150,000 annual base", 1, "My current annual base is $150,000"], ["target_salary", "$175,000 annual base", 1, "I am targeting $175,000 annual base"]], question: null },
      { id: "b", turns: [["Tell me about compensation.", "I served in the Army. My current annual base is $175,000, and I am targeting $150,000 annual base."]], facts: [["current_salary", "$175,000 annual base", 1, "My current annual base is $175,000"], ["target_salary", "$150,000 annual base", 1, "I am targeting $150,000 annual base"]], question: null },
    ],
    rationale: "A lower target is possible. Assign status from speech, not a learned assumption that targets must exceed current pay.",
  },
  {
    id: "paraphrase-invariance", title: "Different wording with the same meaning", relation: "meaning_preserved", changed_fields: [],
    variants: [
      { id: "a", turns: [["Where do you work and when can you start?", "I served in the Army. I currently work at Cedar Defense. I need three weeks after accepting an offer."]], facts: [["current_employer", "Cedar Defense", 1, "I currently work at Cedar Defense"], ["availability", "three weeks after accepting an offer", 1, "I need three weeks after accepting an offer"]], question: null },
      { id: "b", turns: [["Where do you work and when can you start?", "I served in the Army. Cedar Defense is my present employer. Once I accept an offer, allow three weeks before I can join."]], facts: [["current_employer", "Cedar Defense", 1, "Cedar Defense is my present employer"], ["availability", "three weeks after accepting an offer", 1, "Once I accept an offer, allow three weeks before I can join"]], question: null },
    ],
    rationale: "Equivalent wording should preserve field meaning and abstention. Evidence text naturally differs.",
  },
];

function inputsFor(turns, split) {
  const segments = [];
  for (const [index, [interviewer, candidate]] of turns.entries()) {
    const words = candidate.split(/\s+/), boundary = Math.ceil(words.length / 2);
    const fragments = split ? [words.slice(0, boundary).join(" "), words.slice(boundary).join(" ")] : [candidate];
    fragments.forEach((text, fragment) => {
      const order = segments.length;
      segments.push({ id: `chunk-${order + 1}`, date: "2026-10-22", timestamp: `11:${String(order).padStart(2, "0")}:00Z`, startSeconds: order * 60, endSeconds: order * 60 + 30,
        turns: [...(fragment ? [] : [{ speaker: "Interviewer", turnId: index + 1, text: interviewer }]), { speaker: "Candidate", turnId: index + 1, text, responseComplete: fragment === fragments.length - 1 }] });
    });
  }
  const received = split ? segments : [{ ...segments[0], id: "single-preset", timestamp: segments.at(-1).timestamp, endSeconds: segments.at(-1).endSeconds, turns: segments.flatMap((segment) => segment.turns) }];
  return { segments: received, previousSnapshot: [], previousQuestions: [] };
}
groups.push({
  id: "metric-versus-practical-value", title: "A measured result versus explained value and trade-offs", relation: "meaning_changes", changed_fields: [], question_decision_changes: true,
  variants: [
    { id: "a", turns: [["What did you personally improve?", "I served in the Army. I changed the filter and reduced tracking error from 8% to 3%."]], facts: [], question: "What did that improvement enable for the team, and were there any trade-offs?" },
    { id: "b", turns: [["What did you personally improve?", "I served in the Army. I changed the filter and reduced tracking error from 8% to 3%. Operators spent less time reviewing false tracks; the trade-off was a small increase in compute cost, which the team accepted."]], facts: [], question: null },
  ],
  rationale: "A technical metric can leave its practical value unresolved. Ask without presuming savings or a trade-off. Once the candidate states the team benefit and relevant trade-off, abstain rather than asking again.",
});
const compiled = groups.map((group) => {
  const variants = group.variants.map((variant) => {
    const final = Object.fromEntries(fields.map(({ id }) => [id, { value: null, evidence: [] }]));
    final.military_service = { value: "Army", evidence: [{ turn_id: 1, quote: "I served in the Army" }] };
    for (const [id, value, turn_id, quote] of variant.facts) final[id] = { value, evidence: [{ turn_id, quote }] };
    const single = inputsFor(variant.turns, false), multi = inputsFor(variant.turns, true);
    assert.deepEqual(completedResponses(single.segments).map(({ candidate }) => candidate), completedResponses(multi.segments).map(({ candidate }) => candidate));
    for (const input of [single, multi]) assert.equal(reconcileExtraction(final, { ...input, fields }).rejectedExtractions.length, 0);
    return { id: `${group.id}-${variant.id}`, inputs: { single, multi }, expected: { final, questions: { questions: variant.question ? [variant.question] : [] }, acceptable_values: { military_service: [...new Set(["Army", final.military_service.value])], ...(group.id === "relocation-polarity" && variant.id === "b" ? { relocation: ["No", "cannot relocate", "not willing to relocate", final.relocation.value] } : {}) }, supported_detail_reference: { military_service: final.military_service.value } }, turns: variant.turns };
  });
  const actualChanges = fields.filter(({ id }) => variants[0].expected.final[id].value !== variants[1].expected.final[id].value).map(({ id }) => id);
  assert.deepEqual(actualChanges.sort(), [...group.changed_fields].sort());
  assert.equal(Boolean(variants[0].expected.questions.questions.length !== variants[1].expected.questions.questions.length), Boolean(group.question_decision_changes));
  return { id: group.id, scenario_group_id: `calibration-contrast-${group.id}`, split: "calibration_only", review_status: "draft_pending_human_review", field_contract: FIELD_CONTRACT_VERSION,
    domain_scope: "us_veteran_civilian_job_interviews_v1", title: group.title, relation: group.relation, changed_fields: group.changed_fields, question_decision_changes: Boolean(group.question_decision_changes), rationale: group.rationale, variants };
});
const output = { version: "0.1.0", status: "draft_pending_human_review", use_for_training: false, use_for_locked_evaluation: false, groups: compiled };
writeFileSync(new URL("./intent-contrasts.json", import.meta.url), JSON.stringify(output, null, 2) + "\n");
const review = ["# Veteran interview intent contrasts", "", `${compiled.length} related pairs, ${compiled.length * 2} variants. These are calibration-only draft labels, not independent training roots or held-out evaluation. Structural, exact-quote and declared-difference checks pass; human semantic review remains pending. Keep both variants and all chunk versions together in any future split assignment. Example question wording is illustrative, not an exact-match target.`, "", "Review whether only the stated fields/question decision should change. Unlisted fields remain unknown. A model must preserve meaning across the single/multi versions and the final paraphrase pair. These checks reduce reliance on memorized patterns; passing twenty examples cannot establish generalization.", ""];
for (const group of compiled) {
  review.push(`## ${group.title}`, "", `Expected difference: ${group.changed_fields.length ? group.changed_fields.join(", ") : "no extraction value changes"}; question decision ${group.question_decision_changes ? "changes" : "stays the same"}.`, "");
  for (const variant of group.variants) {
    review.push(`**${variant.id}**`, "");
    for (const [question, answer] of variant.turns) review.push(`Interviewer: ${question}`, "", `Candidate: ${answer}`, "");
    for (const { id } of fields) if (variant.expected.final[id].value !== null) review.push(`- ${id}: ${variant.expected.final[id].value}`);
    review.push("", `Question: ${variant.expected.questions.questions[0] || "None."}`, "");
  }
  review.push(`Why: ${group.rationale}`, "", "Review: pending.", "");
}
writeFileSync(new URL("./INTENT_CONTRASTS_REVIEW.md", import.meta.url), review.join("\n") + "\n");
console.log(`Built ${compiled.length} pairs / ${compiled.reduce((count, group) => count + group.variants.length, 0)} variants. Quote provenance, single/multi reconstruction and declared changes checked; semantic review pending.`);
