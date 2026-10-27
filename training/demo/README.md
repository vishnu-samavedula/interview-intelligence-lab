# Focused interview-adapter demo

The two LoRAs are now trained and available locally. See [measured results and original-preset limitations](RESULTS.md). The experiment tests whether two LoRAs improve extraction and clarifying questions on a 2.6B model. It is a synthetic demonstration, not production certification or a claim about real-interview accuracy.

## Contract

- Preserve the frozen 22 extraction fields. Interpret candidate speech, chronology, corrections, compensation and relocation normally. Unknown stays unknown.
- Generate up to six distinct clarifying questions in useful rank order; show the top three. Fewer or none are valid. There is no single correct question wording.
- Questions see the latest three complete exchanges and recent suggestions. The last logistical answer does not erase relevant earlier content in that window.
- Static single- and manual multi-chunk presets. Incomplete candidate responses are buffered before inference.
- The harness validates JSON/quote provenance, maintains state and displays output. It does not infer facts or score subjective question usefulness.

## Data

107 completed fictional interviews: 63 training, 12 development, 20 unseen test and 12 challenge. One planned training root (`full-0018`) remains excluded after invalid quote generation. The 642 examples contain 428 extraction examples and 214 ranked-question examples. Training uses 252 extraction and 126 question examples; development is separate.

Factual profiles use globally assigned entities and reviewed, split-specific utterance patterns. Work narratives are written by Haiku and Gemini. Both provide extraction proposals; a cross-review resolves proposed snapshots. Another model reviews question grounding, distinctness and ranking while accepting alternative useful questions. Explicit assistant corrections are recorded in the dataset manifest. These labels are machine-reviewed, **not human gold**.

All eight role families are represented in training (seven or eight roots each). Generator shares are 32/31 training roots, names are unique when supplied, and each frozen field has supported and unknown examples. Scenario-family IDs and exact transcripts do not overlap between training and held-out sets. Lexical uniqueness does not by itself prove semantic independence.

The earlier 50-interview pilot and production-scale planning artifacts remain separate. The user explicitly chose this focused experimental cycle; production corpus quotas do not gate it.

## Reproducible stages

```sh
# Resume synthesis only when needed; successful stages are cached.
python3 training/demo/generate.py --run demo-v1 --workers 8
python3 training/demo/recover.py --round 2

# Assemble immutable sources plus documented offline adjudications.
python3 training/demo/assemble.py
node training/demo/build.mjs

# Use the pinned native tokenizer; no silent truncation.
HF_HUB_OFFLINE=1 HF_HOME=/tmp/interview-training-hf uv run --offline --no-project --cache-dir /tmp/interview-training-uv --with transformers==4.57.1 --with jinja2==3.1.6 python training/demo/tokenize.py training/demo/runs/demo-reviewed-v1/examples.jsonl

# Already launched; do not duplicate a running job.
modal run training/demo/modal_train.py --dataset training/demo/runs/demo-reviewed-v1/training-frozen.jsonl
```

`training-frozen.jsonl` is immutable once launched. The run manifest records its hash and the actual training source hash. Held-out examples are not sent to training. The native model/revision and attention-only LoRA targets match the previously verified smoke stack. BF16 training uses completion-only, per-example mean loss, gradient accumulation, saved optimizer/RNG state, and development loss for checkpoint selection. Extraction runs three epochs and questions five. Both use rank 16, alpha 32, learning rate 1e-4. The base remains frozen.

After conversion, download the run from Modal, start `node training/demo/serve.mjs /absolute/artifact/path`, and select **LFM2.5 2.6B · trained demo** in the app. The baseline profile remains available. Extraction and questions route to different adapters; summarization uses the base. Adapter requests explicitly disable cache reuse.

```sh
node training/demo/evaluate.mjs training/demo/runs/demo-reviewed-v1/examples.jsonl training/demo/runs/evaluation-v1
python3 training/demo/judge-questions.py training/demo/runs/evaluation-v1 training/demo/runs/demo-reviewed-v1/examples.jsonl
```

The paired Q4 evaluation uses the same prompts, decoding and base weights. It reports raw and validated extraction separately, with conservative reference matching and explicit concise-value allowances. Question lists receive blinded ratings from both teachers; those are subjective ratings, not objective truth. Review representative before/after outputs alongside aggregate scores.

## Artifacts

- `training-run.json`: current job and frozen input/source hashes.
- `native-report.json`: development losses, selected epochs and frozen-base/reload checks, written after training returns.
- `export-report.json`: exported adapter sizes and hashes.
- `runs/demo-reviewed-v1/manifest.json`: source lineage and offline corrections.
- `runs/demo-reviewed-v1/data-audit.json`: coverage/concentration diagnostics.
- `runs/demo-reviewed-v1/training-frozen.jsonl`: exact train/dev records supplied to Modal.
- `runs/evaluation-v1/summary.json`: paired extraction results.
- `runs/evaluation-v1/question-quality.json`: blinded subjective question ratings.

Raw runs and model artifacts are git-ignored. API credentials remain in the local ignored `.env` and are never uploaded to Modal.
