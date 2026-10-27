# Interview Intelligence Lab Demo

A local, offline proof of concept for extracting candidate information and generating useful clarifying questions from veteran job interviews, using single presets and manually stepped transcript chunks.

The demo runs on localhost, uses `llama.cpp` for inference, and compares the reasoning-capable `LFM2.5-2.6B` and `LFM2.5-1.2B-Thinking` checkpoints with reasoning disabled. The current baseline is the 2.6B model.

> This repository is a demonstration and learning exercise. It is not a production interview, hiring, or decision-making system.

Two experimental LoRA adapters are now trained and available in the local app as **LFM2.5 2.6B · trained demo**. See [measured results and limitations](training/demo/RESULTS.md) and the [focused demo instructions](training/demo/README.md). Questions are generated as up to six ranked candidates, with the top three displayed. The earlier production-scale [runbook](TRAINING_RUNBOOK.md) remains reference material; this is a focused synthetic experiment.

## Measured training results

The completed experiment uses **63 training interviews, 12 development interviews, 20 held-out test interviews and 12 challenge interviews**. Related scenario variants stay in the same split. The 32 test/challenge interviews span **16 held-out scenario families** excluded from training.

| Task | How it was evaluated | Result |
|---|---|---|
| Extraction | Base and trained raw outputs matched against held-out, machine-reviewed synthetic references | F1 **70.7% → 91.3%** |
| Clarifying questions | Haiku and Gemini blindly compared displayed top-three lists on 64 held-out windows | Trained preferred in **85/128 ratings (66.4%)** |

Extraction F1 is reference matching, **not judge scoring**. The references are not human gold, and conservative matching can miss valid paraphrases. Question ratings are subjective: both judges preferred trained in 33 windows, both preferred base in 12, and disagreed in 19. The same teacher-model families generated/reviewed the training data, so shared preferences remain a limitation.

Much of the training/evaluation data combines structured factual profiles with model-written work narratives. These gains do **not** establish reliable extraction from arbitrary natural meetings. The original document preset still exposes current/former employer confusion, incorrect evidence turn IDs, unsupported current-program assignments, and repeated or assumptive questions. See [the full results](training/demo/RESULTS.md) for preserved failures and exact experiment details. The displayed metrics predate the later salary-formatting fix; raw-model scores are unchanged by that fix.

Trained checkpoints are deliberately **git-ignored**. The source, recipes and compact reports are versioned; `models/`, GGUF/safetensors weights, optimizer/checkpoint files, credentials and generated run directories remain outside Git. Training run metadata and export hashes are in [training/demo](training/demo/README.md).

## Try the trained model and location presets

Open `http://localhost:5174/`. Choose **LFM2.5 2.6B · trained demo** under **Model under test**; the baseline remains selectable. Model selection persists across refreshes, and a fresh session prefers the trained profile when its local server is available. The trained server must have both local adapter files loaded; see [startup instructions](training/demo/README.md).

The **Candidate interview** dropdown includes these six new presets in both single- and multi-chunk modes:

- **Location · Explicit Huntsville** — directly states the current city.
- **Location · Here in Huntsville** — embeds location in the current-job description.
- **Location · Norfolk before, Raleigh now** — separates past and present cities.
- **Location · Austin corrected to Reno** — updates the earlier location.
- **Location · Madison home, Denver HQ** — separates home, headquarters and client travel.
- **Location · Denver is a future move** — leaves current location unknown rather than copying the relocation destination.

The initial single-chunk trained-model diagnostic displayed correct locations in **5/6 cases**, in both live and end-of-call extraction. Raleigh was selected correctly in the raw model output but rejected because its evidence cited the wrong turn. The simpler “here in Huntsville” preset succeeded; **no location harness fix or retraining was applied**, and the longer original preset still misses Huntsville. These are diagnostic presets, not additional training data or a general location-accuracy claim. The [compact diagnostic summary](training/demo/location-preset-results.json) is versioned for inspection.

After processing, use **View suggested questions** beside the controls to jump to the question panel. Empty states distinguish waiting for a complete response, no questions returned, and questions rejected for formatting/duplication; prior suggestions remain in the history.

## Demo contract

### Intent

Test whether an offline model can perform two useful interviewer-assistance tasks fast enough to run alongside a transcript stream:

1. Extract candidate details into the frozen 22-field interview checklist.
2. Generate up to six ranked clarifying questions from the latest three complete exchanges, and display the top three. Questions can explore stated roles/interests, personal contribution, results, practical value and consequential trade-offs.

The purpose is to expose the model's actual strengths, limitations, latency, and memory requirements. The harness must not silently repair semantic model errors to make the model appear more capable.

### Input assumptions

- Input is clean English text produced by an external speech-to-text system.
- Speaker roles are identified as `Interviewer` and `Candidate`.
- Multi-chunk presets use static 15-second windows at approximately 35 words each; processing is manual, not a timed stream.
- Presets carry ordered chunk IDs, timestamps, exchange IDs and candidate-response completion flags. Incomplete answers are reassembled before inference.
- Audio capture, diarization, and speech recognition are outside this repository.

### Outputs

- A checklist snapshot using the configured field IDs.
- Raw and accepted extraction output for inspection.
- Zero or more interviewer follow-up questions.
- Inference latency, TTFT, decode throughput, token counts, process memory, and model storage measurements.
- Synthetic quality measurements for the included presets.
- An optional end-of-call reconciled checklist with transcript evidence, a live-to-final comparison, and an AI summary.

### Model and harness responsibilities

The model owns semantic interpretation:

- Understanding candidate statements.
- Distinguishing current and target compensation.
- Applying explicit corrections.
- Separating current from historical experience.
- Deciding whether a follow-up question is useful.
- Writing the follow-up question.

The harness performs mechanical work:

- Calls the selected local model endpoint.
- Parses JSON.
- Validates explicit `set`, `clear` and `unchanged` decisions; rejects invalid operations while preserving prior state.
- Uses the frozen 22-field checklist and rejects unknown extraction keys.
- Checks candidate quote provenance. A user-authorized salary-only formatting exception expands clear US annual-pay shorthand; raw model values and source quotes remain available.
- Rejects malformed or duplicate questions.
- Merges extraction state and records raw output.
- Measures performance and compares results with synthetic expectations.

The harness does not invent facts, reassign salary between current/target fields, or semantically correct names, employers, titles, programs, locations or questions. Salary normalization is a narrow formatting heuristic, not evidence that the model inferred the units correctly.

### Success criteria for this demo

- Single presets and manually stepped multi-chunk presets complete with usable measured responsiveness; no timed streaming deadline applies.
- The 2.6B model extracts common interview fields with visibly useful quality.
- The model generates relevant clarification or impact questions from a transcript chunk.
- Raw model behavior remains visible when the model misses, invents, or over-asks.
- The app can compare fixed presets and model profiles consistently.

### Non-goals

- Production reliability, security hardening, or multi-user deployment.
- Automated hiring recommendations or candidate scoring.
- Perfect extraction recall or guaranteed question abstention.
- Speech-to-text, audio processing, or speaker diarization.
- Streaming queue simulation, long-session soak testing, or concurrency testing.
- Production certification or real-interview generalization claims for the experimental adapters.
- Cloud inference or internet-dependent runtime behavior.

## Architecture

```text
┌──────────────────────────────┐
│ Browser demo                 │
│ presets · fields · quality   │
└──────────────┬───────────────┘
               │ POST /v1/analyze
               ▼
┌──────────────────────────────┐
│ Local Node adapter :8000     │
│ prompt · parse · metrics     │
└──────────┬───────────┬───────┘
           │           │
           │ 1         │ 2
           ▼           ▼
┌────────────────┐  ┌────────────────┐
│ Extraction     │  │ Follow-up      │
│ complete       │  │ latest three   │
│ responses      │  │ exchanges      │
└────────┬───────┘  └────────┬───────┘
         └──────────┬────────┘
                    ▼
        ┌────────────────────────┐
        │ Selected llama.cpp     │
        │ LFM 2.6B or 1.2B       │
        └────────────────────────┘
```

Each analysis performs two sequential calls because the selected `llama.cpp` server uses one inference slot:

1. **Extraction:** receives all completed candidate responses, the frozen field IDs and definitions, and the previous snapshot. Incomplete responses are buffered. It returns `{operation, value, evidence}` for every field. `set` requires candidate quote/turn evidence; `clear` explicitly removes a prior value; `unchanged` preserves state. Invalid decisions are audited and leave prior state intact.
2. **Question generation:** receives the latest three completed exchanges, missing checklist fields from the accepted extraction snapshot, and up to six recent suggestions. Gaps are context, not an instruction to fill the checklist with questions. The model chooses one useful unresolved follow-up or none.

`POST /v1/analyze` returns `analysisPerformed: false` without calling the model when no new candidate response has completed. The caller supplies `processedResponseCount` from the last successful analysis so completed responses are not reprocessed on buffering-only updates. Receipt and inference counts are separate.

The extraction safety ceiling is 4,096 generated tokens. The question-generation ceiling is 768 generated tokens. These are output limits, not allocated context-window targets.

The default server allocates an 8,192-token context to keep KV-cache memory and latency predictable. The model's larger advertised context capacity is not allocated by default.

## Repository structure

```text
.
├── runtime/
│   └── llama-adapter.mjs       # Local API, prompts, validation, and metrics
├── web/
│   ├── app/
│   │   ├── page.tsx            # Demo workflow and quality panel
│   │   ├── globals.css         # Application styling
│   │   └── layout.tsx          # Page metadata and root layout
│   ├── components/ui/          # Reusable interface primitives
│   ├── lib/
│   │   ├── default-fields.ts   # Default extraction checklist
│   │   ├── static-cases.ts     # Synthetic interview presets and truth data
│   │   └── harness-types.ts    # Shared application types
│   ├── public/                 # Local visual assets
│   └── package.json            # Web scripts and dependencies
├── models/                     # Local GGUF checkpoints; ignored by Git
├── PROJECT_DESCRIPTION.md      # Extended POC background and evaluation plan
├── LICENSE                     # MIT license for repository code
└── README.md                   # Demo contract and operating guide
```

## Included scenarios

The app exposes three veteran job-interview presets: the original document example, a systems engineer and a security architect. The original document is the default in both single and manual multi-chunk modes. Thirteen total fixtures remain in source for regression work; the older broad interview fixtures are not selectable in the demo. Historically, the original eight cover:

- Clear and quantified answers.
- Vague impact claims.
- Personal ownership ambiguity.
- Current versus former employment.
- Education and early-career experience.
- Compensation, availability, and relocation.
- Mid-conversation corrections.
- The original defense-engineering interview example.

Five additional presets marked `-15s` approximate a single realistic transcript update and test vague impact, quantified impact, unclear ownership, logistics-only content, and an in-chunk correction.

The presets are deterministic evaluation fixtures, not representative hiring data.

### Manual chunk demonstration

Choose **Single chunk** to analyze a complete preset in one click, or **Multiple chunks** to step through one of the three veteran interviews with **Process chunk**. Multiple-chunk mode starts with the original document example (eight chunks).

Each simulated chunk contains up to 35 words in a 15-second window (140 words/minute). Speech can cross chunk boundaries. Exchange IDs stay stable across fragments: one turn means an interviewer–candidate exchange. Dates and UTC receipt timestamps are fixed synthetic metadata. These are simulated timings, not measurements from audio.

The model receives transcript JSON with `chunk_id`, `date`, `timestamp`, `start_seconds`, `end_seconds`, and `turns`. Each turn has a `turn_id`, the available `interviewer` and/or `candidate` text, and a `response_complete` flag on candidate speech. This explicit completion signal comes from the synthetic fixture; live integration must provide its own response-boundary signal. The incoming JSON is inspectable in the interface.

Each click receives one chunk. If it contains no newly completed candidate response, the app shows **Awaiting continuation** and retains the last results without inference. Once a response completes, its fragments are joined with its interviewer question. Extraction sees all completed responses; question generation sees the latest three completed exchanges. Multiple responses completed in the same chunk are analyzed together. The checklist accumulates, current suggestions are replaced, and question/performance history is retained. After the final chunk, the interface displays **End of chunk received · All chunks processed.** Reset starts again from the first chunk. Failed processing can be retried without advancing.

Extraction precision and recall are shown after the final chunk; whole-preset question expectations are not applied to partial chunks. This manual demonstration does not implement timed ingestion, queues, or bounded context management.

### End-of-call review

After analyzing a single preset or receiving all chunks, choose **End call & summarize**. This runs two local inference calls: fresh extraction from the full received transcript, followed by an AI summary with key points and unresolved questions. Final extraction does not receive the live values as facts and does not carry previous values into null fields. Every populated final field must include a candidate quote and turn ID; the harness checks the quote against the reconstructed candidate speech and attaches its source chunk IDs and receipt timestamp. A matching quote proves provenance, not that the model assigned the fact to the right field.

The interface retains the live checklist, shows a separate final checklist with evidence, lists missing fields, and compares live and final values. Changes include wording and formatting differences and are not automatically labeled corrections. Raw model outputs remain inspectable. If reconciliation or summary generation fails, the live results remain available and the action can be retried.

The final extraction and summary ceilings default to 4,096 and 1,536 output tokens (`FINAL_EXTRACTION_MAX_TOKENS` and `SUMMARY_MAX_TOKENS`). The demo server still allocates an 8K context; hour-long full-transcript processing requires a larger context configuration and separate validation. Final results and summaries are model-generated and require review.

## Local setup

### Requirements

- macOS on Apple Silicon for the current local demonstration.
- Node.js 22.13 or newer.
- `llama.cpp` with Metal support.
- Hugging Face CLI for downloading checkpoints.

Install `llama.cpp` and download the recommended model:

```bash
brew install llama.cpp

hf download LiquidAI/LFM2.5-2.6B-GGUF \
  LFM2.5-2.6B-Q4_K_M.gguf LICENSE README.md \
  --local-dir models/LFM2.5-2.6B-GGUF
```

The optional comparison model is:

```bash
hf download LiquidAI/LFM2.5-1.2B-Thinking-GGUF \
  LFM2.5-1.2B-Thinking-Q4_K_M.gguf LICENSE README.md \
  --local-dir models/LFM2.5-1.2B-Thinking-GGUF
```

Model files are intentionally excluded from Git. Model weights and their accompanying license files remain governed by their respective upstream licenses.

### Start the 2.6B model

```bash
llama-server \
  -m models/LFM2.5-2.6B-GGUF/LFM2.5-2.6B-Q4_K_M.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  --gpu-layers 99 \
  --ctx-size 8192 \
  --parallel 1 \
  --jinja \
  --metrics \
  --reasoning off \
  --reasoning-budget 0
```

To enable the 1.2B model switcher option, start its server separately:

```bash
llama-server \
  -m models/LFM2.5-1.2B-Thinking-GGUF/LFM2.5-1.2B-Thinking-Q4_K_M.gguf \
  --host 127.0.0.1 \
  --port 8081 \
  --gpu-layers 99 \
  --ctx-size 8192 \
  --parallel 1 \
  --jinja \
  --metrics \
  --reasoning off \
  --reasoning-budget 0
```

### Start the adapter

From the repository root:

```bash
node runtime/llama-adapter.mjs
```

The adapter listens on `http://127.0.0.1:8000`.

### Start the web app

```bash
cd web
npm ci
npm run dev
```

Open the local URL printed by the development server. If the default port is occupied, start Vinext on another port, such as 5174:

```bash
./node_modules/.bin/vinext dev --port 5174
```

## API

The local adapter exposes:

- `GET /health` — default model and adapter health.
- `GET /v1/models` — configured model profiles and availability.
- `POST /v1/analyze` — extraction followed by question generation.
- `POST /v1/finalize` — full-transcript extraction with evidence, live-to-final changes, and an AI summary; accepts the same `segments`, `fields`, `modelId`, and `previousSnapshot` inputs.

Runtime overrides:

- `ADAPTER_PORT`
- `DEFAULT_MODEL_ID`
- `LFM12_URL`
- `LFM26_URL`
- `LFM12_MODEL_NAME`
- `LFM26_MODEL_NAME`
- `LFM12_MODEL_PATH`
- `LFM26_MODEL_PATH`
- `EXTRACTION_MAX_TOKENS`
- `QUESTION_MAX_TOKENS`

## Frozen extraction fields

The demo uses `interview-fields-v1`, defined in `runtime/field-contract.mjs`. The field editor and browser configuration tool have been removed. Both API routes use this server-owned contract, ignoring client field overrides. Field IDs, labels and definitions are supplied to the model.

Default fields include identity, location, contact details, education, military service, security clearance, current employment, tenure, team size, current program, technologies, interests, reason for leaving, compensation, availability, and relocation.

## Measurement and quality checks

The app records:

- End-to-end generation latency.
- Time to first token.
- Decode tokens per second.
- Input and output token counts.
- Selected model process memory.
- GGUF storage size.
- Per-call extraction and question latency.

Historical measurements, before the explicit-operation/evidence contract and also before complete-response buffering and three-exchange question window changes: the original eight-preset run on the development M5 Max produced the following aggregate results. Both models used Q4_K_M, an 8,192-token context, deterministic decoding, reasoning disabled, and strict JSON schemas. The five newer `-15s` presets are not included in these aggregate numbers.

| Model | Extraction precision | Extraction recall | Avg. two-call latency | Avg. extraction | Avg. questions |
|---|---:|---:|---:|---:|---:|
| LFM2.5-1.2B-Thinking | 65.4% | 25.4% | 0.69 s | 0.60 s | 0.09 s |
| LFM2.5-2.6B | 86.1% | 92.5% | 2.11 s | 1.47 s | 0.63 s |

These are indicative synthetic-demo measurements, not formal benchmarks or evidence for unrelated production domains. The preset scorer uses strict field-aware matching; small wording differences can count as wrong.

The quality panel compares the accumulated record with facts supported by the transcript seen so far. It reports correct, missed, wrong-field/value, and unsupported values. Placeholder cleanup and invalid output are shown separately and do not count as model hallucinations. The scorer accepts narrow formatting equivalences (phone punctuation, explicit salary units and number words) and otherwise requires normalized equality. It does not use substring matching or treat shared relocation intent as sufficient. Missing qualifiers fail; valid paraphrases can also fail and need human review. Quote provenance is not semantic correctness, and the question count check is not a usefulness score. These synthetic checks are an evaluation aid rather than a production correctness guarantee.

## Known model behaviors

- The 2.6B model is materially stronger than the 1.2B Thinking model for extraction on the current presets.
- On five realistic 15-second extraction samples, the 2.6B recovered all 11 expected facts and made seven unsupported field assignments: 61.1% precision and 100% recall. The harness separately cleaned up 11 placeholder phrases, which are not counted as hallucinations. These cases are directional fixtures, not a production-domain benchmark.
- The 1.2B Thinking model remains useful as a fast comparison baseline or a candidate for a narrower trained routing/classification role; it is not the recommended zero-shot extractor based on current results.
- Strict extraction schema decoding is required for the 1.2B Thinking checkpoint in this setup. The llama.cpp reasoning-off flags alone did not prevent it from spending the output budget on a reasoning trace.
- Concise prompts work better than large field-definition maps for the tested quantized model.
- Salary-unit interpretation is model-owned; the harness preserves amounts exactly apart from whitespace.
- Corrections expressed indirectly, such as “correct the timing,” may still resolve to the earlier value.
- Historical programs may occasionally be classified as current.
- In an isolated eight-case 2.6B question test, the prompt passed six cases, caught all four vague answers, and correctly abstained on contact and compensation at about 0.22 seconds average latency. It still asked methodology questions for two already-quantified achievements.
- The question prompt now treats a stated contribution plus a concrete number, percentage, scale, scope, or timeframe as complete and says that missing methodology alone is not a follow-up trigger. This revision still needs to be re-scored on the same cases.

These behaviors remain visible by design.

## Validation

```bash
node --check runtime/llama-adapter.mjs
node --test runtime/transcript-json.test.mjs runtime/end-of-call.test.mjs
# With the model and adapter running, save three original-preset comparisons:
node runtime/compare-response-modes.mjs
cd web
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

## License

Repository source code is available under the [MIT License](LICENSE). This repository is intended as a demo/POC; the MIT license itself permits broader use subject to its terms. Model weights, third-party packages, fonts, and vendor assets retain their own licenses.

## Earlier training design and calibration

Review [20 draft calibration conversations](training/CALIBRATION_REVIEW.md) before approving labels. Machine-readable single/multi variants and expected live/final outputs are in `training/calibration-v1.json`; rebuild and validate with `node training/build-calibration.mjs`. These are assistant-authored calibration examples, excluded from training and locked tests. The offline corpus auditor checks structural and numeric concentration gates, including the frozen veteran domain and allowed role families. Semantic labels, taxonomy, contrast coverage and trainer-loss verification remain release gates; the auditor cannot approve a release alone. The new-contract zero-shot smoke run has known extraction and question regressions; see [baseline notes](training/BASELINE_NOTES.md).

[Eleven paired intent checks](training/INTENT_CONTRASTS_REVIEW.md) supplement calibration with current/former, active/expired, ownership/impact, corrections, relocation, education, salary-status and paraphrase contrasts. Rebuild with `node training/build-intent-contrasts.mjs`. They remain draft calibration material and are excluded from training and locked evaluation.

The [two-adapter technical smoke](training/SMOKE_RUN.md) now passes native training, reload, GGUF export and isolated local Q4 routing. These disposable adapters are not deployed in the app and do not establish task quality; recorded operation and question errors remain.

Calibration review edits are reconciled into source labels, with supported concise/full alternatives. Rebuilding refuses to overwrite new manual review edits until they are reconciled; see `training/calibration-review-user-edits.json` for the preserved user corrections. Role-specific career-interest/contribution questions are allowed even without a vague achievement.

Salary display normalization (October 26): the harness expands clear US annual-pay shorthand in current/target salary fields, such as `178 base` and `205 to 215 range`, to full dollar amounts. It preserves bonus percentages, qualifiers, raw model output and source quotes, and skips hourly/monthly pay, allowances and non-US currencies. This formatting exception does not reassign pay between fields. Model selection persists across reloads; fresh sessions prefer the available trained demo. A question-status link beside the run controls leads to suggestions/history, including an explanation when the model returned none.
