/** Local diagnostic at identical full cutoffs; this is NOT a manual replay or a semantic judge. */
import { readFileSync, writeFileSync } from "node:fs";
import { digest } from "./corpus-audit.mjs";
import { fields } from "../runtime/field-contract.mjs";
import { assessReference } from "../runtime/quality-scoring.mjs";
const args = process.argv.slice(2);
const option = (name, fallback) => args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const requested = option("groups", "employer-timeline,activity-versus-impact").split(",");
const modes = option("modes", "single,multi").split(",");
if (modes.some((mode) => !["single", "multi"].includes(mode))) throw new Error("Modes must be single and/or multi");
const dataset = JSON.parse(readFileSync(new URL("./intent-contrasts.json", import.meta.url)));
const groups = dataset.groups.filter((group) => requested.includes(group.id));
if (groups.length !== new Set(requested).size) throw new Error("Unknown contrast group");
const output = option("out", "/tmp/interview-intent-contrast-diagnostic.json");
const endpoint = process.env.ADAPTER_URL || "http://127.0.0.1:8000";
const report = { recorded_at: new Date().toISOString(), purpose: "calibration_diagnostic_not_held_out_or_training_evidence", mode_semantics: "All received chunks supplied at the same final cutoff; fresh question history for each invocation. Multi is reconstruction parity, not incremental replay.",
  dataset_hash: digest(dataset), model_id: option("model", "lfm2.5-2.6b-no-think"), prompt_source_hash: digest(readFileSync(new URL("../runtime/model-prompts.mjs", import.meta.url), "utf8")), results: [] };
for (const group of groups) for (const variant of group.variants) for (const mode of modes) {
  const response = await fetch(`${endpoint}/v1/analyze`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...variant.inputs[mode], modelId: report.model_id, processedResponseCount: 0 }), signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${variant.id}/${mode}: ${await response.text()}`);
  const result = await response.json();
  if (!result.analysisPerformed) throw new Error("Diagnostic input unexpectedly buffered");
  const actual = new Map(result.checklistSnapshot.map((field) => [field.fieldId, field.value]));
  const comparisons = fields.map(({ id }) => { const wanted = variant.expected.final[id].value, got = actual.get(id) ?? null;
    const reference = assessReference(id, wanted, got, variant.expected.acceptable_values?.[id] || [], variant.expected.supported_detail_reference?.[id] ?? wanted);
    return { field_id: id, expected: wanted, actual: got, normalized_text_equivalent: reference.normalized_reference_match, detail_coverage: reference.detail_coverage }; });
  const expectedAsk = variant.expected.questions.questions.length > 0;
  const rawAsk = (result.rawFollowUpQuestions || []).length > 0, deliveredAsk = result.followUpQuestions.length > 0;
  const item = { group_id: group.id, variant_id: variant.id, mode, comparisons,
    question_decision: { expected_ask: expectedAsk, raw_ask: rawAsk, delivered_ask: deliveredAsk, raw_decision_matches: rawAsk === expectedAsk, delivered_decision_matches: deliveredAsk === expectedAsk, wording_and_premise_review: "pending_human_semantic_review" }, raw_result: result };
  report.results.push(item);
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ variant: variant.id, mode, text_mismatches_needing_review: comparisons.filter((field) => !field.normalized_text_equivalent).map((field) => field.field_id), expected_ask: expectedAsk, raw_ask: rawAsk, delivered_questions: result.followUpQuestions.map((question) => question.question), rejected_updates: result.rejectedExtractionUpdates.length, ms: result.metrics.totalMs }));
}
console.log(`Diagnostic saved to ${output}. Text equivalence and ask/abstain do not establish semantic correctness.`);
