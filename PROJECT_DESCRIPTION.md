# Intelligent Transcription Assistant — POC Project Description

## Overview

This project will build a proof of concept for an intelligent, local-first meeting assistant. It will consume clean English transcript updates approximately every 15 seconds and help an interviewer navigate a conversation in real time.

The assistant will run entirely on an air-gapped laptop equipped with an NVIDIA RTX 5090 GPU and 24 GB of VRAM. No transcript, prompt, model output, or meeting metadata may leave the device. The existing speech-to-text pipeline is outside this project's scope and will supply transcript text to the assistant.

The leading language-model candidate is `LFM2.5-2.6B` with reasoning disabled, compared against `LFM2.5-1.2B-Instruct`. The POC measures extraction quality, follow-up quality, latency, and memory use before choosing a deployment configuration.

## Current Localhost Demo Scope

The first demo intentionally uses eight static candidate-interview presets rather than a timed streaming replay. Each preset is submitted once and executes two sequential model calls: checklist extraction followed by follow-up-question generation. One preset reproduces the original project-intent example. This isolates model quality, time to first token, decode throughput, total latency, and process memory from replay-speed effects.

The static harness includes synthetic ground truth, raw model extraction output, configurable extraction fields, and interview examples with clear answers, unresolved vague claims, quantified impact, unclear ownership, logistics, and later corrections. The current baseline deliberately leaves extraction semantics with the model; it does not require evidence spans or use field-specific semantic correction. Evidence-backed extraction remains a future experiment rather than hidden harness behavior. Streaming cadence, queueing, rolling-context behavior, and thermal stability remain project goals, but will be evaluated separately in a later load/soak harness.

## Problem Statement

During a long interview or structured meeting, the user must listen, decide what to ask next, and keep track of whether every required topic has been covered. Doing all three at once increases cognitive load and makes it easy to miss incomplete or ambiguous answers.

The assistant should continuously interpret the evolving transcript and provide two forms of support:

1. A short, prioritized list of useful follow-up questions.
2. A structured view of information found—or still missing—according to a user-defined checklist.

The output is advisory. The interviewer remains in control and decides whether to use any suggestion.

## POC Goals

- Accept incremental, clean English transcript segments about every 15 seconds.
- Maintain useful conversational context throughout meetings lasting roughly one to two hours.
- Generate a small set of concise, context-aware follow-up questions.
- Extract checklist information with evidence from the transcript.
- Show whether each checklist item is covered, partially covered, missing, ambiguous, or conflicting.
- Avoid repeatedly suggesting questions that have already been answered or dismissed.
- Run locally and offline without external services.
- Operate within a configurable GPU resource budget while sharing the GPU with other models.
- Support a later batch test in which the complete transcript is supplied at once.
- Produce measurable results for quality, latency, stability, and resource usage.

## Primary User Experience

Before a meeting, the user provides an information checklist. A checklist item may include a label, description, required details, and optional guidance about what qualifies as complete.

During the meeting, the transcript pipeline sends a new segment to the assistant approximately every 15 seconds. The assistant updates its internal meeting state and returns:

- Up to three recommended follow-up questions, ordered by usefulness.
- The reason each question is relevant.
- Checklist status updates with supporting transcript evidence.
- Important ambiguities or contradictions that may need clarification.

Suggestions should be short enough to scan without distracting the interviewer. The interface should distinguish new findings from unchanged state and should not invent facts when the transcript is unclear.

## Functional Requirements

### Transcript ingestion

- Accept timestamped transcript segments through a simple local interface.
- Preserve segment ordering and handle duplicate, delayed, or corrected segments safely.
- Associate extracted evidence with transcript timestamps or segment identifiers.
- Allow a meeting session to be started, updated, inspected, and ended.
- Support full-transcript ingestion as a separate evaluation path.

### Follow-up question generation

- Return no more than three questions per update by default.
- Prioritize questions that resolve ambiguity, deepen an important answer, or cover a missing checklist item.
- Use the recent conversation and accumulated meeting state.
- Avoid questions already answered in the transcript.
- Avoid near-duplicate suggestions across consecutive updates.
- Allow an empty recommendation list when no useful interruption is warranted.

### Checklist extraction

- Accept a user-defined checklist at session start.
- Track each item using a state such as `missing`, `partial`, `covered`, `ambiguous`, or `conflicting`.
- Extract only information supported by the transcript.
- Attach evidence text and timestamps to each extracted value.
- Preserve uncertainty rather than converting weak implications into facts.
- Update or supersede earlier values when later conversation corrects them.
- Identify the specific missing details needed to complete partial items.

### Output contract

The model-facing layer should produce validated structured output rather than free-form prose. A representative response shape is:

```json
{
  "follow_up_questions": [
    {
      "question": "What outcome would make this project successful?",
      "reason": "The desired outcome has not been defined.",
      "priority": "high",
      "related_checklist_ids": ["success_criteria"]
    }
  ],
  "checklist_updates": [
    {
      "checklist_id": "timeline",
      "status": "partial",
      "value": "Targeting the fourth quarter",
      "missing_details": ["specific date", "key milestones"],
      "evidence": [
        {
          "segment_id": "seg-0042",
          "timestamp": "00:18:31",
          "quote": "We would like to have it ready sometime in Q4."
        }
      ],
      "confidence": 0.86
    }
  ],
  "warnings": []
}
```

Application code must validate this structure, reject malformed fields, and retain the last valid state if inference fails.

## Proposed POC Architecture

```text
Existing speech-to-text pipeline
              |
              v
Local transcript ingestion API
              |
              v
Session and context manager
  |           |             |
  |           |             +--> Recent transcript window
  |           +----------------> Running meeting summary/state
  +----------------------------> Checklist values and evidence
              |
              v
Local Liquid LFM inference runtime
              |
              v
Schema validation and post-processing
              |
              v
Interviewer suggestions + checklist status
```

The system should not resend the entire one-to-two-hour transcript for every 15-second update. Instead, it should combine:

- A bounded window of recent verbatim transcript.
- A compact running summary of older conversation.
- The current structured checklist state and its best evidence.
- A history of recently suggested questions and their disposition.

The full transcript remains stored locally for evidence lookup, final review, and separate batch evaluation; the live path keeps its prompt bounded.

## Model and Resource Strategy

`LFM2.5-2.6B` with reasoning disabled is the leading candidate, with `LFM2.5-1.2B-Instruct` retained as the lower-resource comparison baseline. Both use quantized local inference configurations.

The POC will compare candidate configurations using the same transcript and checklist evaluation set. Selection criteria include:

- Follow-up question usefulness and non-redundancy.
- Checklist extraction precision and recall.
- Structured-output reliability.
- Time to first result and total update latency.
- Peak VRAM, steady-state VRAM, GPU utilization, and host RAM.
- Behavior when the other expected GPU models are active.
- Stability over a continuous two-hour session.

GPU limits must be configurable. The inference component should support serialized execution, bounded context sizes, and graceful degradation under contention. Possible degradation steps include reducing context size, lowering generation limits, increasing the update interval, changing quantization, or moving to a smaller compatible Liquid model.

Exact memory and latency budgets will be set after profiling the full laptop workload. Model size alone is not enough to predict feasibility because KV cache, context length, runtime overhead, quantization, and concurrent GPU processes also consume memory.

## Non-Functional Requirements

### Privacy and offline operation

- No network dependency is permitted during normal operation.
- Models, tokenizers, runtimes, and other dependencies must be available locally.
- Meeting data must not be sent to telemetry, cloud logging, crash reporting, or analytics services.
- Logs must avoid unnecessary transcript content and be configurable or disabled.
- The POC should include a test proving that core meeting operation succeeds with networking disabled.

### Performance

Initial POC targets, to be validated on the target laptop:

- Complete each incremental update before the next 15-second segment arrives under the expected concurrent workload.
- Prefer a response within five seconds so suggestions remain conversationally relevant.
- Run continuously for two hours without unbounded growth in VRAM, RAM, or stored prompt state.
- Recover cleanly from malformed model output or an individual inference failure.

### Trust and usability

- Evidence must be traceable to the transcript.
- Unknown information must remain unknown.
- Model output must never silently overwrite the source transcript.
- Suggestions must be concise, relevant, and easy to dismiss.
- Transcript content must be treated as data, not as trusted instructions to the model.

## Evaluation Plan

Create a small representative evaluation corpus containing short interviews and one-to-two-hour meetings. Include straightforward answers, corrections, contradictions, implied information, unanswered checklist topics, and transcript imperfections expected from the upstream system.

Evaluate two operating modes:

1. **Streaming replay:** deliver transcript segments at the production cadence and score every assistant update.
2. **Full-transcript batch:** submit the complete transcript to establish a quality reference for checklist extraction.

Measurements should include:

- Checklist extraction precision, recall, and status accuracy.
- Evidence correctness and timestamp traceability.
- Hallucination or unsupported-claim rate.
- Human ratings for follow-up relevance, usefulness, timing, and duplication.
- Valid structured-output rate.
- P50, P95, and worst-case latency.
- Peak and steady-state VRAM and RAM consumption.
- Long-session stability and recovery from inference errors.

The evaluation should compare the initial 1.2B model with at least one smaller Liquid model or lower-resource configuration. Prompt, context-management, and quantization settings must be recorded so results are reproducible.

## POC Acceptance Criteria

The POC is successful when it can:

- Run fully offline on the target laptop.
- Process a two-hour streaming transcript without losing session state or exhausting resources.
- Return a schema-valid response before the next transcript interval for at least 95% of updates under representative concurrent GPU load.
- Provide transcript-backed checklist results without unsupported factual additions in the agreed evaluation set.
- Produce follow-up suggestions that human reviewers judge useful and non-duplicative often enough to justify continued development.
- Demonstrate a documented model configuration that leaves sufficient GPU capacity for the other required workloads.
- Process a full transcript in batch mode and produce an evidence-backed checklist report.

Numeric quality thresholds beyond latency and schema reliability will be finalized after labeling the initial evaluation corpus and establishing the baseline.

## Out of Scope for the Initial POC

- Audio capture, speaker diarization, and speech-to-text processing.
- Cloud inference, cloud storage, or remote collaboration.
- Training or fine-tuning a foundation model.
- Autonomous participation in the meeting.
- Automatic execution of actions based on model output.
- Languages other than English.
- Production-grade authentication, enterprise deployment, or fleet management.

## Key Risks and Mitigations

- **GPU contention:** Profile with all expected models active and enforce configurable memory and scheduling limits.
- **Long-context degradation:** Use bounded recent context and structured state instead of continuously growing prompts.
- **Small-model reasoning limits:** Keep tasks narrowly defined, use strong schemas and deterministic post-processing, and compare smaller and larger configurations empirically.
- **Hallucinated extraction:** Require evidence, validate output, preserve uncertainty, and measure unsupported claims explicitly.
- **Repetitive suggestions:** Store recent recommendations and filter semantic duplicates before display.
- **Prompt injection in transcript text:** Clearly delimit transcript content, treat it as untrusted data, and prevent it from changing system behavior.
- **Summary drift:** Retain the source transcript and periodically rebuild or verify state against original segments.

## Suggested Delivery Phases

### Phase 1 — Offline inference baseline

Run both candidate models locally, confirm structured output, and record quality, latency, and memory usage with representative prompts.

### Phase 2 — Streaming session engine

Implement transcript ingestion, session state, rolling context, checklist tracking, evidence storage, and duplicate handling.

### Phase 3 — Suggestion and extraction quality

Refine prompts and post-processing, add follow-up deduplication, and build the labeled evaluation corpus.

### Phase 4 — Resource and endurance testing

Replay one-to-two-hour meetings while all expected GPU workloads are active. Compare model sizes, quantization, and context settings.

### Phase 5 — POC demonstration

Demonstrate checklist progress, evidence-backed results, graceful failure handling, and full-transcript batch analysis with networking disabled.

## Open Decisions

- The local Liquid inference runtime and supported quantization formats.
- The actual VRAM budget available after accounting for concurrent models.
- Whether speaker labels are available from the transcription harness.
- The checklist authoring format and whether values require typed schemas.
- The user-interface form: local web UI, desktop application, or integration into an existing tool.
- Retention and encryption requirements for transcripts and session artifacts.
- Final thresholds for extraction quality and human-rated suggestion usefulness.
