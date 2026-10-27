import test from "node:test";
import assert from "node:assert/strict";
import { finalExtractionSchema, reconcileExtraction, validateSummary, summaryMessages } from "./end-of-call.mjs";
import { extractionMessages } from "./model-prompts.mjs";
import { multiChunkCases } from "../web/lib/static-cases.ts";

const scenario = multiChunkCases.find((item) => item.id === "static-original-document");
const input = {
  segments: scenario.segments,
  fields: [{ id: "current_employer" }, { id: "reason_for_leaving" }],
  previousSnapshot: [{ fieldId: "current_employer", status: "provided", value: "RTX" }, { fieldId: "reason_for_leaving", status: "provided", value: "Seeking a new opportunity" }],
};
const payload = {
  current_employer: { value: "Torch Technologies", evidence: [{ turn_id: 2, quote: "a company called Torch Technologies here in Huntsville" }] },
  reason_for_leaving: { value: null, evidence: [] },
};

test("final reconciliation corrects and clears live values without mutating the live snapshot", () => {
  const before = structuredClone(input);
  const result = reconcileExtraction(payload, input);
  assert.equal(result.finalSnapshot[0].value, "Torch Technologies");
  assert.equal(result.finalSnapshot[1].value, null);
  assert.deepEqual(result.changes, [{ fieldId: "current_employer", before: "RTX", after: "Torch Technologies" }, { fieldId: "reason_for_leaving", before: "Seeking a new opportunity", after: null }]);
  assert.deepEqual(result.missingFieldIds, ["reason_for_leaving"]);
  assert.ok(result.finalSnapshot[0].evidence[0].chunkIds.length > 1);
  assert.deepEqual(input, before);
});

test("fabricated, interviewer-only, and incorrectly attributed evidence cannot support a final value", () => {
  for (const evidence of [[], [{ turn_id: 2, quote: "I love my new employer" }], [{ turn_id: 2, quote: "So after the Army, what did you move into?" }], [{ turn_id: 1, quote: "Torch Technologies" }]]) {
    const result = reconcileExtraction({ ...payload, current_employer: { value: "Torch Technologies", evidence } }, input);
    assert.equal(result.finalSnapshot[0].value, null);
    assert.equal(result.rejectedExtractions[0].reason, "No matching candidate evidence");
  }
});

test("malformed extraction or summary fails instead of returning a misleading successful report", () => {
  assert.throws(() => reconcileExtraction({}, input), /Invalid final extraction/);
  assert.throws(() => validateSummary({ summary: "", key_points: [], unresolved_questions: [] }), /Invalid/);
  assert.throws(() => validateSummary({ summary: "Summary", key_points: [42], unresolved_questions: [] }), /Invalid/);
  assert.deepEqual(validateSummary({ summary: "Summary", key_points: ["Fact"], unresolved_questions: [] }), { summary: "Summary", keyPoints: ["Fact"], unresolvedQuestions: [] });
  assert.deepEqual(finalExtractionSchema(input.fields).required, ["current_employer", "reason_for_leaving"]);
});

test("final extraction expands clear annual-pay shorthand and preserves raw model text", () => {
  const result = reconcileExtraction({ current_salary: { value: "178 base plus a 10 to 15 percent bonus", evidence: [{ turn_id: 4, quote: "My current total comp is around 178 base with a bonus that runs 10 to 15 percent." }] } }, { ...input, fields: [{ id: "current_salary" }] });
  assert.equal(result.finalSnapshot[0].value, "$178,000 base plus a 10 to 15 percent bonus");
  assert.equal(result.rawExtractionPayload.current_salary.value, "178 base plus a 10 to 15 percent bonus");
});

test("final prompts include the full received transcript and never anchor extraction to live values", () => {
  const partial = { ...input, segments: scenario.segments.slice(0, 7), finalize: true };
  const prompt = extractionMessages(partial)[0].content;
  assert.ok(prompt.includes('"candidate": "I\'m not"'));
  assert.ok(prompt.includes('"turn_id": 1'));
  assert.equal(prompt.includes("Seeking a new opportunity"), false);
  const summary = summaryMessages(partial, reconcileExtraction(payload, input).finalSnapshot)[0].content;
  assert.ok(summary.includes("I'm not"));
  assert.ok(summary.includes("Torch Technologies"));
});
