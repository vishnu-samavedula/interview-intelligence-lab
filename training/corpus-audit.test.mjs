import test from "node:test";
import assert from "node:assert/strict";
import { fields, FIELD_CONTRACT_VERSION } from "../runtime/field-contract.mjs";
import { extractionMessages } from "../runtime/model-prompts.mjs";
import { auditCorpus, auditSchedule, concentration, digest, validateRow } from "./corpus-audit.mjs";

function fixture(overrides = {}) {
  const segments = [{ id: "chunk-1", date: "2026-10-22", timestamp: "10:00:00Z", startSeconds: 0, endSeconds: 15, turns: [
    { speaker: "Interviewer", turnId: 1, text: "Who are you?" }, { speaker: "Candidate", turnId: 1, text: "I'm Mara Chen in Salem.", responseComplete: true },
  ] }];
  const target = Object.fromEntries(fields.map(({ id }) => [id, { operation: "unchanged", value: null, evidence: [] }]));
  target.full_name = { operation: "set", value: "Mara Chen", evidence: [{ turn_id: 1, quote: "I'm Mara Chen" }] };
  const row = {
    example_id: "unit-example-1", root_id: "unit-root-1", scenario_group_id: "unit-group-1", split: "train", task: "extraction", mode: "live", template_family: "introduction", domain_scope: "us_veteran_civilian_job_interviews_v1", domain_role_family: "technical_training",
    generator_model: "anthropic/claude-haiku-4.5", generator_provider: "unit-test-provider", generator_prompt_version: "unit-v1", generator_request_id: "unit-request-1", annotation_version: "unit-rubric-1",
    difficulty: "easy", primary_bucket: "direct_facts", wording_pattern: "introduction", tokenizer_id: "unit-test-tokenizer", tokenizer_revision: "unit-test-only", chat_template_hash: "unit-test-only",
    field_contract: FIELD_CONTRACT_VERSION, field_definitions: fields, source_segments: segments, input: { segments, previousSnapshot: [], previousQuestions: [] }, target,
    prompt_tokens: 100, target_tokens: 20, sample_weight: 1, truncated: false,
    review_status: "accepted", annotation_disagreement_resolved: true, contains_expected_answer_scaffolding: false, semantic_support_review: "accepted",
    review: { type: "human", reviewer_id: "UNIT_TEST_FIXTURE_NOT_A_REAL_REVIEW" }, entities: { person: ["Mara Chen"], employer: [], location: ["Salem"] }, visible_through_response: 1,
    ...overrides,
  };
  row.rendered_transcript_hash = digest(row.source_segments);
  row.messages = extractionMessages({ ...row.input, fields }); row.messages_hash = digest(row.messages); row.target_hash = digest(row.target);
  row.review = { ...row.review, reviewed_transcript_hash: row.rendered_transcript_hash, reviewed_target_hash: row.target_hash };
  return row;
}
const failures = (report, code) => report.failures.filter((failure) => failure.code === code);

test("valid-shaped fixture passes structure checks without claiming a released corpus", () => {
  const row = fixture();
  assert.deepEqual(validateRow(row), []);
  const result = auditCorpus([row]);
  assert.ok(failures(result, "row_quota").length);
  assert.equal(result.release_eligible, false);
  assert.ok(result.outstanding_gates.some((gate) => /Semantic duplicate/.test(gate)));
});

test("draft labels, stale reviews, prompt contamination and truncation are rejected", () => {
  const mutations = [
    (row) => { row.review_status = "pending"; },
    (row) => { row.review.reviewed_target_hash = "stale"; },
    (row) => { row.messages[0].content += " Expected answer: Mara Chen"; row.messages_hash = digest(row.messages); },
    (row) => { row.input.expected_answer = "Mara Chen"; },
    (row) => { row.truncated = true; },
    (row) => { row.field_definitions = []; },
    (row) => { row.domain_scope = "general_interviews"; },
    (row) => { row.domain_role_family = "retail"; },
    (row) => { row.prompt_tokens = 8192; },
    (row) => { row.input.segments = [null]; },
  ];
  for (const mutate of mutations) { const row = fixture(); mutate(row); assert.ok(validateRow(row).length); }
  assert.ok(validateRow(null).length);
});

test("future evidence cannot support the visible prefix", () => {
  const row = fixture();
  row.source_segments = [...row.source_segments, { ...row.source_segments[0], id: "chunk-2", timestamp: "10:01:00Z", startSeconds: 60, endSeconds: 75, turns: [
    { speaker: "Interviewer", turnId: 2, text: "What's your employer?" }, { speaker: "Candidate", turnId: 2, responseComplete: true, text: "I work at Cobalt Labs." },
  ] }];
  row.rendered_transcript_hash = digest(row.source_segments); row.review.reviewed_transcript_hash = row.rendered_transcript_hash;
  row.target.current_employer = { operation: "set", value: "Cobalt Labs", evidence: [{ turn_id: 2, quote: "I work at Cobalt Labs." }] };
  row.target_hash = digest(row.target); row.review.reviewed_target_hash = row.target_hash;
  assert.ok(validateRow(row).some((error) => /candidate evidence/.test(error)));
});

test("split leakage is detected even when metadata IDs and names differ", () => {
  const left = fixture();
  const right = fixture({ example_id: "unit-2", root_id: "unit-root-2", split: "locked_test" });
  const result = auditCorpus([left, right]);
  assert.equal(failures(result, "cross_split_scenario_group").length, 1);
  assert.equal(failures(result, "duplicate_root_content").length, 1);
  const swapped = fixture({ example_id: "unit-3", root_id: "unit-root-3", scenario_group_id: "different-id" });
  swapped.source_segments = structuredClone(swapped.source_segments);
  swapped.source_segments[0].turns[1].text = "I'm Nia Patel in Salem.";
  swapped.input.segments = swapped.source_segments;
  swapped.entities.person = ["Nia Patel"];
  swapped.target.full_name.value = "Nia Patel"; swapped.target.full_name.evidence[0].quote = "I'm Nia Patel";
  const ready = fixture(swapped);
  const flagged = auditCorpus([left, ready]);
  assert.equal(failures(flagged, "near_duplicate_review_required").length, 1);
});

test("equal row counts cannot hide token or nominal loss concentration", () => {
  const rows = [
    { root_id: "a", generator: "a", prompt_tokens: 990, target_tokens: 20, sample_weight: 99 },
    { root_id: "b", generator: "b", prompt_tokens: 10, target_tokens: 20, sample_weight: 1 },
  ];
  const report = concentration(rows, "generator");
  assert.equal(report.groups[0].row_share, 0.5);
  assert.equal(report.groups[0].input_token_share, 0.99);
  assert.equal(report.groups[0].nominal_loss_share, 0.99);
});

function exposureRows() {
  return Array.from({ length: 200 }, (_, index) => ({ example_id: `q-${index}`, root_id: `r-${index}`, scenario_group_id: `g-${index}`, template_family: `t-${index % 20}`, split: "train", task: "questions", generator_model: index < 100 ? "anthropic/claude-haiku-4.5" : "google/gemini-3.5-flash-lite", target: { questions: index % 2 ? [] : ["What changed?"] }, prompt_tokens: 100, target_tokens: index % 2 ? 5 : 20, sample_weight: 1 }));
}

test("actual schedule catches oversampling, class skew and missing tasks", () => {
  const rows = exposureRows();
  const schedule = rows.map((row, position) => ({ example_id: row.example_id, epoch: 1, position }));
  const normal = auditSchedule(rows, schedule);
  assert.equal(normal.failures.length, 0);
  assert.ok(normal.epochs["1/questions"].rolling_drift.length > 0); // globally balanced, generator blocks are locally skewed
  const skew = [...schedule, ...Array.from({ length: 100 }, (_, index) => ({ example_id: "q-0", epoch: 1, position: 200 + index }))];
  const bad = auditSchedule(rows, skew);
  assert.ok(failures(bad, "sampled_row_repetition").length);
  assert.ok(failures(bad, "sampled_ask_loss_share").length);
  assert.ok(failures(bad, "sampled_concentration").length);
  assert.ok(failures(auditSchedule([...rows, { ...rows[0], example_id: "extract", task: "extraction" }], schedule), "sampled_missing_task").length);
  assert.ok(auditSchedule(rows, [{ example_id: "locked-test-row", epoch: 1, position: 0 }]).failures.length);
});

test("complete manifest requires every task and partition; duplicate IDs fail", () => {
  const row = fixture();
  const result = auditCorpus([row, structuredClone(row)], { expectedManifest: true });
  assert.equal(failures(result, "duplicate_example_id").length, 1);
  assert.equal(failures(result, "missing_partition").length, 7);
});
