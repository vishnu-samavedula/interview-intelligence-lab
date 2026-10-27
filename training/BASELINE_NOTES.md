# Explicit-operation baseline smoke, October 22, 2026

This is one run of the original document preset in each mode on the existing local LFM2.5-2.6B Q4_K_M server. It verifies integration and exposes failure modes; it is not a held-out evaluation, a statistical quality estimate or a training result. The contract and prompt changed together, so this cannot isolate the effect of field definitions, operations or evidence requirements.

Raw outputs, model timings and source-file hashes are retained in [baseline-contract-v1-original.json](baseline-contract-v1-original.json). Prior flat-output comparisons remain historical and are not directly comparable scores. The new scorer is also stricter.

| Observation | Single | Manual multi |
| --- | --- | --- |
| Receipt/inference counts | 1 receipt, 1 analysis | 8 receipts, 5 analyses; 3 partial-response receipts buffered |
| Reported extraction + question time per analysis | 9.332 seconds | 5.340–8.546 seconds |
| Final live employer | Incorrectly Raytheon/RTX | Incorrectly RTX/Raytheon |
| Unsupported current program | Patriot modernization | Patriot modernization |
| Evidence/operation rejections | 2 updates: military service and title quotes did not match | 2 updates: invalid salary operation/value and missing evidence |
| Question failure | Asked sensor/scenario scope rather than the missing concrete outcome | Asked team size without a supporting claim; later implied an unestablished error-rate reduction |

The zero-shot model regressed compared with earlier manual checks under the simpler flat contract. Matching candidate quotes did not prevent historical/current confusion or unsupported field assignments. Do not classify these as repaired, or assume training will necessarily solve them. Keep semantic correctness separate from JSON acceptance and quote provenance. No 15-second timing gate applies to this demo.

Before promotion, evaluate the untuned model and each candidate adapter on identical agreed inputs, using raw and delivered outputs, human-reviewed semantic labels and the runbook's separate live/final gates. Run final reconciliation separately; this smoke record covers incremental extraction and question generation only.

The [20 calibration conversations](CALIBRATION_REVIEW.md) and their [machine-readable labels](calibration-v1.json) are assistant-authored drafts. They have structural, state-operation, quote and single/multi reconstruction checks, but human semantic review is pending. Do not use them as training examples or locked evaluation gold. Rebuild with `node training/build-calibration.mjs`.

Remaining engineering: semantic evaluation and final-result scoring, semantic corpus audits and verified trainer sampling/loss, training-template parity, native checkpoint/module verification, tiny adapter training/export test and local adapter routing. An offline auditor now implements structural and numeric concentration checks, plus schedule-exposure checks. Semantic domain/contrast review, independent token verification and trainer-loss verification remain outstanding. No released training corpus has passed all gates.

## Veteran intent diagnostic

A two-variant single-chunk check using the narrowed veteran prompts is recorded in [baseline-intent-activity.json](baseline-intent-activity.json). This is calibration-only and is not a full paired statistical comparison or manual multi-chunk replay. The expected labels remain drafts.

- Activity-only answer: the candidate already supplied 1,000 simulation scenarios. The model asked for the exact scenario count again, and for a tracking metric, instead of the unresolved analytical finding.
- Contribution plus outcome: the candidate explained using simulation results to change a filter and reduce tracking error from eight to three percent. The model still asked for a timeframe and simulation-validation methodology rather than abstaining under the agreed recipe.

These are assistant-reviewed diagnostic failures, not human-adjudicated gold. Raw and delivered questions are retained. Matching ask/abstain alone would miss the first question's redundant premise. No training has been launched.

User review subsequently clarified that a quantified technical result may still warrant a question about practical team value or consequential trade-offs. The older abstention labels in archived diagnostics predate rubric v2 and must not be reused as current gold. Methodology-only and already-answered questions remain inappropriate.
