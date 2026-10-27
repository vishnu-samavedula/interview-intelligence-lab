> Active scope, October 26: a focused training-and-demo experiment, approved by the user. Generate up to six grounded, distinct clarifying questions in model-ranked order and display the top three. Alternative useful questions and teacher disagreements are acceptable; hard failures are unsupported premises, repetition, answered questions or irrelevant topics. Keep the frozen extraction fields and simple source-grounded interpretation. The production corpus quotas and human-gold release workflow below remain future reference; they do not block this experimental demo. Report synthetic evaluation as synthetic and machine-reviewed, never as human gold or production certification. Preserve unseen scenario families and wording, and compare base versus trained under the same contract.

# Extraction and follow up adapter training runbook

Status: proposed recipe for agreement. Updated October 22, 2026. No synthetic generation, paid GPU job, or training run has been launched under this recipe.

Train two task adapters for the same pinned LFM2.5-2.6B checkpoint: one for checklist extraction and one for useful interview follow-ups. Generate fictional conversations through two OpenRouter models, train on Modal, and evaluate the resulting Q4 deployment in the local harness. The outcome is a measured improvement over the untuned model, with reproducible data and an explicit decision to promote or reject each adapter independently.

The [project requirements](PROJECT_DESCRIPTION.md) define the behavior. They are seed material for scenarios and annotation rules, not sufficient training data by themselves. The existing presets and examples already used to tune prompts are development regressions; they cannot establish held-out performance.

## Outcomes and boundaries

The demo supports a complete single preset and manually stepped multi-chunk presets through **Process chunk**. It does not require timed streaming or a 15-second inference deadline. “Live” below means incremental processing as the user advances the preset. Timestamps describe synthetic conversation order; they do not schedule requests.

| Deliverable | Evidence of completion |
| --- | --- |
| Extraction adapter | Pinned checkpoint, adapter weights, tokenizer and chat-template revision, training configuration, dataset hashes, native and Q4 evaluation results |
| Follow-up adapter | Equivalent artifacts plus reviewed ask/abstain decisions, relevance and repetition results |
| Corpus release | Immutable manifests, provenance, split assignments, label audit, concentration report, deduplication decisions and sampling history |
| Evaluation package | Baseline and candidate outputs on identical inputs, scoring code revision, human adjudication, slice counts and uncertainty |
| Local integration | Correct task routing, preserved raw output, no cross-adapter prompt-cache contamination, latency and memory measurements |
| Promotion decision | Separate pass/fail decision for each adapter, known limitations, rollback configuration and unresolved deployment conditions |

The extraction adapter serves both live and final extraction through an explicit mode and matching output contract. Live extraction remains useful for coverage during the call. Final reconciliation rebuilds from the full received transcript, can clear unsupported live values, and preserves the live snapshot for comparison. Summary generation remains an untuned downstream feature in this experiment; improvements to extraction do not establish summary quality.

The models perform the semantic work: the extraction adapter emits supported field values and explicit state operations with evidence; the follow-up adapter emits actual question text or an empty list. Structured JSON arguments carry these decisions. The harness reconstructs complete responses, selects the adapter and context, validates structure and quote provenance, applies explicit operations, preserves raw outputs and displays results. It must not infer missing facts, silently repair meaning or author replacement questions. Two specialized model calls are sufficient; autonomous agents are not required.

Cloud services handle fictional-data generation and training; deployed inference remains local and offline. The scope is US veterans and transitioning service members interviewing for civilian or defense-contractor work. The frozen 22 fields, grounded extraction and useful follow-ups define success. General interview coaching, candidate scoring and cross-industry generalization are outside this demo. Synthetic results support claims only on this tested domain; claims about real interviews require a separately reviewed, authorized transcript evaluation.

## Decisions to freeze before generation

The following defaults make the experiment concrete. Review them on the first 20 calibration conversations and version any changes before scaling generation. Numerical quotas and acceptance thresholds below are proposed experimental gates, not measured results or promised accuracy.

| Decision | Proposed starting point |
| --- | --- |
| Student | Both adapters independently initialize from the same native, post-trained `LiquidAI/LFM2.5-2.6B` revision; do not silently substitute the pretrained `-Base` checkpoint |
| Generators | `anthropic/claude-haiku-4.5` and `google/gemini-3.5-flash-lite`, with equal accepted training contribution |
| Training | Modal GPU job, Transformers/PEFT/TRL or a verified Unsloth path; select one stack after the smoke test |
| Extraction contract | Frozen 22-field `interview-fields-v1` IDs and definitions; incremental set/clear/unchanged operations with evidence, and final value/evidence snapshots |
| Follow-up contract | Latest three reconstructed complete exchanges, known checklist gaps and recent question history; zero or one suggestion per invocation for this experiment |
| Completeness signal | Explicit synthetic `response_complete`; buffer incomplete responses without inference |
| Final extraction | Full received transcript, including a last partial response if the call actually ends there; never treat live values as source facts |
| Domain | US veteran / transitioning-service-member job interviews; vary eight role families within that domain, keeping the same frozen 22-field contract |
| Spending | Budget is not a user approval gate. Record actual costs; use the bounded pilot corpus and at most three retries per failed request. Stop on quality/pipeline failures rather than retrying indefinitely |

The agreed demo emits zero or one question per invocation. A missing field alone is never a question trigger. Ask only about a transcript-supported, unresolved work claim, personal contribution or impact. Contact, pay and relocation are extraction topics, outside this follow-up recipe.

## Resolve harness prerequisites

Training should teach semantic behavior rather than compensate for an inconsistent evaluator or serialization path. Complete these prerequisites before generating the production corpus:

1. Done: send frozen field definitions and implement live/final contracts. Review the operation and unknown-value semantics on calibration cases before freezing training labels.
2. Done for narrow regression matching: fix the quality scorer's known number-word mismatch (`three years` versus `3 years`), weak substring matching and relocation checks that ignore destination constraints. Record narrowly defined equivalence rules with counterexamples; do not use permissive text containment as proof of correctness.
3. Implemented, pending calibration agreement: define live state updates explicitly. A missing fact in a narrow update must not erase established history; an explicit retraction must be able to clear it. Final full-transcript extraction is a fresh snapshot. The live validator now applies explicit operations and preserves prior state only on unchanged or rejected updates.
4. Implemented: include actual checklist gaps in question input. The zero-shot model still asks irrelevant gap questions; treat these as model failures. Distinguish a topic that is simply missing from one that is timely and worth asking now.
5. Freeze reconstruction, completion signals, temporal metadata, evidence references, schema enforcement, salary formatting, question filtering and exact-repeat handling. Keep model errors and harness rejections separate in every report.
6. Validate the training and inference chat templates, including reasoning-off behavior. Training targets contain the intended structured answer, with no hidden reasoning trace. Demonstrate parity rather than relying on a serving flag to reproduce training formatting.
7. Test adapter export and selection with a tiny smoke adapter before investing in a full corpus. LFM has a hybrid architecture; verify the actual target modules and conversion path rather than copying a generic transformer configuration.

Implemented October 22: frozen server-owned fields and field definitions in prompts; live operation/evidence validation; question gap context; removal of salary scaling and preset-specific summary amounts; conservative scorer regression tests. The previous permissive scores are historical. The first new-contract zero-shot smoke run regressed semantically; see [baseline notes](training/BASELINE_NOTES.md). An offline structural/numeric corpus auditor and sampled-schedule checks are now implemented. Semantic scoring, verified trainer loss/sampling, production training pipeline, cache-enabled routing and quality parity remain unfinished; the auditor cannot approve a corpus release on its own.

The [20 draft calibration roots](training/CALIBRATION_REVIEW.md) have been narrowed to veteran job interviews and are assistant-authored and structurally checked, with human semantic review pending. They are not OpenRouter-generated, training data or held-out gold. Use them to resolve the rubric, then freeze the full baseline on the agreed evaluation inputs.

## Behavior and annotation rules

### Extraction

User review accepts concise supported values: Army and Army captain can both be correct when that service/rank is stated; No correctly represents an explicit relocation refusal. Store accepted references separately from optional service detail, and score correctness separately from detail coverage. Never accept a rank or positive relocation restriction just because a shorter branch or yes/no value matches. In the reviewed conventional US salary context, around 90 means $90,000; hourly pay, small allowances, foreign currency and explicit unit uncertainty override that convention. The model interprets context; the harness does not multiply numbers blindly.

For each configured field, annotate the latest supported value at the visible cutoff. Track its supporting candidate quote and turn, relevant qualifiers, earlier superseded facts and whether the statement is uncertain or conflicting. A candidate quote must support the value's meaning, not merely contain related words.

The corpus must teach these distinctions explicitly:

- A former employer or program does not populate a current-role field.
- Moving from the Army into contracting does not establish a current reason for leaving or a future interest.
- An email username is not a personal name.
- Salary status, currency, units, base/bonus/equity and range qualifiers remain distinct.
- Relocation polarity and destination constraints survive chunk boundaries and later corrections.
- Team size requires a stated count and appropriate relationship; “smaller shop” is not a team size.
- A topic absent from a transcript remains unknown. A question's premise is not evidence that the candidate stated a fact.
- A final reconciliation may remove an unsupported live value, but may not fill another field just to preserve it.

Include both live prefixes and final transcripts. Give the extraction adapter an explicit `mode` so differences in update versus replacement semantics are learnable. Final labels are independently adjudicated against source speech, not copied from the live record.

### Follow ups

Rubric clarification from user review: a measurable technical improvement does not automatically require abstention. A useful follow-up may ask what value it delivered for the team or what consequential trade-offs accompanied it. Ask neutrally, without assuming savings or a trade-off; do not force that question after every metric. For “I changed the filter and reduced tracking error from 8% to 3%,” an acceptable question is “What did that improvement enable for the team, and were there any trade-offs?” A fully explained result/value or an already answered question still warrants abstention.

Annotate the **decision** separately from the wording. For an ask case, record the explicitly mentioned role/interest to explore or the candidate-supported unresolved work claim, the information a useful question should obtain, acceptable alternatives and prohibited assumptions. A checklist gap can inform interpretation but cannot independently justify a question. Role-specific exploration of responsibilities, contribution or interests is allowed for a current or former role without requiring a vague achievement. A useful question about past-role interests does not itself establish a future preference for extraction. Reward a specific question grounded in the candidate's words; reject boilerplate, generic career advice, premises about unstated improvement, and requests to repeat an already clear result. Multiple phrasings can be correct.

For an abstain case, record why: the answer is already clear, content is logistical/contact-only, later visible speech resolves the issue, or the question was recently suggested. Do not manufacture a question to fill a label quota. Contact details do not establish an achievement. A number is useful only if its meaning and contribution are clear; a vague number alone is not an automatic abstention rule.

The calibration set must resolve borderline cases: “thousands of scenarios” with no outcome, quantified results with unclear ownership, a missing methodology, a topic already covered outside the three-turn window, contradictory statements, and whether a question would clarify an actual claim or merely fill a missing checklist slot (the latter must abstain). If needed context lies outside the window, specify what compact state the harness supplies; do not label the student using invisible history.

Record the source of supplied checklist state: adjudicated state, frozen-baseline replay, or controlled corruption. Include baseline replay cases in calibration so the question model learns from the state it will actually receive. Contradiction labels require visible evidence; do not expect the student to discover an erroneous state using hidden transcript history. Evaluate the complete extraction-to-question pipeline separately from evaluation with gold checklist inputs.

Partially received candidate answers belong in the **buffering gate tests**, not ordinary question-model inputs. The model's training distribution should match when the harness actually invokes it.

## Learn intent within a narrow domain

Domain membership is never field evidence. Army service does not establish a degree, active clearance, civilian title, current employer, technical expertise or future interest. A former military rank and a civilian job title must remain distinct. Interpret familiar abbreviations only when candidate speech establishes the intended meaning; preserve uncertainty otherwise. Do not infer personal qualities from branch or rank.

Vary meaning-bearing structure: service and civilian chronology; direct versus team ownership; stated work activity versus concrete outcome; active versus expired clearance; corrected or withheld contact details; compensation status/units; and relocation conditions. Vary wording, answer order, disfluencies and chunk boundaries naturally. Do not manufacture diversity with filler or a large number of name substitutions.

Include reviewed contrasts with the same vocabulary but different correct outputs: reverse current/former employer; change active to expired clearance; change “we” to a stated personal contribution; replace a scenario count with an actual improvement metric; resolve a vague claim in a later visible answer; or retract rather than replace a fact. Also include meaning-preserving paraphrases whose expected meaning stays the same. Keep every related contrast and paraphrase in one scenario-family group and split; entity swaps do not create independent roots. Contrast coverage is a semantic review gate, not established merely by a metadata tag.

Hold out independently authored conversation blueprints and unfamiliar combinations of service history, role, employer, technical terminology and phrasing **within this domain**. Evaluate each skill separately: field meaning, temporal status, correction/negation, qualifier retention, quote entailment, ask/abstain, question premises, usefulness and repetition. Rank or name changes alone do not demonstrate generalization. Compare equivalent single/multi inputs and candidate continuations; extraction facts should remain consistent, while questions should resolve or advance as new answers arrive.

Question priority follows what remains unresolved: clarify ownership when contribution is unclear; clarify what changed when the benefit itself is vague; quantify an established outcome when its size is missing. Prefer a concrete qualitative result when a numerical metric would be unnatural. A count of simulations is activity volume, not evidence of improved accuracy. Once a response resolves a claim, stop asking about that claim and consider a new one, or abstain. Never require a question on every click.

The [intent contrast review](training/INTENT_CONTRASTS_REVIEW.md) adds eleven related pairs (twenty-two variants), including one meaning-preserving paraphrase pair. These are calibration-only drafts, not twenty-two additional independent roots. Exact quote, reconstruction and declared field/decision differences are checked by the builder. Model semantic behavior still needs review. The diagnostic runner compares isolated invocations at the same cutoff with fresh history; it does not claim to evaluate incremental question propagation.

## Corpus units and split assignment

Use four distinct units:

| Unit | Meaning |
| --- | --- |
| Scenario family group | A scenario blueprint and every related paraphrase, counterfactual, alternate rendering and chunking; the unit assigned to a split |
| Root conversation | One independently authored conversation with its own timeline and fact ledger |
| Example | One actual extraction or follow-up invocation at a defined visible cutoff |
| Training exposure | How often an example is sampled and how much input-token and effective loss contribution it receives |

Partition scenario family groups **before** transcript rendering, labeling or prefix expansion. Assign each group to one split across both tasks. All variants of the original employer correction, including name-swapped copies, stay together. A conversation cannot contribute extraction training examples and question test examples. Independently designed broad template families may appear in the core splits, but copied scenario blueprints may not. Reserve additional template families exclusively for challenge evaluation.

| Partition | Starting size per task | Minimum distinct roots per task | Purpose |
| --- | ---: | ---: | --- |
| Calibration | 20 shared root conversations; derive both tasks | 20 | Agree on meaning, rubric and quotas; excluded from locked evaluation |
| Train | 1,000 examples | 400 | First adapter pilot |
| Development | 200 examples | 80 | Checkpoints, hyperparameters and error analysis |
| Locked core test | 200 examples | 80 | Final comparison after candidate selection |
| Challenge | 100 examples | 50 | Reserved templates, terminology and difficult temporal cases |

The train, dev, test and challenge partitions therefore contain 3,000 examples across two tasks. Roots may be shared across the two tasks **within the same partition**; minimum root counts must hold independently for each task. The 20 calibration roots are additional. Sizes are a pilot, not evidence of production coverage.

Use a balanced core test for controlled comparisons. Once representative traffic is available, add a separate test with that measured distribution; never describe our artificial 50/50 question mix as the customer's natural ask rate. Add longer-session evaluation separately as described below.

## Generation and label review

1. Build a scenario ledger with ordered events, candidate/interviewer attribution, superseded values, source-independent field meanings and the intended ambiguity. Mark facts that will remain deliberately unstated.
2. Assign the scenario family to a split and select the underfilled quota cell before calling a generator.
3. Ask generator A or B to render a natural conversation. Rotate generator roles across the corpus. Preserve disfluencies, corrections and incomplete chunks where appropriate without inserting the expected JSON into speech.
4. Have the other model independently extract facts and assess follow-up opportunities from the **rendered transcript at the visible cutoff**, without seeing the generator's answer key first.
5. Compare the independent annotation with the ledger and proposed label. A ledger fact omitted from speech is not an extractable fact. Resolve discrepancies by reviewing the transcript; quarantine unresolved cases.
6. Create single-preset and manually stepped multi-chunk variants with varied chunk boundaries. Preserve exchange IDs, synthetic timestamps and response completion; derive inference examples only at valid completion boundaries. Include responses spanning chunks. Do not impose a 15-second or 35-word pattern, or label partial context using future chunks.
7. Validate structure, quotes, references, semantics, duplicates and quota position. Record rejected attempts and repaired versions. Only accepted examples count toward quotas.
8. Review all locked-test and challenge labels with the user or a qualified reviewer. Independently double-annotate at least 20% plus every disputed or critical case. Adjudicate before freezing. Assistant/model review helps find issues but does not satisfy a human-review claim.

For training labels, use automated checks on every row and human review of at least 20% of accepted roots, covering every generator × primary bucket cell, plus every disputed and critical case. If the audit finds more than 2% wrong labels in a reviewed cell, quarantine that cell and expand review to 100% before release. Do not silently discard disagreements to manufacture high agreement.

Two models can share errors. Their agreement is an audit signal, not a substitute for transcript-grounded labels. Keep disagreements and hard abstention cases in the review queue; do not release only easy cases where teachers agree.

## Corpus balance

The machine-readable starting policy is [training/corpus-policy.json](training/corpus-policy.json). It specifies gates; enforcement code and sampling instrumentation still need to be built.

Measure balance per task and per split. For the training partition, inspect extraction modes separately and inspect both generators within each primary bucket. A corpus-wide average cannot excuse an empty conditional slice.

### Training label margins

| Dimension | Target |
| --- | --- |
| Accepted generator contribution | 50% each, within 5 percentage points |
| Extraction mode | 75% live, 25% final |
| Extraction primary risks | Ten buckets at 10% each, within 3 percentage points |
| Question decision | 50% ask, 50% abstain |
| Ask reasons | Quantify impact 12.5%; clarify ownership 7.5%; clarify claim/nature of impact 7.5%; practical value/trade-off 12.5%; explore stated role/interests 10%. No standalone checklist-gap questions |
| Abstain reasons | Already complete 15%; contact/logistics 15%; answered in visible context 10%; previously suggested 10% |
| Extraction answer density | 35% sparse (0–25% of requested fields supported), 40% medium (>25–60%), 25% dense (>60%) |
| Supported field opportunities | 35–50% of all requested field opportunities, with per-field coverage checked separately |
| Authored difficulty | 30% easy, 40% medium, 30% hard in training and the balanced core test |

The extraction primary risks are direct facts, missing information, corrections/retractions, current versus historical information, negation/conditions, numbers/units/ranges, multiple entities/speakers, field assignment under the frozen definitions, evidence/ambiguity, and continuation across chunks. Choose one primary bucket for quota accounting and retain all secondary tags. The primary tag must describe what is actually visible in that example, not a later event in its source conversation.

Overlapping primary question outcomes require a frozen precedence rule established during calibration. Keep secondary reasons for analysis. Within each training primary bucket, each generator contributes 40–60%, from at least 25 distinct roots. Validate quota feasibility before generation; do not relax gates automatically when a cell is difficult to fill.

Define difficulty from visible features before seeing student outputs: easy cases have direct unambiguous facts or obvious abstention; medium cases require combining related statements or applying one explicit correction; hard cases combine corrections, distractors, multiple entities, conditional negation or competing question opportunities. Length alone does not make a case hard. Audit both generators and ask/abstain classes across difficulty tiers so one model or class cannot supply all hard examples. The challenge partition deliberately emphasizes difficult transfer cases and has a separately declared composition. Allocate fractional integer quotas with largest-remainder rounding and a recorded tie-break seed; never drop a rare bucket through rounding.

For every default extraction field, training includes at least 50 distinct roots where it is supported and 50 where it is absent/unsupported. Report field-specific correction, ambiguity and negation coverage where applicable. Keep all 22 field IDs and definitions fixed. Vary which fields are supported, their co-occurrence and the speech used to express them. Any field-order variation must follow the pinned serialization policy; renamed fields or new schemas are outside this experiment.

### Context and position margins

Token bands count the actual serialized prompt **plus target**, with the pinned tokenizer and chat template:

| Total token band | Extraction | Questions |
| --- | ---: | ---: |
| Up to 1,024 | 0% | 0% |
| 1,025–2,048 | 20% | 60% |
| 2,049–4,096 | 55% | 40% |
| 4,097–8,192 | 25% | 0% in the first pilot |

October 22 feasibility correction: eight separate smoke fixtures measured extraction prompts at 1,684–1,688 tokens and question prompts at 1,297–1,300 with the actual local template. The former ≤1,024 quotas were impossible and are now zero. Do not add padding to manufacture a length band. Validate the remaining allocation during generation calibration before freezing a corpus.

Use 3 percentage points as the starting tolerance for density, mode and token margins. These are conditional quotas, not a requirement to fill an impossible full Cartesian product. Final-mode examples naturally occur at call end; do not force them into early-prefix bins. Live prefixes should cover early, middle and late positions, with a maximum 50% in any position band. Follow-up inputs include one, two and three completed exchanges, with no single window size exceeding 60% of question rows.

Check polarity, numbers, field coverage and answer location **inside each length band**. Long examples cannot all be easy positives. Questions with a three-exchange window cannot all be ask cases. Reserve evidence and corrections in the beginning, middle and end of longer contexts.

Never silently truncate to meet a sequence limit. Re-render or quarantine overlength examples and record the reason. Keep both prompt and target lengths, including examples where extensive evidence makes the target long.

## Concentration and effective training exposure

Balanced counts do not establish balanced concentration. A hundred prefixes from one interview are correlated, and long answers can dominate token-level training even if examples are evenly split.

Enforce these starting training limits **per task**:

| Source of concentration | Gate |
| --- | --- |
| Scenario family group | At least 200 groups; at most 4 roots and 8 examples per group, and at most 2% of input tokens or effective loss weight |
| One root conversation | At most 4 examples; extraction allows at most 3 live + 1 final |
| One root's input tokens | At most 1% of task input tokens |
| One root's effective loss contribution | At most 1% per epoch |
| Conversation template family | At least 20 families; each ≤5% of roots and rows, and ≤10% of input tokens and effective loss contribution |
| Field contract | Exactly `interview-fields-v1`; one shared schema is intentional. Audit field support and co-occurrence instead of inventing schema diversity |
| Role family within the veteran-interview domain | Eight allowed families; each ≤20% of rows. No requirement to spread across unrelated industries |
| Person or employer name | Each appears in ≤2% of roots |
| Location | Each appears in ≤5% of roots |
| Generator × primary bucket | Both represented, 40–60% generator mix and ≥25 roots each |
| Sampling repetition | No row sampled more than 2× its nominal per-epoch count; never oversample one root to fill a missing cell |

Each generator must also contribute 40–60% of input tokens and 40–60% of target tokens per task. This detects a generator contributing half the rows but nearly all long conversations. Development, locked-test and challenge partitions have their own concentration caps: at most four examples per root, 10% of roots/rows or 15% of input tokens from one template family, 5% of rows from one scenario family group, and 60% of rows from one generator. Report all the training audit dimensions on these partitions even where the smaller sample calls for a different numerical cap.

The name caps apply to synthetic person/employer identities, not the speaker label “Candidate,” common function words, or necessary technical vocabulary such as Python. Maintain an explicit exemption list rather than quietly excluding inconvenient entities from reports. Report concentration of canonical values as well, including unusually repeated salary ranges and notice periods.

Review the family taxonomy itself. Assigning a new template or scenario-family ID to a name-swapped copy does not create independent content. Verify group membership through blueprint structure, entity-masked transcript comparisons and semantic duplicate review; uniqueness of metadata IDs is not evidence of diversity.

For grouping variable `g`, report `HHI = sum(p_g²)` and `effective_groups = 1 / HHI`, with the denominator stated. Measure template concentration separately by unique roots, rows, input tokens and loss weight. The starting gates require at least 20 effective template families on root/row shares and 6 effective role families within this single domain on row shares. Maximum-share and effective-group gates both apply.

Track joint concentration: generator × primary risk, generator × ask/abstain, generator × difficulty, primary risk × difficulty, primary risk × length, extraction mode × answer density, role family × field support, and label × wording pattern. For material cells (at least 20 examples), report the largest contributing template/root group; a template may not supply more than 25% of such a cell. Sparse valid cells are explicitly listed and reviewed; they cannot be presented as validated coverage.

### Prevent token loss from defeating row balance

A positive question may have many target tokens while `{"questions":[]}` has few. Standard token-averaged loss can therefore give positive examples most of the optimization weight despite a 50/50 row split.

For the pilot, disable packing and compute assistant-only mean loss **per example**, then a weighted mean across examples. This makes nominal example weights interpretable. Instrument the trainer to verify 45–55% effective question loss weight for ask versus abstain and 45–55% for each generator. Maintain root and template caps after shuffling, weighting and retries. Never claim this is enforced by setting a sampler alone; verify the actual loss implementation.

For example `i`, let `T_i` be the number of supervised assistant tokens and `w_i` its sampling/loss weight. The effective-batch objective is `L = sum_i[w_i × mean_t(CE_i,t)] / sum_i(w_i)`. Effective exposure means the coefficient mass from `w_i`, including repeated sampling, **not** the observed cross-entropy magnitude. Report realized losses separately; hard examples naturally have larger losses. With gradient accumulation, preserve this weighting over the whole effective batch rather than normalizing each one-example microbatch in a way that cancels its weight.

Also report unweighted target-token shares, supported-value versus null-slot tokens, and field/mode contributions for extraction. Do not pad abstention targets with explanations just to create equal token counts. Any field-level reweighting needs a versioned rationale and tests that it does not reward empty outputs. Inspect exposure over each epoch and a rolling 100-example window; window drift above 15 percentage points is a sampler review trigger, while full-epoch limits are hard gates.

Run the corpus audit twice: once on accepted files and once on the **actual sampled training schedule**. A balanced manifest can become skewed through resampling, packing, length bucketing, retries or checkpoint resumption.

## Integrity gates and corpus release

Each row must retain:

```json
{
  "example_id": "train-extract-000001",
  "scenario_group_id": "group-000123",
  "root_id": "conversation-000456",
  "split": "train",
  "task": "extraction",
  "mode": "live",
  "template_family": "career-history-with-correction",
  "field_contract": "interview-fields-v1",
  "domain_scope": "us_veteran_civilian_job_interviews_v1",
  "domain_role_family": "systems_engineering",
  "generator_model": "anthropic/claude-haiku-4.5",
  "generator_provider": "record-actual-provider",
  "generator_prompt_version": "generator-v1",
  "generator_seed": null,
  "rendered_transcript_hash": "sha256-recorded-on-release",
  "visible_through_response": 3,
  "primary_bucket": "current_vs_historical",
  "secondary_tags": ["correction"],
  "field_definitions": [],
  "input": {},
  "target": {},
  "prompt_tokens": 0,
  "target_tokens": 0,
  "sample_weight": 1.0,
  "review_status": "pending",
  "annotation_version": "rubric-v1"
}
```

This is a metadata illustration, not a valid training row. Release validation requires populated field definitions, actual inputs/targets, measured positive token counts, real hashes and an accepted review state. Also retain request ID, decoding parameters, finish reason, raw generation, reviewer identity/type, evidence references, duplicate-cluster membership and repair lineage in the manifest or linked audit records. A missing provider seed is recorded as null, not invented as reproducibility evidence.

Hard release gates:

1. Zero invalid schemas, unknown output keys, broken evidence references or missing provenance in accepted rows.
2. Zero future-information leaks. A label for response 2 cannot use a correction arriving in response 5. Prompt input, model judge and human grader all see the same cutoff.
3. Zero cross-split scenario-family overlap, exact duplicates or unresolved semantic duplicate clusters. Compare source conversation content with common instructions, schemas and receipt metadata removed; also compare entity/number-masked views to catch superficial name swaps. Flag normalized word 5-gram Jaccard ≥0.80 or normalized-embedding cosine ≥0.95 for review; these are candidate detectors, not proof that examples are independent. Record embedding model/version and review outcomes.
4. No unresolved annotation disagreement in released rows. All gold/challenge labels have user or qualified-reviewer adjudication. All hard cases and all sampled training audit failures have disposition records.
5. Balance, minimum support, concentration and actual exposure gates pass. Supply an auditable exception only through a new policy version agreed before a run; no implicit waivers.
6. Negative examples cannot be released merely because both teachers abstain; verify that no timely, materially useful question was missed.
7. Revalidate labels after every transcript repair. Never keep the old answer key after changing a salary, employer, negation or response ordering.
8. Zero gold answers or annotation hints embedded in the student's transcript input. Distinguish genuine speech from generation scaffolding and strip scaffolding before label review.

Freeze a release with JSONL file hashes, manifest hash, rubric hash, policy version, generator/provider versions, tokenizer revision, audit report and exclusion lists. Generation and audit intermediates are not training inputs. Training jobs consume only the released manifest. If a gate fails, quarantine the affected data and generate new independent roots in deficient cells.

## Evaluation and promotion criteria

Score model output and harness behavior separately. Preserve raw output, schema acceptance, evidence rejection, formatting normalization, duplicate filtering and final merged state. A harness filter hiding a bad question is not model abstention; a matching quote is not semantic grounding.

### Extraction metrics

Use field-aware, narrowly normalized comparisons. A wrong non-null value counts as both a false positive and a missed correct value. Compute precision over populated predictions and recall over supported expected fields; do not inflate accuracy with many empty fields. Empty denominators are reported as not applicable with their counts, never as automatic 100% scores. Report micro totals, macro field averages, per-field support, live/final modes and critical slices.

Measure qualifier completeness separately: base versus total compensation, bonus percentage, currencies, destinations, timing conditions and corrected values. Report unsupported field assignments, evidence provenance and semantic evidence support. Track final-pass additions/removals relative to live output, including **new final errors** and regressions of previously correct fields.

### Follow up metrics

Use an adjudicated ask/abstain decision plus a semantic rubric, not exact question-text matching or number of questions alone. Review every emitted question against the visible context for a supported premise, usefulness, timing, answerability and duplication. Grade acceptable alternate phrasings against the information need rather than a single reference sentence.

Report ask precision, missed useful opportunities, abstention on negative cases, unsupported premises, exact and semantic repeats, and human usefulness ratings. Blind and randomize base/adapter output ordering. Cross-model judges provide auxiliary scores and disagreement queues; human-reviewed gold labels determine headline quality.

### Proposed promotion gates

| Area | Starting gate |
| --- | --- |
| Extraction precision | ≥97% on the locked core test, independently for live and final modes |
| Extraction recall | ≥93% in each mode, with no material collapse on sparse cases or unfamiliar terminology |
| Unsupported extraction | ≤1% of populated predictions in each mode; wrong-field assignments are unsupported for that field |
| Qualifier completeness | ≥95% of supported qualifier components preserved, including currencies, compensation components, relocation constraints and timing conditions |
| Evidence | 100% accepted quote provenance; ≥98% semantic support on reviewed populated fields |
| Supported extraction slices | Precision ≥90% and recall ≥85% for required slices with at least 20 relevant examples; report exceptions as failures or underpowered, not validated coverage |
| Critical extraction | Zero observed identity misattribution, compensation status/unit reversal, negation reversal or missed explicit replacement on the designated challenge cases |
| Final reconciliation | Report repairs and new errors separately; no critical regression from a correct live field |
| Question ask precision | ≥90% of suggestions are warranted |
| Question opportunity recall | ≥85% of adjudicated useful opportunities addressed |
| Question abstention | ≥95% on negative cases |
| Unsupported question premises | ≤1% of suggestions |
| Repetition | Zero exact repeats after harness filtering; ≤2% semantic repeats; raw repeat rate also reported |
| Usefulness | ≥85% of emitted questions score at least 4/5 on the agreed human rubric |
| Supported question slices | Ask precision ≥85% and negative-case abstention ≥90% for required slices with sufficient examples |
| Quantization | Q4 precision/recall drops ≤1 percentage point from the native adapted checkpoint, with no new critical failure |
| Demo responsiveness | Record per-click and finalization latency (P50/P95/max), failures and peak memory on the target machine; agree a usability target before promotion, with no 15-second streaming SLA |

Report numerators, denominators and 95% uncertainty intervals, using paired comparisons and resampling by independent root/scenario group rather than treating correlated prefixes as independent. Report all three confirmation seeds and the worst result. Zero observed critical errors describes the tested cases; it is not a population guarantee. Slices with fewer than 20 relevant examples are marked underpowered and require expansion before slice-level promotion claims.

Require a meaningful paired improvement over the frozen untuned baseline in the adapter's primary errors, with a starting target of 25% relative error reduction and no greater than 2 percentage point regression in recall. If the baseline already meets all absolute gates, require a clear measured benefit in the predefined failure slices instead of training for its own sake. Fix the primary error definitions and decision rule before revealing locked-test results; do not choose whichever metric improves afterward.

If test uncertainty does not distinguish candidate and baseline, label the outcome inconclusive and expand an independently designed evaluation set. Do not turn a failed locked test into a new development set while continuing to call it held out. Maintain a separately versioned future test reserve.

## Technical smoke outcome

The [disposable smoke run](training/SMOKE_RUN.md) passed native/local token parity, per-example loss/accumulation checks, two independent LoRA trainings, frozen-base checks, save/resume, reload, GGUF export and local Q4 routing with cache reuse disabled. These toy adapters are not promoted: extraction operation errors and question decision errors remain. The app retains its baseline profile. Full corpus release and semantic/native-Q4 quality evaluation remain required.

## Training recipe on Modal

Liquid documents LoRA SFT support for LFM2.5, and Modal provides a single-GPU Unsloth fine-tuning example. These establish available building blocks; the exact LFM module targeting and export path still require the smoke test. [Liquid training guide](https://docs.liquid.ai/lfm/fine-tuning/trl), [Modal example](https://modal.com/docs/examples/unsloth_finetune)

Train from native Hugging Face weights using BF16 LoRA initially, or a verified QLoRA path if memory requires it. The existing inference GGUF is not the training checkpoint. Treat training quantization and deployment Q4_K_M as separate configurations.

| Parameter | Initial experiment value |
| --- | --- |
| Adapter rank / alpha / dropout | 16 / 32 / 0.05 |
| Learning rate | `1e-4`; compare `5e-5` on development data only if needed |
| Epochs | Start at 2; maximum 3 for the pilot, with dev-based early stopping |
| Optimizer and schedule | AdamW, cosine schedule, 3% warmup; pin exact implementation |
| Maximum serialized length | Extraction 8,192; questions 4,096; reject overlength rows |
| Loss | Assistant-only, normalized per example, then weighted across examples |
| Packing | Off until loss weighting and boundary isolation are verified |
| Effective batch | Start at 16 examples through accumulation; record actual batch and token exposure |
| Gradient checkpointing | Enabled where supported and verified |
| Seeds | Development pilot 17; confirmation 17, 23, 47 |
| GPU | One A100 80GB is an initial profiling candidate, not a fit or cost guarantee; use a smaller GPU only after measured compatibility/memory results |
| Evaluation cadence | Every 50 optimizer steps and each epoch boundary; checkpoint on the agreed dev metric |

Confirm trainable parameter names/counts and hashes, gradients, optimizer state, completion masking and class weighting. Assert that the underlying checkpoint remains frozen and that only the selected task adapter trains. Freeze JSON serialization and field-order randomization policy; any randomized view inherits the root's exposure cap.

First overfit a small **training-only smoke subset** to check the implementation, then discard that result as quality evidence. Test two independently initialized adapter files, save/resume, export, native inference and quantized inference. A good training loss alone is not evidence that corrections or abstention improved.

Run extraction and question jobs independently. Select configuration/checkpoint using development data, then evaluate the frozen candidates once against locked sets. Start with SFT; add preference training for questions only if reviewed preference pairs show persistent ranking/abstention failures. Do not begin with reinforcement learning on an unvalidated automatic reward.

Pin model/tokenizer revisions, source commit, image digest, dependency lock, GPU type, CUDA/runtime versions, seeds, optimizer, scheduler, target modules, precision, data hashes and every checkpoint selection decision. Store checkpoints and reports in a persistent Modal volume with unique run paths and resumable state. Record billed usage, bound retries and stop on failed technical or quality gates.

## Export and integration

Prefer one resident checkpoint with separately selected task adapters if the exact llama.cpp architecture/export combination passes smoke tests. llama.cpp documents loaded LoRA adapters and request-specific selection, but this does not by itself prove every LFM target module converts correctly. [llama.cpp server documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)

Route extraction calls to adapter A and follow-up calls to adapter B. Do not enable both simultaneously without a separate composition experiment. Include adapter identity in prompt-cache isolation and clear incompatible state during switching. Verify adapter choice in request logs and outputs, not just in UI labels.

If runtime adapter export is unsupported, merge each adapter independently into its original native checkpoint, convert and quantize two artifacts, and profile the additional loading/memory cost. Compare both native and Q4 artifacts on identical examples. Retain the previous baseline profile as rollback. Preserve schema validation and provenance checks after training.

## Future long conversation evaluation (outside demo scope)

The demo promotion requires single-preset and manually stepped multi-chunk evaluation, including final reconciliation over the entire received preset. Long-call streaming, concurrency and hour-long soak tests are future deployment work, not demo release gates. The first corpus has training examples up to 8K tokens. It cannot establish hour-long extraction reliability merely because the model advertises 128K context. The app currently allocates 8K, so longer presets also require checking that the complete serialized prompt fits the configured context.

Before claiming long-call support, create at least 20 independent synthetic sessions across one-, two- and three-hour lengths, including varied speaking rates, pauses and source facts placed throughout the conversation. Define duration from the transcript/timing simulation, not a copied 15-second label. Include corrections separated by many minutes, earlier resolved questions outside the recent window, and misleading near-matches to prior employers and compensation.

Run final extraction at the full supported length, and live replay with the actual bounded state/window policy. Measure fact recall by position, correction retention, unsupported additions, summary quality separately, P50/P95/max latency, peak RAM/VRAM, queue growth, failures and retries under the target concurrent workload. Full-session and truncated-prefix forms remain in the same split.

If long-context quality fails, compare a versioned ordered-window extraction plus final reconciliation strategy with full-history extraction. That changes inputs and requires its own labels and evaluation. Do not silently change the harness while reporting a training-only improvement.

## Execution stages and stop conditions

| Stage | Work | Exit evidence | Stop when |
| --- | --- | --- | --- |
| 0 Contract and baseline | Agree rubric, limits, outcome metrics, frozen fields and harness fixes | Reviewed contracts, scorer fixtures, frozen baseline outputs, usage tracking | Labels depend on invisible state or scorer still rewards known errors |
| 1 Calibration | 20 independent fictional conversations, both tasks, both generators | Adjudicated examples, borderline decisions, feasible quota plan | Reviewers disagree on what a good answer means |
| 2 Pipeline smoke | Data validator/sampler, tiny adapter, export/routing and save/resume | End-to-end artifact, loss/exposure audit, no training/test leakage | Masks, gradients, exports, adapter routing or cache isolation fail |
| 3 Corpus pilot | Fill train/dev/core/challenge quotas and review labels | Immutable corpus release and every gate report | Underfilled cells, concentrated roots/templates, unresolved disagreement or leaked groups |
| 4 Task SFT | One initial configuration per adapter; limited dev-only comparison if justified | Checkpoints and dev error analyses | Loss improves while factual precision or abstention worsens; technical stop condition reached |
| 5 Confirmation | Three seeds per selected recipe, native/Q4 parity and locked evaluation | Paired metrics, slice counts, human review, uncertainty and known failures | Critical regression, unsupported additions above target, or inconclusive benefit |
| 6 Integration | App profiles, correct routing, single and manually stepped multi-chunk presets, end-of-preset reconciliation | Independent adapter promotion decisions, recorded responsiveness/memory, rollback and demo report | Quality, context fit, routing or the agreed demo usability target fails |

If either adapter fails, retain the other only if it independently passes. Expand the corpus by adding new roots in measured failure cells, then re-audit the entire release. Never add many paraphrases of one failure until its template dominates training.

## Records required for a run

Use this record as an execution checklist. A completed run must point to real artifacts, not placeholders:

- Experiment ID, objective, pinned requirements/rubric version and predefined primary comparison.
- Corpus version, hashes, root counts, complete audit reports and locked-test access history.
- Actual OpenRouter model/provider IDs, prompt versions, request IDs, token usage, retries, rejects and cost. Use structured outputs where supported and record routing changes; do not silently mix fallback model identities. [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs), [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)
- Modal app/job ID, source/image/dependency revisions, GPU, training parameters, seeds, billed usage and resumed checkpoints.
- Trainable module manifest, effective loss and sampler exposure reports, checkpoint selection rationale.
- Untuned, native-adapter and Q4 outputs, scorer revision, human judgments, per-slice metrics and uncertainty.
- Deployment artifact hashes, routing/cache tests, single/multi preset and resource results, promotion or rejection, known limitations and rollback path. Record long-call results separately if that future work is undertaken.

The immediate next deliverable is the 20-conversation calibration pack and agreed label rubric. Paid generation at scale and training follow only after the contract, corpus enforcement implementation and execution limits are concrete.

Calibration review reconciliation: the user-edited document is preserved with its hash and exact changes in `training/calibration-review-user-edits.json`. Those edits are incorporated into source labels, references and prompts; remaining cases received consistency edits, not automatic human approval. Calibration is now 12 ask/8 abstain. Its meaning must not be altered to manufacture a 50/50 calibration split; production quotas remain independent. `training/calibration-review-state.json` prevents regeneration from silently erasing new manual edits.
