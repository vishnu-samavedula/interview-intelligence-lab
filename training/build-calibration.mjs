/** Hand-authored draft labels for discussion. Never mix these roots into training or locked tests. */
import { readFileSync, writeFileSync } from "node:fs";
import { fields, FIELD_CONTRACT_VERSION } from "../runtime/field-contract.mjs";
import { completedResponses } from "../runtime/transcript-json.mjs";
import { validateExtraction } from "../runtime/live-extraction.mjs";
import { reconcileExtraction } from "../runtime/end-of-call.mjs";
import assert from "node:assert/strict";
import { protectReview, saveReviewState } from "./review-artifact.mjs";

const reviewPath = new URL("./CALIBRATION_REVIEW.md", import.meta.url);
const reviewStatePath = new URL("./calibration-review-state.json", import.meta.url);
const reconciledHash = process.argv.find((argument) => argument.startsWith("--reviewed-input-sha="))?.split("=")[1];
protectReview(reviewPath, reviewStatePath, reconciledHash);
const userEdits = JSON.parse(readFileSync(new URL("./calibration-review-user-edits.json", import.meta.url), "utf8"));
const userEditedIds = new Set(userEdits.edits.map((edit) => edit.id));

// Facts: field, normalized value, supporting turn, exact candidate quote.
const cases = [
  {
    title: "Explicit contact correction", domain: "technical_training", bucket: "correction", difficulty: "easy",
    turns: [["How should I contact you?", "I'm Ada Mensah in Madison. My phone is 608-555-0124. Use ada@old.example."], ["Anything to correct?", "Please replace that email with ada.mensah@example.com."]],
    facts: [["phone", "608-555-0124", 1, "My phone is 608-555-0124"], ["full_name", "Ada Mensah", 1, "I'm Ada Mensah"], ["location", "Madison", 1, "in Madison"], ["email", "ada.mensah@example.com", 2, "replace that email with ada.mensah@example.com"]],
    prior: { email: "ada@old.example" }, ask: null,
    rationale: "Use the replacement address. Contact corrections do not warrant achievement questions.",
  },
  {
    title: "Retraction without replacement", domain: "logistics_operations", bucket: "retraction", difficulty: "medium",
    turns: [["May I record your contact details?", "My phone is 202-555-0148."], ["Is that still the best number?", "Actually, remove that number. I don't have a replacement to share yet."]],
    facts: [["area_of_interest", "civilian logistics roles", 1, "exploring civilian logistics roles"]], prior: { phone: "202-555-0148" }, clears: { phone: [2, "remove that number"] }, ask: null,
    rationale: "Clear the old number; do not preserve it or infer a replacement. The explicitly explored civilian logistics roles support area_of_interest, but this contact exchange does not need a career follow-up.",
  },
  {
    title: "Former program versus current employment", domain: "systems_engineering", bucket: "temporal", difficulty: "medium",
    turns: [["Where did you work previously?", "I was a flight software engineer at Alder Avionics on the Sparrow program."], ["And now?", "I'm currently a systems architect at Cobalt Aero. I haven't named my current program."]],
    facts: [["current_employer", "Cobalt Aero", 2, "currently a systems architect at Cobalt Aero"], ["current_title", "systems architect", 2, "currently a systems architect"]],
    prior: { current_program: "Sparrow" }, clears: { current_program: [] }, ask: "What did you build and contribute during your time at Alder avionics?", category: "explore_role_or_interest",
    rationale: "Sparrow is historical, so clear its unsupported current-field assignment. A useful follow-up can explore the contribution in the explicitly mentioned former role; it does not imply any achievement or current program.",
  },
  {
    title: "Title promotion and tenure", domain: "intelligence_analysis", bucket: "correction", difficulty: "easy",
    turns: [["What is your position?", "I've worked at Fern Defense for three years as an analyst."], ["Is that your current title?", "I was promoted last month; my current title is senior analyst."]],
    facts: [["current_employer", "Fern Defense", 1, "worked at Fern Defense for three years"], ["tenure", "three years", 1, "worked at Fern Defense for three years"], ["current_title", "senior analyst", 2, "my current title is senior analyst"]],
    prior: { current_title: "analyst" }, ask: "Your areas of interest during your time as an analyst?", category: "explore_role_or_interest", rationale: "Use the promoted title and current-employer tenure. Exploring interests within the stated analyst role is a relevant career follow-up even without a vague achievement. The question itself does not establish a future area of interest.",
  },
  {
    title: "Current and target pay with a small allowance", domain: "maintenance_avionics", bucket: "compensation", difficulty: "hard",
    turns: [["What are you targeting?", "My current base is $165,000 annually plus a $100 monthly allowance."], ["And for your next role?", "I'm targeting $185,000 annual base plus a 12 percent bonus, with no equity requirement."]],
    facts: [["current_salary", "$165,000 annual base plus a $100 monthly allowance", 1, "current base is $165,000 annually plus a $100 monthly allowance"], ["target_salary", "$185,000 annual base plus a 12 percent bonus; no equity requirement", 2, "targeting $185,000 annual base plus a 12 percent bonus, with no equity requirement"]],
    ask: null, rationale: "Do not turn the $100 allowance into $100,000. Preserve units and all target qualifiers; the interviewer wording does not determine current versus target.",
  },
  {
    title: "Salary shorthand in a US job interview", domain: "technical_training", bucket: "ambiguity", difficulty: "hard",
    turns: [["What compensation would you want?", "For my next role, around 90."]],
    facts: [["target_salary", "$90,000", 1, "For my next role, around 90."], ["area_of_interest", "civilian technical training work", 1, "considering civilian technical training work"]],
    ask: null, rationale: "In this user-reviewed US job-interview salary context, around 90 means $90,000. The explicit uncertainty sentence was removed by the user. This convention does not scale small allowances or override hourly/foreign-currency cues. The stated technical-training interest is also extractable; no compensation follow-up is needed.",
  },
  {
    title: "Destination constraint and later negation", domain: "program_project_management", bucket: "negation", difficulty: "hard",
    turns: [["Would you move?", "I would relocate only to Denver."], ["Any update?", "I can no longer relocate anywhere. I can travel up to 20 percent, and I need six weeks after accepting an offer."]],
    facts: [["relocation", "No", 2, "can no longer relocate anywhere. I can travel up to 20 percent"], ["availability", "six weeks after accepting an offer", 2, "need six weeks after accepting an offer"]],
    prior: { relocation: "would relocate only to Denver" }, ask: null,
    rationale: "No correctly captures the latest relocation refusal and supersedes Denver. Travel permission is not relocation willingness. Preserve the start-date condition in availability.",
  },
  {
    title: "Education and expired clearance", domain: "systems_engineering", bucket: "status", difficulty: "medium",
    turns: [["Tell me about education and service.", "I earned a bachelor's in physics in 2017 and a master's in applied mathematics in 2019. I served in the Navy from 2010 to 2014."], ["Do you hold a clearance?", "My Secret clearance expired in 2020; I don't currently hold a clearance."]],
    facts: [["bachelors_degree", "bachelor's in physics", 1, "bachelor's in physics"], ["bachelors_year", "2017", 1, "bachelor's in physics in 2017"], ["masters_degree", "master's in applied mathematics", 1, "master's in applied mathematics"], ["masters_year", "2019", 1, "master's in applied mathematics in 2019"], ["military_service", "Navy, 2010–2014", 1, "served in the Navy from 2010 to 2014"]],
    prior: { security_clearance: "Secret" }, clears: { security_clearance: [2, "don't currently hold a clearance"] }, ask: null,
    rationale: "Education years attach to their degrees. Expired clearance must not populate currently-held clearance.",
  },
  {
    title: "Contribution, result and team value already clear", domain: "quality_test", bucket: "complete_achievement", difficulty: "easy",
    turns: [["What did you accomplish?", "I redesigned our acceptance checks and reduced rework from 18 to 11 percent over six months. That freed two technicians for other tasks without changing acceptance standards."]],
    facts: [], ask: null, rationale: "Contribution, result and operational value are clear, including unchanged acceptance standards. Do not ask a generic value or methodology question that repeats this information.",
  },
  {
    title: "Previously suggested follow-up is not repeated", domain: "software_cyber", bucket: "duplicate", difficulty: "medium",
    turns: [["How did the rollout go?", "I led the network rollout. It was a huge success."]], facts: [],
    history: ["What measurable result did the rollout achieve?"], ask: null,
    rationale: "The outcome is vague, but the same question has already been suggested. Do not rephrase it to evade duplication.",
  },
  {
    title: "Vague impact with clear ownership", domain: "software_cyber", bucket: "quantification", difficulty: "easy",
    turns: [["What did you personally do?", "I'm a backend engineer at Juniper Mission Systems. I rewrote the cache layer in Rust and made the service much faster."]],
    facts: [["current_employer", "Juniper Mission Systems", 1, "backend engineer at Juniper Mission Systems"], ["current_title", "backend engineer", 1, "I'm a backend engineer"], ["key_technologies", "Rust", 1, "rewrote the cache layer in Rust"]],
    ask: "How much faster did the service become after your cache rewrite?", category: "quantify_impact",
    rationale: "Ownership is explicit; the size of the performance improvement is missing.",
  },
  {
    title: "Quantified team result without personal contribution", domain: "logistics_operations", bucket: "ownership", difficulty: "medium",
    turns: [["Tell me about a recent result.", "Our team reduced late spare-parts deliveries by 30 percent last quarter. I worked in that group."]], facts: [["area_of_interest", "civilian logistics", 1, "transitioning out of the Marine Corps into civilian logistics"]],
    ask: "What did you personally contribute to reducing late spare-parts deliveries?", category: "clarify_vague_claim",
    rationale: "The result is quantified, but group membership does not establish individual contribution.",
  },
  {
    title: "Unclear nature of impact", domain: "technical_training", bucket: "impact", difficulty: "medium",
    turns: [["Describe your own work.", "I created a new maintenance training process. It made a real difference to our trainees."]], facts: [],
    ask: "What changed for trainees because of your maintenance training process?", category: "clarify_vague_claim",
    rationale: "Clarify the claimed benefit before demanding a numerical metric.",
  },
  {
    title: "A later answer resolves the earlier claim", domain: "maintenance_avionics", bucket: "resolved", difficulty: "medium",
    turns: [["Tell me about the team result.", "We dramatically reduced aircraft maintenance turnaround."], ["What was your contribution?", "I automated the work-order checks; that cut average turnaround from ten days to six in the first quarter."], ["Any other improvement?", "I also changed our inspection workflow, which made inspections much more reliable."]], facts: [],
    ask: "How did inspection reliability change after your workflow changes?", category: "quantify_impact",
    rationale: "Do not ask about resolved maintenance turnaround. The newer inspection outcome remains vague.",
  },
  {
    title: "Several opportunities, choose one", domain: "program_project_management", bucket: "selection", difficulty: "hard",
    turns: [["What have you delivered?", "I redesigned our scheduling process and reduced idle time substantially. We also improved supplier relationships."], ["Which was your main responsibility?", "I personally owned scheduling; another manager led the supplier work."]], facts: [],
    ask: "How much did idle time decrease after your scheduling changes?", category: "quantify_impact",
    rationale: "One question on the candidate-owned result is preferable to probing someone else's work or emitting two questions.",
  },
  {
    title: "Program and tools are distinct", domain: "intelligence_analysis", bucket: "field_assignment", difficulty: "medium",
    turns: [["What is your current assignment?", "I'm a data engineer at Willow Defense on the Lantern readiness reporting program. I use SQL and dbt."], ["What did you improve?", "I rebuilt the reconciliation models, and reporting accuracy improved considerably."]],
    facts: [["current_title", "data engineer", 1, "I'm a data engineer"], ["current_employer", "Willow Defense", 1, "at Willow Defense"], ["current_program", "Lantern readiness reporting program", 1, "on the Lantern readiness reporting program"], ["key_technologies", "SQL and dbt", 1, "I use SQL and dbt"]],
    ask: "What change in reporting accuracy followed your reconciliation rebuild?", category: "quantify_impact",
    rationale: "Do not label Lantern as a technology. Ask about the unquantified accuracy outcome.",
  },
  {
    title: "Direct reports versus contributors", domain: "quality_test", bucket: "qualifiers", difficulty: "hard",
    turns: [["Who do you lead?", "I'm a test manager at Fieldstone Test Systems. I have four direct reports and coordinate with twelve contractor contributors."], ["What did your group achieve?", "We made a breakthrough in test reliability this quarter."]],
    facts: [["current_title", "test manager", 1, "I'm a test manager"], ["current_employer", "Fieldstone Test Systems", 1, "at Fieldstone Test Systems"], ["team_size", "four direct reports; twelve contractor contributors", 1, "four direct reports and coordinate with twelve contractor contributors"]],
    ask: "What was your personal contribution to the test-reliability breakthrough?", category: "clarify_vague_claim",
    rationale: "Do not conflate contributors with direct reports. Either ownership clarification or a concrete reliability-result question is acceptable; emit one.",
  },
  {
    title: "Interest and motivation explicitly stated", domain: "systems_engineering", bucket: "intent", difficulty: "medium",
    turns: [["Why consider leaving, and what interests you?", "I'm leaving because my employer is closing our division. I want to work on mission systems integration."], ["Tell me about your work.", "I designed a maintenance interface that technicians said was much easier to use."]],
    facts: [["reason_for_leaving", "employer is closing the division", 1, "leaving because my employer is closing our division"], ["area_of_interest", "mission systems integration", 1, "want to work on mission systems integration"]],
    ask: "What concrete improvement did technicians report after using your maintenance interface?", category: "quantify_impact",
    rationale: "Ask for a concrete outcome without inventing a measured lift. User feedback or a concrete qualitative example can satisfy the opportunity; do not require a percentage.",
  },
  {
    title: "Interviewer assertion corrected by the candidate", domain: "logistics_operations", bucket: "attribution", difficulty: "hard",
    turns: [["You're the director at Beacon Defense, correct?", "No. I'm a planner at Harbor Defense."], ["What did you accomplish?", "I redesigned the maintenance schedule and reliability improved significantly."]],
    facts: [["current_title", "planner", 1, "I'm a planner at Harbor Defense"], ["current_employer", "Harbor Defense", 1, "I'm a planner at Harbor Defense"]],
    ask: "How did maintenance reliability change after your scheduling redesign?", category: "quantify_impact",
    rationale: "The candidate corrects the interviewer's assertion. Extract Harbor Defense and planner, not Beacon Defense or director. Follow up on the candidate's actual maintenance-reliability claim; the removed test-document sentence must not reappear.",
  },
  {
    title: "Partial response and future facts withheld", domain: "maintenance_avionics", bucket: "chunk_boundary", difficulty: "hard",
    turns: [["What is your current role?", "I'm a test engineer at Silverleaf Avionics, and I hold an active Secret clearance."], ["What have you improved?", "I introduced automated bench checks in Python, and throughput improved dramatically."]],
    trailingPartial: "I'm not", continuation: " willing to relocate, and I need four weeks after an offer.",
    facts: [["current_title", "test engineer", 1, "I'm a test engineer"], ["current_employer", "Silverleaf Avionics", 1, "at Silverleaf Avionics"], ["security_clearance", "active Secret clearance", 1, "hold an active Secret clearance"], ["key_technologies", "Python", 2, "automated bench checks in Python"]],
    ask: "How much did throughput improve after your automated bench checks?", category: "quantify_impact",
    rationale: "At the labeled incremental cutoff, only the first two complete answers are usable. The next response is incomplete; do not infer relocation or availability from unseen continuation. A click containing only this fragment must skip inference and retain the preceding results.",
  },
];

const veteranContexts = [["I served in the Army from 2012 to 2020.", "Army, 2012–2020"], ["Since leaving the Navy, I have been exploring civilian logistics roles.", "Navy"], ["Before my contracting roles, I served in the Air Force.", "Air Force"], ["My background includes six years in the Army.", "Army, six years"], ["I left active duty in the Air Force in 2021.", "Air Force, active duty ended 2021"], ["I am a Coast Guard veteran considering civilian technical training work.", "Coast Guard"], ["I served four years in the Marine Corps before moving into contracting.", "Marine Corps, four years"], null, ["My testing background began during my Air Force service.", "Air Force"], ["After serving in the Space Force, I moved into contractor network work.", "Space Force"], ["I served in the Army before becoming a civilian software engineer.", "Army"], ["I am transitioning out of the Marine Corps into civilian logistics.", "Marine Corps, transitioning out"], ["I taught maintenance courses while serving in the Army.", "Army, taught maintenance courses"], ["I served in the Navy before joining the aircraft maintenance contractor.", "Navy"], ["During my Coast Guard service I coordinated maintenance schedules.", "Coast Guard, coordinated maintenance schedules"], ["I previously served in the Marine Corps as an analyst.", "Marine Corps, analyst"], ["I served in the Army before working in civilian test operations.", "Army"], ["I am an Air Force veteran now working in defense contracting.", "Air Force"], ["The Navy was my first employer; these are my subsequent civilian roles.", "Navy"], ["I served in the Air Force before this civilian avionics role.", "Air Force"]];
for (let index = 0; index < cases.length; index++) {
  const context = veteranContexts[index];
  if (!context) continue;
  cases[index].turns[0][1] = `${context[0]} ${cases[index].turns[0][1]}`;
  cases[index].facts.push(["military_service", context[1], 1, context[0]]);
}

function segmentsFor(turns, multi) {
  const segments = [];
  for (let index = 0; index < turns.length; index++) {
    const [interviewer, candidate] = turns[index];
    const words = candidate.split(/\s+/);
    const pieces = multi && words.length > 8 ? [words.slice(0, Math.floor(words.length / 2)).join(" "), words.slice(Math.floor(words.length / 2)).join(" ")] : [candidate];
    pieces.forEach((text, piece) => {
      const order = segments.length;
      segments.push({ id: `chunk-${order + 1}`, date: "2026-10-22", timestamp: `10:${String(order).padStart(2, "0")}:00Z`, startSeconds: order * 60, endSeconds: order * 60 + 30,
        turns: [...(piece === 0 ? [{ speaker: "Interviewer", text: interviewer, turnId: index + 1 }] : []), { speaker: "Candidate", text, turnId: index + 1, responseComplete: piece === pieces.length - 1 }] });
    });
  }
  return multi ? segments : [{ ...segments[0], id: "single-preset", timestamp: segments.at(-1).timestamp, endSeconds: segments.at(-1).endSeconds, turns: segments.flatMap((segment) => segment.turns) }];
}

const examples = cases.map((item, index) => {
  const acceptableValues = {}, detailReferences = {};
  for (const fact of item.facts) {
    if (fact[0] !== "military_service") continue;
    const rich = fact[1];
    const branch = ["Marine Corps", "Coast Guard", "Space Force", "Air Force", "Army", "Navy"].find((name) => rich.startsWith(name));
    assert.ok(branch);
    fact[1] = branch;
    acceptableValues.military_service = [...new Set([branch, rich])];
    detailReferences.military_service = rich;
  }
  if (item.facts.some(([id]) => id === "relocation")) {
    acceptableValues.relocation = ["No", "cannot relocate anywhere", "not willing to relocate", "cannot relocate anywhere; can travel up to 20 percent"];
    detailReferences.relocation = "No";
  }
  const final = Object.fromEntries(fields.map(({ id }) => [id, { value: null, evidence: [] }]));
  for (const [id, value, turn_id, quote] of item.facts) { assert.ok(id in final); final[id] = { value, evidence: [{ turn_id, quote }] }; }
  const previousSnapshot = Object.entries(item.prior || {}).map(([fieldId, value]) => ({ fieldId, value, status: "provided" }));
  const prior = new Map(previousSnapshot.map((field) => [field.fieldId, field.value]));
  const live = Object.fromEntries(fields.map(({ id }) => {
    const fact = final[id];
    const clear = item.clears?.[id];
    return [id, fact.value !== null ? { operation: fact.value === prior.get(id) ? "unchanged" : "set", value: fact.value === prior.get(id) ? null : fact.value, evidence: fact.value === prior.get(id) ? [] : fact.evidence }
      : prior.has(id) ? { operation: "clear", value: null, evidence: clear?.length ? [{ turn_id: clear[0], quote: clear[1] }] : [] }
      : { operation: "unchanged", value: null, evidence: [] }];
  }));
  const single = segmentsFor(item.turns, false), multi = segmentsFor(item.turns, true);
  assert.deepEqual(completedResponses(single).map(({ candidate }) => candidate), completedResponses(multi).map(({ candidate }) => candidate));
  const expectedQuestions = { questions: item.ask ? [item.ask] : [] };
  for (const segments of [single, multi]) {
    const input = { fields, segments, previousSnapshot };
    const result = validateExtraction(live, input);
    assert.equal(result.rejectedExtractionUpdates.length, 0);
    assert.equal(reconcileExtraction(final, input).rejectedExtractions.length, 0);
    for (const field of result.checklistSnapshot) assert.equal(field.value, final[field.fieldId].value);
  }
  return { id: `calibration-${String(index + 1).padStart(2, "0")}`, status: userEditedIds.has(`calibration-${String(index + 1).padStart(2, "0")}`) ? "user_edits_applied_pending_full_case_review" : "assistant_revised_pending_user_review", author: "assistant_hand_authored", split: "calibration_only", field_contract: FIELD_CONTRACT_VERSION,
    title: item.title, domain_scope: "us_veteran_civilian_job_interviews_v1", domain_role_family: item.domain, primary_bucket: item.bucket, difficulty: item.difficulty,
    inputs: { single, multi, previousSnapshot, previousQuestions: (item.history || []).map((question) => ({ question })) },
    expected: { live, final, question: expectedQuestions, question_category: item.category || null, acceptable_values: acceptableValues, supported_detail_reference: detailReferences },
    review_provenance: { user_edited: userEditedIds.has(`calibration-${String(index + 1).padStart(2, "0")}`), original_user_document_sha256: userEdits.sha256, semantic_approval: "pending" },
    rationale: item.rationale,
    ...(item.trailingPartial ? { boundary_probe: { received_partial: item.trailingPartial, unseen_continuation: item.continuation, expected_action: "buffer_without_inference", finalization_at_partial_cutoff: "Not labeled by this example; final mode may consume partial text and needs its own label." } } : {}),
  };
});
assert.equal(examples.length, 20);
const askCount = examples.filter((item) => item.expected.question.questions.length).length;
assert.ok(examples.every((item) => item.expected.question.questions.length <= 1));
const coveredFields = new Set(cases.flatMap((item) => item.facts.map(([id]) => id)));
assert.deepEqual([...coveredFields].sort(), fields.map(({ id }) => id).sort());
writeFileSync(new URL("./calibration-v1.json", import.meta.url), JSON.stringify({ version: "0.3.0", domain_scope: "us_veteran_civilian_job_interviews_v1", status: "draft_pending_human_review", use_for_training: false, use_for_locked_evaluation: false, examples }, null, 2) + "\n");
const review = ["# Calibration review: 20 draft conversations", "", `These calibration cases incorporate the user’s edits and assistant-applied consistency fixes. They are not training data or held-out evaluation. Labels pass structural/quote checks; unchanged cases are not assumed approved. Each root has equivalent single/multi inputs. Coverage: 22 fields, eight veteran-interview role families, ${askCount} ask/${examples.length - askCount} abstain. Calibration decisions follow meaning rather than a forced 50/50 quota; the production corpus balance remains a separate gate.`, "", "Review the expected meaning, required qualifiers and ask/abstain decision. Example question wording is illustrative; equivalent useful wording is acceptable. All unlisted extraction fields are unknown. Military background does not imply a degree, clearance, technical skill or civilian title. Questions may explore contribution or interests in an explicitly stated current/former role, or unresolved work impact, value and trade-offs. No invented premise or generic checklist-filling question. Concise service values and No for relocation can be correct; preserve optional detail separately. The reviewed US salary shorthand can expand to thousands when context supports it. For each case, mark accept or record the correction. User edits in cases 1, 3–8 and 19 have been carried into the source labels; reasons and related examples have been aligned. Applied corrections do not mark an entire case approved.", "", "| Case | Accept / changes |", "| --- | --- |", ...examples.map((item) => `| ${item.id}: ${item.title} | ${item.review_provenance.user_edited ? "User edits applied; full case pending" : "Consistency revised; review pending"} |`), ""];
for (let index = 0; index < cases.length; index++) {
  const item = cases[index], example = examples[index];
  review.push(`## ${example.id}: ${item.title}`, "");
  item.turns.forEach(([question, answer], turn) => review.push(`**Turn ${turn + 1} — Interviewer:** ${question}`, "", `**Candidate:** ${answer}`, ""));
  if (item.prior) review.push(`Prior checklist: ${JSON.stringify(item.prior)}.`, "");
  if (item.history) review.push(`Previously suggested: ${item.history.join(" ")}`, "");
  review.push("Expected extraction:", "", ...(item.facts.length ? item.facts.map(([id, value]) => `- **${id}:** ${value}`) : ["- No populated fields."]), ...(item.prior ? Object.keys(item.prior).filter((id) => example.expected.live[id].operation === "clear").map((id) => `- **${id}:** clear the previous value.`) : []), "", `**Question:** ${item.ask || "None."}`, "", `**Reason:** ${item.rationale}`, "");
  if (example.expected.acceptable_values.military_service?.length > 1) review.push(`**Also correct for military_service:** ${example.expected.acceptable_values.military_service.slice(1).join("; ")}. Branch-only is accepted; this fuller reference preserves more stated detail.`, "");
  if (example.expected.acceptable_values.relocation) review.push("**Also correct for relocation:** cannot relocate anywhere; not willing to relocate. Travel permission does not change the refusal.", "");
  if (item.trailingPartial) review.push(`**Boundary probe:** the next click contains only “${item.trailingPartial}”, marked incomplete. Buffer it without inference. The withheld continuation is stored separately for test construction and must never be supplied to a cutoff example.`, "");
}
const reviewText = review.join("\n") + "\n";
writeFileSync(reviewPath, reviewText);
saveReviewState(reviewStatePath, reviewText);
console.log(`Wrote ${examples.length} draft roots, single/multi variants, 22-field coverage and ${askCount} ask/${examples.length - askCount} abstain labels. Structural/evidence checks passed; human semantic review pending.`);
