import test from "node:test";
import assert from "node:assert/strict";
import { validateExtraction, liveExtractionSchema } from "./live-extraction.mjs";
import { fields } from "./field-contract.mjs";
import { valuesMatch, assessReference } from "./quality-scoring.mjs";

const input = {
  fields: [{ id: "email" }, { id: "current_salary" }],
  segments: [{ id: "chunk-1", date: "2026-10-22", timestamp: "10:00:00Z", turns: [
    { speaker: "Interviewer", turnId: 1, text: "Is your email ada@example.com?" },
    { speaker: "Candidate", turnId: 1, responseComplete: true, text: "Stop using my old email. My base is $165,000 plus a $100 monthly allowance." },
  ] }],
  previousSnapshot: [{ fieldId: "email", status: "provided", value: "old@example.com" }],
};
const decision = (operation, value = null, evidence = []) => ({ operation, value, evidence });
const quote = (text) => [{ turn_id: 1, quote: text }];

test("explicit clear removes prior facts and set preserves small currency amounts", () => {
  const before = structuredClone(input);
  const result = validateExtraction({
    email: decision("clear", null, quote("Stop using my old email.")),
    current_salary: decision("set", "$165,000 base plus a $100 monthly allowance", quote("My base is $165,000 plus a $100 monthly allowance.")),
  }, input);
  assert.equal(result.checklistSnapshot[0].value, null);
  assert.equal(result.checklistSnapshot[1].value, "$165,000 base plus a $100 monthly allowance");
  assert.equal(result.checklistChanges.length, 2);
  assert.equal(result.rejectedExtractionUpdates.length, 0);
  assert.deepEqual(input, before);
});

test("unchanged preserves state, explicit clear can remove an unsupported prior value", () => {
  assert.equal(validateExtraction({ email: decision("unchanged"), current_salary: decision("unchanged") }, input).checklistSnapshot[0].value, "old@example.com");
  assert.equal(validateExtraction({ email: decision("clear"), current_salary: decision("unchanged") }, input).checklistSnapshot[0].value, null);
});

test("malformed and legacy outputs are rejected and audited without erasing prior state", () => {
  for (const email of [null, "new@example.com", decision("clear", "erase"), decision("set", "new@example.com"), decision("set", "ada@example.com", quote("Is your email ada@example.com?")), decision("set", "new@example.com", [{ turn_id: 5, quote: "new@example.com" }])]) {
    const result = validateExtraction({ email, current_salary: decision("unchanged") }, input);
    assert.equal(result.checklistSnapshot[0].value, "old@example.com");
    assert.equal(result.rejectedExtractionUpdates.length, 1);
    assert.deepEqual(result.rawExtractionPayload.email, email);
  }
});

test("incomplete candidate fragments cannot support updates", () => {
  const partial = structuredClone(input);
  partial.segments[0].turns[1].responseComplete = false;
  const result = validateExtraction({ email: decision("clear", null, quote("Stop using my old email.")), current_salary: decision("unchanged") }, partial);
  assert.equal(result.checklistSnapshot[0].value, "old@example.com");
  assert.match(result.rejectedExtractionUpdates[0].rejectionReason, /evidence/);
});

test("frozen schema retains all 22 field definitions", () => {
  assert.equal(fields.length, 22);
  assert.ok(fields.every(({ description }) => description.length));
  assert.deepEqual(liveExtractionSchema(fields).required, fields.map(({ id }) => id));
  assert.ok(Object.isFrozen(fields[0]));
});

test("scorer accepts narrow formatting equivalence and rejects lost or changed qualifiers", () => {
  assert.ok(valuesMatch("tenure", "three years", "3 years"));
  assert.ok(valuesMatch("team_size", "twenty-four engineers", "24 engineers"));
  assert.ok(valuesMatch("phone", "(256) 555-0173", "256-555-0173"));
  assert.ok(valuesMatch("current_salary", "$165K base", "$165,000 base"));
  for (const [id, expected, actual] of [
    ["current_title", "senior engineering manager", "engineering manager"],
    ["current_salary", "$165K base plus 10% bonus", "$165K base"],
    ["current_salary", "$165K base plus $100 monthly allowance", "$165K base plus $100K monthly allowance"],
    ["relocation", "would relocate to Denver", "would relocate to Austin"],
    ["relocation", "cannot relocate", "can relocate"],
    ["availability", "three weeks after accepting an offer", "three weeks"],
  ]) assert.equal(valuesMatch(id, expected, actual), false, `${id}: ${actual}`);
});

test("approved concise references do not authorize invented ranks or lost relocation restrictions", () => {
  const accepted = ["Army", "Army captain"];
  assert.deepEqual(assessReference("military_service", "Army", "Army", accepted, "Army captain"), { normalized_reference_match: true, detail_coverage: "concise_reference" });
  assert.deepEqual(assessReference("military_service", "Army", "Army captain", accepted, "Army captain"), { normalized_reference_match: true, detail_coverage: "full_reference" });
  for (const unsupported of ["Army colonel", "Navy captain"]) assert.equal(assessReference("military_service", "Army", unsupported, accepted, "Army captain").normalized_reference_match, false);
  assert.ok(valuesMatch("relocation", "No", "cannot relocate anywhere", ["cannot relocate anywhere"]));
  assert.equal(valuesMatch("relocation", "would relocate only to Denver", "Yes"), false);
  assert.equal(valuesMatch("current_salary", "$90,000", "$90 hourly"), false);
});
