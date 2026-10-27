/** Offline integrity/concentration audit. This does not certify semantic labels or training loss. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { fields, FIELD_CONTRACT_VERSION } from "../runtime/field-contract.mjs";
import { completedResponses, transcriptResponses } from "../runtime/transcript-json.mjs";
import { validateExtraction } from "../runtime/live-extraction.mjs";
import { reconcileExtraction } from "../runtime/end-of-call.mjs";
import { extractionMessages, questionMessages } from "../runtime/model-prompts.mjs";

export const policy = JSON.parse(readFileSync(new URL("./corpus-policy.json", import.meta.url), "utf8"));
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
export const digest = (value) => createHash("sha256").update(typeof value === "string" ? value : (JSON.stringify(canonical(value)) ?? "undefined")).digest("hex");
const groups = (rows, key) => {
  const result = new Map();
  for (const row of rows) { const label = typeof key === "function" ? key(row) : row[key]; if (!result.has(label)) result.set(label, []); result.get(label).push(row); }
  return result;
};
const sum = (rows, key) => rows.reduce((total, row) => total + Number(typeof key === "function" ? key(row) : row[key]), 0);
const distinct = (rows, key) => new Set(rows.map((row) => row[key])).size;
const signature = (segments) => transcriptResponses(segments).map(({ interviewer, candidate }) => `${interviewer}\n${candidate}`).join("\n");
const normalize = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
const quoteShape = (evidence) => Array.isArray(evidence) && evidence.every((item) => item && Number.isInteger(item.turn_id) && typeof item.quote === "string" && item.quote.trim() && Object.keys(item).every((key) => ["turn_id", "quote"].includes(key)));
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const matchesKeys = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

export function tokenBand(row) {
  const length = row.prompt_tokens + row.target_tokens;
  return length <= 1024 ? "up_to_1024" : length <= 2048 ? "1025_to_2048" : length <= 4096 ? "2049_to_4096" : length <= 8192 ? "4097_to_8192" : "over_limit";
}
export function concentration(rows, key) {
  const totalInput = sum(rows, "prompt_tokens"), totalTarget = sum(rows, "target_tokens"), totalWeight = sum(rows, "sample_weight");
  const totalRoots = distinct(rows, "root_id");
  const values = [...groups(rows, key)].map(([label, members]) => ({ label, rows: members.length, roots: distinct(members, "root_id"),
    row_share: members.length / rows.length, root_share: distinct(members, "root_id") / totalRoots,
    input_token_share: totalInput ? sum(members, "prompt_tokens") / totalInput : 0,
    target_token_share: totalTarget ? sum(members, "target_tokens") / totalTarget : 0,
    nominal_loss_share: totalWeight ? sum(members, "sample_weight") / totalWeight : 0 }));
  const rowHhi = values.reduce((total, value) => total + value.row_share ** 2, 0);
  const rootHhi = values.reduce((total, value) => total + value.root_share ** 2, 0);
  return { groups: values, effective_row_groups: rowHhi ? 1 / rowHhi : 0, effective_root_groups: rootHhi ? 1 / rootHhi : 0 };
}

/** Exact records + candidate quote provenance; semantic entailment is a separate review gate. */
function validateRowUnchecked(row) {
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  if (!isRecord(row)) return ["Row must be an object"];
  for (const key of ["example_id", "root_id", "scenario_group_id", "split", "task", "mode", "template_family", "domain_role_family", "generator_model", "generator_provider", "generator_prompt_version", "generator_request_id", "annotation_version", "difficulty", "primary_bucket", "wording_pattern", "tokenizer_revision", "tokenizer_id", "chat_template_hash", "rendered_transcript_hash", "messages_hash", "target_hash"]) require(typeof row[key] === "string" && row[key].trim(), `Missing ${key}`);
  require(["train", "dev", "locked_test", "challenge"].includes(row.split), "Calibration and unknown splits cannot enter the corpus");
  require(row.field_contract === FIELD_CONTRACT_VERSION, "Wrong frozen field contract");
  require(row.domain_scope === policy.domain_scope, "Outside the frozen veteran-interview domain");
  require(policy.allowed_role_families.includes(row.domain_role_family), "Role family outside the agreed veteran-interview scope");
  require(digest(row.field_definitions) === digest(fields), "Field definitions differ from frozen contract");
  require(["extraction", "questions"].includes(row.task), "Unknown task");
  require(row.task === "questions" ? row.mode === "questions" : ["live", "final"].includes(row.mode), "Invalid mode");
  require(Object.hasOwn(policy.training_generator_shares, row.generator_model), "Generator not in agreed pair");
  require(["easy", "medium", "hard"].includes(row.difficulty), "Unknown difficulty");
  const buckets = row.task === "extraction" ? policy.extraction_primary_risk_shares : policy.question_primary_outcome_shares;
  require(Object.hasOwn(buckets, row.primary_bucket), "Unknown primary bucket");
  require(row.review_status === "accepted", "Label not accepted");
  require(row.annotation_disagreement_resolved === true, "Annotation disagreement not resolved");
  require(row.contains_expected_answer_scaffolding === false, "Input scaffolding audit missing or failed");
  require(row.semantic_support_review === "accepted", "Semantic support review missing");
  require(isRecord(row.review) && ["human", "cross_model"].includes(row.review.type) && typeof row.review.reviewer_id === "string" && row.review.reviewer_id.trim() && row.review.reviewed_transcript_hash === row.rendered_transcript_hash && row.review.reviewed_target_hash === row.target_hash, "Missing or stale label-review provenance");
  if (["locked_test", "challenge"].includes(row.split) || row.critical || row.disputed) require(row.review?.type === "human", "Gold/critical/disputed labels require human adjudication");
  for (const key of ["prompt_tokens", "target_tokens"]) require(Number.isInteger(row[key]) && row[key] > 0, `Invalid ${key}`);
  require(Number.isFinite(row.sample_weight) && row.sample_weight > 0, "Invalid sample weight");
  require(tokenBand(row) !== "over_limit" && (row.task !== "questions" || row.prompt_tokens + row.target_tokens <= 4096), "Overlength; truncation forbidden");
  require(row.truncated === false, "Truncation flag missing or true");
  require(isRecord(row.entities) && ["person", "employer", "location"].every((kind) => Array.isArray(row.entities[kind]) && row.entities[kind].every((value) => typeof value === "string" && value.trim())), "Missing entity inventory");
  require(isRecord(row.input) && Object.keys(row.input).every((key) => ["segments", "previousSnapshot", "previousQuestions"].includes(key)), "Unknown student-input keys or annotation leakage");
  if (!Array.isArray(row.input?.segments) || !row.input.segments.length || !Array.isArray(row.source_segments) || !row.source_segments.length) return [...errors, "Missing source or visible transcript"];
  require(digest(row.source_segments) === row.rendered_transcript_hash, "Source hash mismatch");
  require(row.input.segments.length <= row.source_segments.length && digest(row.input.segments) === digest(row.source_segments.slice(0, row.input.segments.length)), "Visible transcript is not an exact source prefix");
  if (row.mode === "final") require(row.input.segments.length === row.source_segments.length, "Final mode must receive the entire declared call");
  const turns = completedResponses(row.input.segments);
  require(turns.length > 0 || row.mode === "final", "No complete response at incremental invocation");
  require(row.visible_through_response === (row.mode === "final" ? transcriptResponses(row.input.segments).length : turns.length), "Incorrect visible response cutoff");
  const transcript = transcriptResponses(row.source_segments);
  require(new Set(row.source_segments.map((segment) => segment.id)).size === row.source_segments.length, "Duplicate chunk IDs");
  require(transcript.every((turn) => Number.isInteger(turn.turn_id) && turn.candidate && turn.interviewer), "Missing exchange IDs, speaker text or pairing");
  require(row.source_segments.every((segment) => typeof segment.date === "string" && typeof segment.timestamp === "string" && Number.isFinite(Date.parse(`${segment.date}T${segment.timestamp}`)) && Number.isFinite(segment.startSeconds) && segment.endSeconds >= segment.startSeconds && segment.turns?.every((turn) => Number.isInteger(turn.turnId) && ["Interviewer", "Candidate"].includes(turn.speaker) && typeof turn.text === "string" && (turn.speaker !== "Candidate" || typeof turn.responseComplete === "boolean"))), "Invalid chunk/speaker/completion metadata");
  const input = { ...row.input, fields };
  try {
    const expectedMessages = row.task === "questions" ? questionMessages(input) : extractionMessages({ ...input, finalize: row.mode === "final" });
    require(digest(row.messages) === digest(expectedMessages), "Training/serving prompt drift or annotations in messages");
    require(digest(row.messages) === row.messages_hash, "Message hash mismatch");
    require(digest(row.target) === row.target_hash, "Target hash mismatch");
    if (row.task === "questions") {
      require(matchesKeys(row.target, ["questions"]) && Array.isArray(row.target.questions) && row.target.questions.length <= 1 && row.target.questions.every((question) => typeof question === "string" && /^[^\n]*\?$/.test(question)), "Invalid question target");
      const ask = row.target?.questions?.length === 1;
      require(ask === row.primary_bucket.startsWith("ask_"), "Question decision contradicts primary outcome");
      require(!(row.input.previousQuestions || []).some((previous) => row.target?.questions?.some((question) => normalize(question) === normalize(previous.question))), "Question target repeats a previous suggestion");
    } else {
      require(matchesKeys(row.target, fields.map(({ id }) => id)), "Target must contain exactly all frozen fields");
      if (row.mode === "live") {
        const result = validateExtraction(row.target, input);
        require(!result.rejectedExtractionUpdates.length, `Invalid live target: ${result.rejectedExtractionUpdates.map((item) => item.rejectionReason).join("; ")}`);
      } else {
        require(Object.values(row.target).every((value) => matchesKeys(value, ["value", "evidence"]) && (value.value === null || typeof value.value === "string" && value.value.trim()) && quoteShape(value.evidence) && (value.value !== null || value.evidence.length === 0)), "Invalid final target shape");
        require(!reconcileExtraction(row.target, input).rejectedExtractions.length, "Invalid final target evidence");
      }
    }
  } catch (error) { errors.push(`Invalid model contract: ${error.message}`); }
  return errors;
}

export function validateRow(row) {
  try { return validateRowUnchecked(row); }
  catch (error) { return [`Malformed corpus record: ${error.message}`]; }
}

function fieldState(row) {
  if (row.task !== "extraction") return null;
  return row.mode === "final" ? row.target : Object.fromEntries(validateExtraction(row.target, { ...row.input, fields }).checklistSnapshot.map((item) => [item.fieldId, { value: item.value }]));
}
function density(row) {
  const state = fieldState(row);
  const share = state ? Object.values(state).filter(({ value }) => value !== null).length / fields.length : 0;
  return share <= 0.25 ? "sparse_0_to_25_percent" : share <= 0.6 ? "medium_over_25_to_60_percent" : "dense_over_60_percent";
}
function position(row) {
  const count = completedResponses(row.source_segments).length;
  const fraction = count ? row.visible_through_response / count : 1;
  return fraction <= 1 / 3 ? "early" : fraction <= 2 / 3 ? "middle" : "late";
}
const nearGrams = (text) => {
  const words = normalize(text).split(" ");
  return new Set(words.length < 5 ? [words.join(" ")] : words.slice(0, -4).map((_, index) => words.slice(index, index + 5).join(" ")));
};
export function jaccard(left, right) {
  const intersection = [...left].filter((value) => right.has(value)).length;
  return intersection / Math.max(1, left.size + right.size - intersection);
}
function maskedSource(row) {
  let text = signature(row.source_segments).toLowerCase();
  const entities = Object.values(row.entities).flat().sort((a, b) => b.length - a.length);
  for (const entity of entities) text = text.replaceAll(entity.toLowerCase(), " ENTITY ");
  return text.replace(/[\p{N}]+/gu, " NUMBER ");
}

export function auditCorpus(rows, { expectedManifest = false, schedule = null } = {}) {
  const failures = [], warnings = [], partitions = {};
  const fail = (code, detail) => failures.push({ code, detail });
  const check = (condition, code, detail) => { if (!condition) fail(code, detail); };
  const valid = [];
  const ids = new Set(), roots = new Map(), scenarioSplits = new Map();
  rows.forEach((row, index) => {
    const errors = validateRow(row);
    if (errors.length) { fail("invalid_row", { index, id: row?.example_id, errors }); return; }
    check(!ids.has(row.example_id), "duplicate_example_id", row.example_id); ids.add(row.example_id);
    const metadata = [row.scenario_group_id, row.split, row.template_family, row.domain_scope, row.domain_role_family, row.generator_model, row.rendered_transcript_hash, digest(row.entities)];
    if (roots.has(row.root_id)) check(digest(metadata) === digest(roots.get(row.root_id).metadata), "inconsistent_root", row.root_id);
    else roots.set(row.root_id, { metadata, row });
    if (scenarioSplits.has(row.scenario_group_id)) check(scenarioSplits.get(row.scenario_group_id) === row.split, "cross_split_scenario_group", row.scenario_group_id);
    else scenarioSplits.set(row.scenario_group_id, row.split);
    valid.push(row);
  });
  check(rows.length > 0, "empty_corpus", "No rows supplied");
  const uniqueRoots = [...roots.values()].map(({ row }) => row);
  const duplicatePairs = [];
  const grams = uniqueRoots.map((row) => ({ row, plain: nearGrams(signature(row.source_segments)), masked: nearGrams(maskedSource(row)) }));
  for (let left = 0; left < grams.length; left++) for (let right = left + 1; right < grams.length; right++) {
    const a = grams[left], b = grams[right];
    const exact = normalize(signature(a.row.source_segments)) === normalize(signature(b.row.source_segments));
    const similarity = Math.max(jaccard(a.plain, b.plain), jaccard(a.masked, b.masked));
    if (exact || similarity >= policy.near_duplicate_review.normalized_word_5gram_jaccard_flag_at) {
      const pair = { roots: [a.row.root_id, b.row.root_id], cross_split: a.row.split !== b.row.split, exact, similarity };
      duplicatePairs.push(pair);
      // IDs or entity swaps cannot waive content-derived duplication. Resolve and re-audit.
      fail(exact ? "duplicate_root_content" : "near_duplicate_review_required", pair);
    }
  }
  const margin = (members, key, desired, tolerance, context) => {
    for (const [label, target] of Object.entries(desired)) {
      const actual = members.filter((row) => (typeof key === "function" ? key(row) : row[key]) === label).length / members.length;
      check(Math.abs(actual - target) <= tolerance / 100 + 1e-9, "balance_margin", { context, label, expected: target, actual });
    }
  };
  const bounds = (actual, range, code, context) => check(actual >= range[0] - 1e-9 && actual <= range[1] + 1e-9, code, { context, actual, range });
  const maximum = (report, metric, limit, context) => { for (const group of report.groups) check(group[metric] <= limit + 1e-9, "concentration", { context, group: group.label, metric, actual: group[metric], limit }); };
  for (const [splitTask, members] of groups(valid, (row) => `${row.split}/${row.task}`)) {
    const [split, task] = splitTask.split("/"), train = split === "train";
    const report = { rows: members.length, roots: distinct(members, "root_id"),
      generator: concentration(members, "generator_model"), templates: concentration(members, "template_family"), roots_concentration: concentration(members, "root_id"),
      scenario_groups: concentration(members, "scenario_group_id"), roles: concentration(members, "domain_role_family"),
      lengths: concentration(members, tokenBand), buckets: concentration(members, "primary_bucket"), difficulty: concentration(members, "difficulty") };
    partitions[splitTask] = report;
    const size = policy.splits[split];
    check(members.length === size.examples_per_task, "row_quota", { splitTask, actual: members.length, expected: size.examples_per_task });
    check(report.roots >= size.minimum_roots_per_task, "root_quota", { splitTask, actual: report.roots, minimum: size.minimum_roots_per_task });
    const limits = train ? policy.concentration_limits_per_task : policy.evaluation_concentration_limits_per_task;
    maximum(report.roots_concentration, "rows", limits.maximum_examples_per_root, `${splitTask}/root rows`);
    maximum(report.templates, "root_share", train ? limits.maximum_template_root_share : limits.maximum_template_root_and_row_share, `${splitTask}/template roots`);
    maximum(report.templates, "row_share", train ? limits.maximum_template_row_share : limits.maximum_template_root_and_row_share, `${splitTask}/template rows`);
    maximum(report.templates, "input_token_share", limits.maximum_template_input_token_share, `${splitTask}/template input tokens`);
    if (train) {
      check(report.scenario_groups.groups.length >= limits.minimum_scenario_family_groups, "scenario_diversity", splitTask);
      maximum(report.scenario_groups, "rows", limits.maximum_examples_per_scenario_family_group, `${splitTask}/scenario rows`);
      maximum(report.scenario_groups, "roots", limits.maximum_roots_per_scenario_family_group, `${splitTask}/scenario roots`);
      maximum(report.scenario_groups, "input_token_share", limits.maximum_scenario_family_group_input_token_share, `${splitTask}/scenario tokens`);
      maximum(report.scenario_groups, "nominal_loss_share", limits.maximum_scenario_family_group_effective_loss_share, `${splitTask}/scenario nominal loss`);
      maximum(report.roots_concentration, "input_token_share", limits.maximum_root_input_token_share, `${splitTask}/root tokens`);
      maximum(report.roots_concentration, "nominal_loss_share", limits.maximum_root_effective_loss_share, `${splitTask}/root nominal loss`);
      maximum(report.templates, "nominal_loss_share", limits.maximum_template_effective_loss_share, `${splitTask}/template nominal loss`);
      check(report.templates.groups.length >= limits.minimum_template_families && report.templates.effective_row_groups >= limits.minimum_effective_template_families - 1e-9 && report.templates.effective_root_groups >= limits.minimum_effective_template_families - 1e-9, "template_diversity", splitTask);
      check(report.roles.groups.length >= limits.minimum_role_families && report.roles.effective_row_groups >= limits.minimum_effective_role_families - 1e-9, "role_diversity", splitTask);
      maximum(report.roles, "row_share", limits.maximum_role_family_row_share, `${splitTask}/role rows`);
      margin(members, "generator_model", policy.training_generator_shares, policy.generator_share_tolerance_pp, splitTask);
      for (const generator of report.generator.groups) {
        bounds(generator.input_token_share, policy.training_generator_input_and_target_token_share_bounds, "generator_input_tokens", splitTask);
        bounds(generator.target_token_share, policy.training_generator_input_and_target_token_share_bounds, "generator_target_tokens", splitTask);
        bounds(generator.nominal_loss_share, policy.training_exposure.generator_effective_loss_share_bounds, "generator_nominal_loss", splitTask);
      }
      for (const kind of ["person", "employer", "location"]) {
        const inventory = new Map();
        for (const row of members) for (const entity of row.entities[kind]) {
          const key = normalize(entity); if (!inventory.has(key)) inventory.set(key, new Set()); inventory.get(key).add(row.root_id);
        }
        const limit = kind === "location" ? limits.maximum_location_root_share : limits[`maximum_${kind}_name_root_share`];
        for (const [entity, rootIds] of inventory) check(rootIds.size / report.roots <= limit + 1e-9, "entity_concentration", { splitTask, kind, entity, share: rootIds.size / report.roots, limit });
      }
      for (const bucket of Object.keys(task === "extraction" ? policy.extraction_primary_risk_shares : policy.question_primary_outcome_shares)) {
        const cell = members.filter((row) => row.primary_bucket === bucket);
        for (const generator of Object.keys(policy.training_generator_shares)) {
          const rootsInCell = distinct(cell.filter((row) => row.generator_model === generator), "root_id");
          check(rootsInCell >= limits.minimum_training_roots_per_generator_primary_bucket_cell, "generator_bucket_root_support", { splitTask, bucket, generator, roots: rootsInCell });
          if (cell.length) bounds(cell.filter((row) => row.generator_model === generator).length / cell.length, limits.generator_share_bounds_within_primary_bucket, "generator_bucket_share", { splitTask, bucket, generator });
        }
      }
      const reviewed = new Set(members.filter((row) => row.review.type === "human").map((row) => row.root_id));
      check(reviewed.size / report.roots >= policy.training_label_audit.minimum_human_reviewed_root_fraction, "human_training_audit", splitTask);
    } else {
      maximum(report.scenario_groups, "row_share", limits.maximum_scenario_family_group_row_share, `${splitTask}/scenario share`);
      maximum(report.generator, "row_share", limits.maximum_generator_row_share, `${splitTask}/generator rows`);
    }
    if (train || split !== "challenge") {
      margin(members, "primary_bucket", task === "extraction" ? policy.extraction_primary_risk_shares : policy.question_primary_outcome_shares, policy.primary_bucket_tolerance_pp, splitTask);
      margin(members, "difficulty", policy.difficulty_tier_shares, policy.mode_density_and_token_band_tolerance_pp, splitTask);
      margin(members, tokenBand, policy.total_serialized_token_band_shares[task], policy.mode_density_and_token_band_tolerance_pp, splitTask);
    } else warnings.push({ code: "challenge_composition_review_required", splitTask });
    if (task === "extraction") {
      report.field_support = fields.map(({ id }) => ({ id, supported_roots: distinct(members.filter((row) => fieldState(row)[id]?.value !== null), "root_id"), unsupported_roots: distinct(members.filter((row) => fieldState(row)[id]?.value === null), "root_id") }));
      if (train) {
        margin(members, "mode", policy.training_extraction_mode_shares, policy.mode_density_and_token_band_tolerance_pp, splitTask);
        margin(members, density, policy.extraction_answer_density_shares, policy.mode_density_and_token_band_tolerance_pp, splitTask);
        bounds(sum(members, (row) => Object.values(fieldState(row)).filter(({ value }) => value !== null).length) / (fields.length * members.length), policy.supported_field_opportunity_share_bounds, "field_opportunity_share", splitTask);
        for (const field of report.field_support) check(field.supported_roots >= policy.per_default_field_training_minimums.supported_distinct_roots && field.unsupported_roots >= policy.per_default_field_training_minimums.unsupported_distinct_roots, "field_root_support", { splitTask, ...field });
        for (const [rootId, rootRows] of groups(members, "root_id")) {
          check(rootRows.filter((row) => row.mode === "live").length <= limits.maximum_live_extraction_examples_per_root && rootRows.filter((row) => row.mode === "final").length <= limits.maximum_final_extraction_examples_per_root, "root_mode_exposure", rootId);
        }
        const live = members.filter((row) => row.mode === "live");
        if (live.length) maximum(concentration(live, position), "row_share", policy.maximum_live_prefix_position_band_share, `${splitTask}/live positions`);
      }
    } else if (train) {
      const ask = members.filter((row) => row.target.questions.length);
      bounds(ask.length / members.length, [0.5 - policy.primary_bucket_tolerance_pp / 100, 0.5 + policy.primary_bucket_tolerance_pp / 100], "ask_row_share", splitTask);
      bounds(sum(ask, "sample_weight") / sum(members, "sample_weight"), policy.training_exposure.question_ask_effective_loss_share_bounds, "ask_nominal_loss", splitTask);
      maximum(concentration(members, (row) => Math.min(3, completedResponses(row.input.segments).length)), "row_share", policy.maximum_question_window_size_share, `${splitTask}/question window`);
    }
    const slices = {
      generator_by_primary_bucket: (row) => `${row.generator_model}/${row.primary_bucket}`,
      generator_by_question_decision: (row) => `${row.generator_model}/${row.target.questions?.length ? "ask" : "abstain"}`,
      generator_by_difficulty: (row) => `${row.generator_model}/${row.difficulty}`,
      primary_bucket_by_difficulty: (row) => `${row.primary_bucket}/${row.difficulty}`,
      primary_bucket_by_length: (row) => `${row.primary_bucket}/${tokenBand(row)}`,
      extraction_mode_by_density: (row) => `${row.mode}/${density(row)}`,
      label_by_wording_pattern: (row) => `${row.task === "questions" ? row.target.questions.length ? "ask" : "abstain" : row.primary_bucket}/${row.wording_pattern}`,
    };
    report.joint_slices = [];
    for (const [name, key] of Object.entries(slices)) {
      if ((task !== "questions" && name === "generator_by_question_decision") || (task !== "extraction" && name === "extraction_mode_by_density")) continue;
      for (const [label, cell] of groups(members, key)) {
        const sparse = cell.length < policy.joint_concentration.minimum_cell_examples_for_cap;
        const largestTemplate = Math.max(...concentration(cell, "template_family").groups.map((group) => group.row_share));
        report.joint_slices.push({ name, label, rows: cell.length, sparse, largest_template_share: largestTemplate });
        if (!sparse) check(largestTemplate <= policy.joint_concentration.maximum_template_share_in_material_cell + 1e-9, "joint_template_concentration", { splitTask, name, label, largestTemplate });
      }
    }
  }
  if (expectedManifest) for (const split of ["train", "dev", "locked_test", "challenge"]) for (const task of ["extraction", "questions"]) check(Boolean(partitions[`${split}/${task}`]), "missing_partition", `${split}/${task}`);
  const outstanding = ["Independently verify tokenizer/template token counts and loss masks", "Semantic duplicate embeddings and taxonomy review", "Human semantic-label/adjudication and cell error-rate audit", "Role-by-field and canonical-value concentration review", "Veteran-domain grounding and minimal-contrast/paraphrase semantic review", "Generation/rejection/repair lineage audit", "Trainer per-example loss and accumulation verification"];
  if (!schedule) outstanding.push("Actual sampled epoch exposure audit");
  const exposure = schedule ? auditSchedule(valid, schedule) : null;
  if (exposure) failures.push(...exposure.failures);
  return { policy_version: policy.version, field_contract: FIELD_CONTRACT_VERSION, input_rows: rows.length, structurally_valid_rows: valid.length,
    numeric_and_structural_gates_passed: failures.length === 0, release_eligible: false,
    status: "audit_only_release_blocked_until_external_and_training_gates_are_verified", failures, warnings, outstanding_gates: outstanding, partitions, duplicate_pairs: duplicatePairs, exposure };
}

/** Audit actual draws per epoch, not just intended sampler probabilities. */
export function auditSchedule(rows, schedule) {
  const failures = [], epochs = {};
  const index = new Map(rows.filter((row) => row.split === "train").map((row) => [row.example_id, row]));
  const fail = (code, detail) => failures.push({ code, detail });
  if (!Array.isArray(schedule) || !schedule.length) return { failures: [{ code: "empty_schedule", detail: "No actual draws supplied" }], epochs };
  const valid = [];
  for (const draw of schedule) {
    if (!index.has(draw?.example_id) || !Number.isInteger(draw.epoch) || draw.epoch < 1 || !Number.isInteger(draw.position) || draw.position < 0) { fail("invalid_schedule_draw", draw); continue; }
    valid.push({ ...index.get(draw.example_id), epoch: draw.epoch, position: draw.position });
  }
  for (const epoch of new Set(valid.map((row) => row.epoch))) for (const task of new Set([...index.values()].map((row) => row.task))) {
    if (!valid.some((row) => row.epoch === epoch && row.task === task)) fail("sampled_missing_task", { epoch, task });
  }
  for (const [epochTask, members] of groups(valid, (row) => `${row.epoch}/${row.task}`)) {
    const task = members[0].task, nominal = rows.filter((row) => row.split === "train" && row.task === task);
    const report = { draws: members.length, generator: concentration(members, "generator_model"), roots: concentration(members, "root_id"), templates: concentration(members, "template_family"), scenarios: concentration(members, "scenario_group_id"), rolling_drift: [] };
    epochs[epochTask] = report;
    for (const group of report.generator.groups) if (group.nominal_loss_share < 0.45 - 1e-9 || group.nominal_loss_share > 0.55 + 1e-9) fail("sampled_generator_loss_share", { epochTask, ...group });
    if (report.generator.groups.length !== Object.keys(policy.training_generator_shares).length) fail("sampled_missing_generator", epochTask);
    const caps = policy.concentration_limits_per_task;
    for (const [key, cap] of [["roots", caps.maximum_root_effective_loss_share], ["templates", caps.maximum_template_effective_loss_share], ["scenarios", caps.maximum_scenario_family_group_effective_loss_share]]) for (const group of report[key].groups) if (group.nominal_loss_share > cap + 1e-9) fail("sampled_concentration", { epochTask, dimension: key, cap, ...group });
    const counts = groups(members, "example_id");
    for (const row of nominal) if (!counts.has(row.example_id)) fail("sampled_missing_row", { epochTask, id: row.example_id });
    for (const [id, draws] of counts) if (draws.length > policy.training_exposure.maximum_repetition_multiplier) fail("sampled_row_repetition", { epochTask, id, draws: draws.length });
    if (task === "questions") {
      report.ask_loss_share = sum(members.filter((row) => row.target.questions.length), "sample_weight") / sum(members, "sample_weight");
      if (report.ask_loss_share < 0.45 - 1e-9 || report.ask_loss_share > 0.55 + 1e-9) fail("sampled_ask_loss_share", epochTask);
    }
    const ordered = [...members].sort((a, b) => a.position - b.position);
    if (new Set(ordered.map((row) => row.position)).size !== ordered.length) fail("duplicate_schedule_positions", epochTask);
    const width = policy.training_exposure.rolling_window_examples;
    for (let offset = 0; offset + width <= ordered.length; offset++) {
      const window = ordered.slice(offset, offset + width);
      const shares = concentration(window, "generator_model").groups;
      const drift = Math.max(...shares.map((group) => Math.abs(group.nominal_loss_share - 0.5)));
      const askDrift = task === "questions" ? Math.abs(sum(window.filter((row) => row.target.questions.length), "sample_weight") / sum(window, "sample_weight") - 0.5) : 0;
      if (Math.max(drift, askDrift) > policy.training_exposure.rolling_window_drift_review_trigger_pp / 100 + 1e-9) report.rolling_drift.push({ start: offset, drift: Math.max(drift, askDrift) });
    }
  }
  return { failures, epochs, note: "Coefficient exposure assumes verified per-example mean loss. It does not prove the trainer implements that loss." };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), file = args.find((value) => !value.startsWith("--"));
  if (!file) { console.error("Usage: node training/corpus-audit.mjs corpus.jsonl [--complete] [--release] [--schedule=schedule.json] [--out=report.json]"); process.exitCode = 2; }
  else {
    try {
      const rows = readFileSync(file, "utf8").split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
      const schedulePath = args.find((value) => value.startsWith("--schedule="))?.slice(11);
      const report = auditCorpus(rows, { expectedManifest: args.includes("--complete"), schedule: schedulePath ? JSON.parse(readFileSync(schedulePath, "utf8")) : null });
      const output = args.find((value) => value.startsWith("--out="))?.slice(6);
      if (output) writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
      console.log(JSON.stringify({ rows: report.input_rows, failures: report.failures.length, numeric_and_structural_gates_passed: report.numeric_and_structural_gates_passed, release_eligible: report.release_eligible, outstanding_gates: report.outstanding_gates }, null, 2));
      if (report.failures.length || args.includes("--release")) process.exitCode = 1;
    } catch (error) { console.error(`Audit failed: ${error.message}`); process.exitCode = 1; }
  }
}
