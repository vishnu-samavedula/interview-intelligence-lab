# Two trained adapters: demo results

Both LoRAs are trained, exported and running locally. Open [the app](http://localhost:5174/) and select **LFM2.5 2.6B · trained demo** to compare it with **LFM2.5 2.6B · no thinking**. The baseline remains the default because the original preset still exposes important errors.

This experiment demonstrates measurable adaptation on unseen **synthetic** interviews. It does not establish reliable general understanding of arbitrary meeting transcripts. In particular, gains on the synthetic set did not transfer consistently to the original document preset.

## Before and after

The paired test contains 32 interviews across 16 held-out scenario families: 20 test interviews and 12 challenge interviews. Each model received identical serving prompts, schemas and deterministic decoding. The extraction figures below compare the model's raw output with machine-reviewed references, before harness validation.

| Measure | Base | Trained |
|---|---:|---:|
| Raw extraction reference-matching F1 | 70.7% | **91.3%** |
| Matched supported field values | 229 | **262** |
| Incorrect or unmatched non-null values | 146 | **39** |
| Missed or unmatched supported values | 44 | **11** |
| Invalid evidence fields rejected by the harness | 29 | **2** |
| Extraction F1 after validation | 68.8% | **91.3%** |

F1 uses conservative normalized matching, with predeclared allowances for supported concise service values, explicit relocation refusal, current-clearance descriptors and duration formatting. Valid unlisted paraphrases can still count as mismatches. Incorrect values count as both a false positive and a missed expected value. These are synthetic reference scores, not human-adjudicated accuracy.

A concrete held-out example says the candidate wants **systems integration** as future work but never names the current employer or title. The base returned the field description itself as the employer and used systems integration as the current title. The trained adapter left those two fields unknown. It still incorrectly used systems integration as the current program, illustrating that the improvement is incomplete.

## Clarifying questions: subjective comparison

Both Haiku and Gemini independently rated the displayed top-three lists, with model identity hidden and list order counterbalanced. No reference question wording was supplied. Ratings assessed grounding, relevance, distinctness, repetition, already-answered content and invented premises.

- 64 paired question batches, 128 ratings.
- **Trained preferred: 85/128 (66.4%)**; base preferred: 43/128.
- Both judges preferred trained in 33 batches, both preferred base in 12, and disagreed in 19.
- Haiku: 44 trained / 20 base. Gemini: 41 trained / 23 base.

| Average subjective rating | Base | Trained |
|---|---:|---:|
| Grounding, 0–5 | 3.32 | **3.95** |
| Relevance, 0–5 | 3.24 | **3.83** |
| Distinctness, 0–5 | 2.98 | **3.81** |
| Already-answered questions per displayed batch | 0.91 | **0.34** |
| Invented-premise questions per displayed batch | 0.25 | **0.19** |

The judges are the same two model families used for data generation/review. Blinding limits identity/order bias but does not remove shared preferences or teacher-style bias. This is evidence of a preference on this sample, not an objective question-quality verdict.

The model can return up to six ranked candidates; the app displays up to three and exposes the full ranking when more are returned. The trained model usually returned fewer than three in this run. The harness preserves model order and performs format/exact-duplicate checks; it does not rewrite questions or assign usefulness scores.

## Original preset: the practical limit

The original document preset was replayed through the real API in single and manual multi-chunk modes. Incomplete responses correctly skipped inference, and complete responses triggered extraction plus questions. This checks the demo flow, not only isolated model requests.

The trained model still made material mistakes:

- Live extraction chose former employer RTX/Raytheon instead of current employer Torch Technologies in both modes.
- The multi-chunk live result placed current compensation into the target-pay field and missed current pay.
- End-of-call extraction recovered Torch Technologies but still carried Patriot modernization into the current-program field and treated past defense-contracting work as a future interest.
- Army was emitted in the final raw extraction but rejected for incorrect quote provenance.
- Some questions repeated a previous information need or assumed an improvement/deployment that was not stated. A contact-only opening produced an unsupported question about Army phone/email responsibilities.
- The base summarizer also introduced errors, including framing a job change as relocation. Summarization was **not** one of the two trained tasks.

These failures are retained in the raw reports. No extra harness rules were added to repair their meaning. The result supports feasibility of focused adaptation, while showing that natural career chronology and indirect phrasing remain weaker than the controlled synthetic profiles. A further iteration would need more natural meeting examples and stronger coverage of those patterns; neither a larger nominal count nor a lower training loss alone establishes success.

## What was trained

- Native `LiquidAI/LFM2.5-2.6B`, revision `654f9463ce32b05d0429d76fe1f580b27d4c1ac0`.
- 63 training interviews / 32 scenario families; 12 development interviews. Eight role families, 32/31 generator split and unique supplied person names.
- 252 extraction training examples, 126 ranked-question training examples. All 22 fields have both supported and unknown examples.
- Completion-only, per-example mean loss. Frozen BF16 base; attention-only LoRA rank 16 / alpha 32, 1,703,936 trainable parameters per adapter.
- Selected by development loss: extraction epoch 2 of 3; questions epoch 3 of 5. Later epochs were not selected. Saved/reloaded development losses match exactly.
- Local inference uses Q4_K_M base plus two F32 GGUF adapters, 6,820,768 bytes each. Downloaded SHA256 hashes match the Modal export.
- Routing checks reproduce base probabilities exactly across servers and extraction probabilities exactly after switching back from the question adapter. No KV-cache reuse across adapter requests.

Training run: `20261026T145032Z-d1fb5b46`, [Modal run](https://modal.com/apps/liquid-ai/production/ap-NZNsA0kt4AmgbCl4BcCMKj). GPU work completed; the local model/API/frontend remain running. OpenRouter reported $5.208992 for this focused dataset generation/recovery and blinded question review, excluding earlier pilots/preflights and GPU charges.

## Reproducibility and checks

[Run manifest](training-run.json), [native training report](native-report.json), [export hashes](export-report.json), [routing verification](routing-report.json), [dataset lineage and corrections](runs/demo-reviewed-v1/manifest.json), [data audit](data-audit.json), [extraction results](evaluation-summary.json), [blinded question ratings](question-quality.json).

Original-preset raw outputs: [base replay](runs/original-base.json), [trained replay](runs/original-trained.json), [trained end-of-call extraction and base summary](runs/original-final-trained.json).

All 29 runtime/corpus tests now pass, including salary normalization and the six-candidate/top-three check. Frontend TypeScript passes. The dataset's native-tokenizer boundary and length checks pass without truncation. Student prompts are the actual serving prompts. Training/development inputs were frozen before training, and held-out label review did not change those inputs.

Raw generated data and model weights are local, git-ignored artifacts. See [demo instructions](README.md) for the exact commands. The older production-quota work remains separate from this experimental result.

Location-preset follow-up (October 27): [six-case diagnostic summary](location-preset-results.json). Displayed locations matched in 5/6 cases; Raleigh was present in raw output but had the wrong evidence turn ID. No location-specific harness rule or retraining was added.
