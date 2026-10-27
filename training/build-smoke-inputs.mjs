import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fields } from "../runtime/field-contract.mjs";
import { extractionMessages, questionMessages } from "../runtime/model-prompts.mjs";
import { validateExtraction } from "../runtime/live-extraction.mjs";
import { reconcileExtraction } from "../runtime/end-of-call.mjs";
import { digest } from "./corpus-audit.mjs";

// Deliberately separate from all 20 calibration roots. Tiny overfit fixtures, never quality evidence.
const seeds = [
  ["My preferred email is mira@sample.example.", "email", "mira@sample.example", "live"],
  ["I need five weeks after accepting an offer.", "availability", "five weeks after accepting an offer", "live"],
  ["My current annual base is $142,000.", "current_salary", "$142,000 annual base", "final"],
  ["I am a controls engineer at Oriole Machines.", "current_employer", "Oriole Machines", "final"],
];
function inputFor(text, index) {
  return { fields, segments: [{ id: `smoke-chunk-${index}`, date: "2026-10-22", timestamp: "12:00:00Z", startSeconds: 0, endSeconds: 30, turns: [
    { speaker: "Interviewer", turnId: 1, text: "Tell me about that.", },
    { speaker: "Candidate", turnId: 1, text, responseComplete: true },
  ] }], previousSnapshot: [], previousQuestions: [] };
}
const records = seeds.map(([text, field, value, mode], index) => {
  const input = inputFor(text, index), evidence = [{ turn_id: 1, quote: text }];
  const target = Object.fromEntries(fields.map(({ id }) => [id, mode === "live" ? { operation: "unchanged", value: null, evidence: [] } : { value: null, evidence: [] }]));
  target[field] = mode === "live" ? { operation: "set", value, evidence } : { value, evidence };
  if (field === "current_employer") target.current_title = { value: "controls engineer", evidence };
  assert.equal(mode === "live" ? validateExtraction(target, input).rejectedExtractionUpdates.length : reconcileExtraction(target, input).rejectedExtractions.length, 0);
  return { id: `smoke-extraction-${index}`, task: "extraction", mode, messages: extractionMessages({ ...input, finalize: mode === "final" }), target };
});
const questions = [
  ["I wrote a new query planner in Go, and the searches became much faster.", "How much faster did searches become after your query-planner changes?"],
  ["Our group reduced delivery errors by 18 percent. I was part of the group.", "What did you personally contribute to reducing delivery errors?"],
  ["I automated the billing checks and cut processing time from six hours to two hours per week.", null],
  ["My email is alex@sample.example. I can start in two weeks.", null],
];
questions.forEach(([text, question], index) => records.push({ id: `smoke-questions-${index}`, task: "questions", mode: "questions", messages: questionMessages(inputFor(text, index + 4)), target: { questions: question ? [question] : [] } }));
for (const record of records) { record.messages_hash = digest(record.messages); record.target_hash = digest(record.target); }
writeFileSync(new URL("./smoke-inputs.json", import.meta.url), JSON.stringify({ status: "smoke_only_not_training_corpus_or_quality_evidence", records }, null, 2) + "\n");
console.log(`Built ${records.length} smoke-only examples using the exact serving prompt factories.`);
