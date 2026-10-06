# Interview Intelligence Lab Demo

A local, offline proof of concept for testing whether small Liquid Foundation Models can add useful intelligence to English interview transcripts within a 15-second transcription cadence.

The demo runs on localhost, uses `llama.cpp` for inference, and compares the reasoning-capable `LFM2.5-2.6B` and `LFM2.5-1.2B-Thinking` checkpoints with reasoning disabled. The current baseline is the 2.6B model.

> This repository is a demonstration and learning exercise. It is not a production interview, hiring, or decision-making system.

## Demo contract

### Intent

Test whether an offline model can perform two useful interviewer-assistance tasks fast enough to run alongside a transcript stream:

1. Extract candidate details into a configurable information checklist.
2. Generate useful follow-up questions from the newest transcript chunk when a claim, personal contribution, or impact needs clarification.

The purpose is to expose the model's actual strengths, limitations, latency, and memory requirements. The harness must not silently repair semantic model errors to make the model appear more capable.

### Input assumptions

- Input is clean English text produced by an external speech-to-text system.
- Speaker roles are identified as `Interviewer` and `Candidate`.
- Transcript chunks are expected approximately every 15 seconds.
- Chunks preserve their order. IDs and timestamps may be supplied by the calling application but are not required for the static demo.
- Audio capture, diarization, and speech recognition are outside this repository.

### Outputs

- A checklist snapshot using the configured field IDs.
- Raw and accepted extraction output for inspection.
- Zero or more interviewer follow-up questions.
- Inference latency, TTFT, decode throughput, token counts, process memory, and model storage measurements.
- Synthetic quality measurements for the included presets.

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
- Ignores null values and placeholder text.
- Rejects unconfigured extraction keys.
- Applies lightweight salary display normalization.
- Rejects malformed or duplicate questions.
- Merges extraction state and records raw output.
- Measures performance and compares results with synthetic expectations.

The harness does not invent, relabel, or semantically correct names, employers, titles, programs, locations, compensation, or questions.

### Success criteria for this demo

- Both inference calls complete comfortably inside the 15-second transcript cadence.
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
- Fine-tuning or supervised training.
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
│ all supplied   │  │ newest segment │
│ transcript     │  │ only           │
└────────┬───────┘  └────────┬───────┘
         └──────────┬────────┘
                    ▼
        ┌────────────────────────┐
        │ Selected llama.cpp     │
        │ LFM 2.6B or 1.2B       │
        └────────────────────────┘
```

Each analysis performs two sequential calls because the selected `llama.cpp` server uses one inference slot:

1. **Extraction:** receives every transcript segment supplied in the request and the configured field IDs. It returns a flat JSON object constrained by a dynamically generated JSON schema. Field descriptions remain UI metadata and are not inserted into the extraction prompt.
2. **Question generation:** receives only the newest transcript segment. It receives no summary, extraction state, previous questions, or earlier transcript. It returns question text only, with no fixed three-question cap.

The extraction safety ceiling is 1,536 generated tokens. The question-generation ceiling is 768 generated tokens. These are output limits, not allocated context-window targets.

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

The app contains thirteen synthetic static presets. The original eight cover:

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

## Configurable extraction fields

Use **Configure** in the web app to add, remove, or rename checklist fields. The model receives field IDs, so dynamically added fields should use concise, descriptive IDs. Labels and descriptions are retained as UI metadata in this baseline.

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

The original eight-preset run on the development M5 Max produced the following aggregate results. Both models used Q4_K_M, an 8,192-token context, deterministic decoding, reasoning disabled, and strict JSON schemas. The five newer `-15s` presets are not included in these aggregate numbers.

| Model | Extraction precision | Extraction recall | Avg. two-call latency | Avg. extraction | Avg. questions |
|---|---:|---:|---:|---:|---:|
| LFM2.5-1.2B-Thinking | 65.4% | 25.4% | 0.69 s | 0.60 s | 0.09 s |
| LFM2.5-2.6B | 82.7% | 92.5% | 1.96 s | 1.46 s | 0.49 s |

These are indicative synthetic-demo measurements, not formal benchmarks or evidence for unrelated production domains. The preset scorer uses strict field-aware matching; small wording differences can count as wrong.

The quality panel compares the accumulated record with facts supported by the transcript seen so far. It reports correct, missed, wrong-field/value, and unsupported values. Placeholder cleanup and invalid output are shown separately and do not count as model hallucinations. Salary and relocation comparisons are meaning-aware, so equivalent formatting does not lower extraction quality. These synthetic checks are an evaluation aid rather than a production correctness guarantee.

## Known model behaviors

- The 2.6B model is materially stronger than the 1.2B Thinking model for extraction on the current presets.
- On five realistic 15-second extraction samples, the 2.6B recovered all 11 expected facts and made seven unsupported field assignments: 61.1% precision and 100% recall. The harness separately cleaned up 22 placeholder phrases, which are not counted as hallucinations. These cases are directional fixtures, not a production-domain benchmark.
- The 1.2B Thinking model remains useful as a fast comparison baseline or a candidate for a narrower trained routing/classification role; it is not the recommended zero-shot extractor based on current results.
- Strict extraction schema decoding is required for the 1.2B Thinking checkpoint in this setup. The llama.cpp reasoning-off flags alone did not prevent it from spending the output budget on a reasoning trace.
- Concise prompts work better than large field-definition maps for the tested quantized model.
- Explicit salary conversion generally works well.
- Corrections expressed indirectly, such as “correct the timing,” may still resolve to the earlier value.
- Historical programs may occasionally be classified as current.
- In an isolated eight-case 2.6B question test, the prompt passed six cases, caught all four vague answers, and correctly abstained on contact and compensation at about 0.22 seconds average latency. It still asked methodology questions for two already-quantified achievements.
- The question prompt now treats a stated contribution plus a concrete number, percentage, scale, scope, or timeframe as complete and says that missing methodology alone is not a follow-up trigger. This revision still needs to be re-scored on the same cases.

These behaviors remain visible by design.

## Validation

```bash
node --check runtime/llama-adapter.mjs
cd web
npm run lint
npm run build
```

## License

Repository source code is available under the [MIT License](LICENSE). This repository is intended as a demo/POC; the MIT license itself permits broader use subject to its terms. Model weights, third-party packages, fonts, and vendor assets retain their own licenses.
