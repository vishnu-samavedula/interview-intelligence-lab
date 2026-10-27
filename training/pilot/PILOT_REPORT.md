# 50-interview pilot: generated, rejected for training release

The pipeline works mechanically. The corpus does **not** yet meet our quality or concentration requirements. No pilot rows are released for training, dev, locked test or challenge use. This run measures synthetic-data quality; it does not measure the 2.6B model's extraction accuracy or a trained adapter's performance.

Read [PILOT_REVIEW.md](PILOT_REVIEW.md) for ten concrete cases and proposed dispositions. Those recommendations are an assistant review, not human-approved gold.

## What ran

- 50 fictional veteran interviews: 25 rendered by `anthropic/claude-haiku-4.5`, 25 by `google/gemini-3.5-flash-lite`.
- Each model independently annotated each visible extraction prefix and full interview. Neither annotation saw the other model's answer or the scenario ledger.
- Corrected question annotations use exactly one supplied input, with one/two/three complete exchanges in 17/17/16 cases. Both models labeled the same visible input independently. No future extraction snapshot is supplied to an early question window; unmatched early cutoffs intentionally use an empty prior state.
- 200 derived rows: 100 incremental extraction, 50 final extraction, 50 questions. Each interview has single-chunk and multi-chunk reconstruction checks; incomplete candidate fragments are buffered. These are static demo examples, not timed streaming measurements.
- All 200 pass the app's structural/provenance checks and native tokenizer boundary/length checks. Zero truncations. Extraction examples use 2,348–4,424 total tokens; questions use 1,218–1,887. The pinned native tokenizer is the same one previously checked against local llama.cpp serving.
- OpenRouter reported $2.221088 for the v3 batch, recovery attempts and replacement question labels. Earlier setup/preflight requests are excluded; this is reported API usage, not an invoice reconciliation. No GPU training was launched for this pilot.

## Why release is blocked

| Finding | Evidence | Required change |
|---|---|---|
| Entity collapse | All 47 supplied names begin with Marcus; Marcus Vance appears in 23/50 roots. Apex Defense Solutions appears in 7/50. | Assign diverse fictional entity inventories before rendering, audit globally, and regenerate affected scenarios. Renaming alone does not establish story diversity. |
| Question labels disagree | Ask/abstain differs in 12/50 windows. Primary labels are 30 ask/20 abstain. | Adjudicate full-window relevance and semantic repetition; review all disputed examples. Agreement alone is not correctness. |
| Question-category collapse | 28/30 primary asks explore roles/interests; no primary quantify-impact or clarify-ownership labels. | Build richer visible contribution/value/ownership scenarios and genuine abstention contrasts. Label actual behavior; never relabel to satisfy a quota. |
| Generator-conditioned skew | Haiku primary labels: 19 ask/6 abstain. Gemini: 11 ask/14 abstain. Haiku supplies 63.75% of question target tokens despite 50% of rows. | Balance generator × observed decision/category and output-token exposure after semantic review. Do not silently reweight this draft. |
| Incorrect or ambiguous extraction | “Freed up two technicians” becomes total team size; remote openness becomes geographic relocation; historical bonus becomes recurring annual bonus. | Correct labels with explicit adjudication and review the affected semantic cells in full. Verbatim evidence is necessary but does not prove entailment. |
| Density/coverage drift | 11/50 final primary snapshots fall outside planned density. Military service is supported in all 50; master's fields in only six. | Control what can be spoken, then verify actual support and absence in candidate speech. Domain membership must not imply a field value. |
| Dialogue/history artifacts | Some history refers to work claims absent from the rendered interview; one question says “In turn 7.” | Create suggestion history from an earlier visible prefix, store its cutoff, and validate grounding/repetition. Reject transcript-ID language in user-facing questions. |
| Unverified story independence | No pairs exceed the lexical/entity-masked 5-gram threshold, despite severe name and dialogue-pattern concentration. | Complete semantic duplicate and scenario-taxonomy review. Twenty-five planned template IDs do not prove 25 distinct reasoning patterns. |

Equal root counts do not imply equal exposure. Extraction input/target token shares are approximately 53.5%/55.8% Haiku; question input/target shares are 50.4%/63.7%. The equal-example, unweighted question loss would be 60% ask. These are nominal diagnostics, not a measured optimizer schedule. Extraction mode mix is 67% live/33% final in this pilot, versus the production target of 75%/25%.

There are 179 extraction text disagreements across midpoint and final labels, plus 12 question-decision disagreements. Many extraction differences are acceptable concise/full variants; they are **not** 179 established errors. Human-reviewed accuracy and real-interview generalization remain unmeasured.

## Generation lineage and limitations

Seven v3 roots failed local validation and were preserved. Six recovered in a separate v4 directory. Root 001 repeatedly failed ledger sparsity; its five-field scenario ledger was authored by the assistant **before** Haiku rendered the transcript. It remains flagged as manually seeded; no transcript or annotation was silently edited. All failed request traces remain available. Final primary labeling still spuriously adds team size in that root, demonstrating why a valid seed is insufficient.

Initial question labels contained an empty example-context scaffold. They are superseded by independently generated v5 labels for all 50 roots. The original artifacts remain archived; they are not the packaged targets.

The production release gates and quotas are unchanged. A 50-root pilot cannot meet the minimum root, scenario-group, per-field support/absence or root-exposure requirements. All pilot families stay review-only; reserve them from future locked evaluation.

## Next iteration

1. Adjudicate the semantic rules illustrated in the ten-case review, including full-window questions after a logistics turn and suppression of semantically repeated suggestions. Existing intent allows useful questions from earlier responses in the visible window; a logistics response alone does not automatically erase them.
2. Prepare globally assigned entities, candidate fact allowlists, explicit support/absence coverage and visible-work-claim plans. Validate them before any rendering request. Match histories to the actual rendered prefix.
3. Regenerate failed concentration/coverage cells with new dialogue structures; quarantine all critical extraction disputes until reviewed. Add minimal contrasts where only ownership, polarity, temporal status or practical value changes.
4. Repeat semantic review, tokenizer/exposure reports and duplicate checks. Only then scale toward the frozen production quotas and train the two task adapters.

## Artifacts and verification

- [Ten-case review](PILOT_REVIEW.md)
- [Machine audit](runs/pilot-50-review-v5/audit-report.json)
- [Tokenizer report](runs/pilot-50-review-v5/tokenization-report.json)
- [Source/hash lineage](runs/pilot-50-review-v5/manifest.json)
- [Draft examples](runs/pilot-50-review-v5/pilot-examples.jsonl)
- [Corpus policy](../corpus-policy.json)

Raw runs are local and git-ignored. Pipeline source, plan and this report remain available for review. Verification: 26 existing Node tests and four pilot Python tests pass. Those tests validate contracts and failure handling; they do not certify label semantics.
