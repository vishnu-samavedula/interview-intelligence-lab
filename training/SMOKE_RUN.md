# Disposable two-adapter smoke test

Purpose: verify the training/export/routing machinery on eight separate toy fixtures. These adapters are not quality candidates, calibration data or a released training corpus. Keep the app's default profile unchanged.

The pinned native checkpoint is `LiquidAI/LFM2.5-2.6B@654f9463ce32b05d0429d76fe1f580b27d4c1ac0`. Modal uses one A100 80GB, at most 24 optimizer steps per task (12 by default), a 30-minute timeout and no automatic GPU retries. Only explicit synthetic fixtures and smoke code are uploaded.

## Formatting preflight

1. Build fixtures: `node training/build-smoke-inputs.mjs`.
2. With the baseline llama.cpp server running on port 8080: `node training/probe-local-template.mjs`.
3. Run `training/template-preflight.py` with pinned Transformers 4.57.1 and Jinja2 3.1.6, passing `--local-report /tmp/interview-template-probe.json`.

The probe verifies the actual server prompt token count with one generated token. `/apply-template` omits the BOS text; serving tokenization adds it. Native serialization includes BOS explicitly, then tokenizes without adding special tokens again. Compare full token sequences, not displayed template text alone.

The checkpoint names the newer `TokenizersBackend` class. The pinned stack loads its native `tokenizer.json` explicitly through `PreTrainedTokenizerFast`; exact ID parity is a hard prerequisite. Training uses the verified serving generation prefix plus JSON and EOS, masking all prefix tokens. It does not independently re-template an assistant message or train on hidden reasoning traces.

## Native training and export

Run `modal run training/modal_smoke.py`. A unique run directory is stored in the `veteran-interview-smoke-v1` volume. The job checks:

- Equal per-example coefficient mass despite different target lengths; an unequal-weight gradient accumulation check against the full-batch objective.
- Attention-only `q_proj`, `k_proj`, `v_proj`, `out_proj` targets. LFM convolution layers also have `out_proj`, so a suffix-only match would be too broad.
- Only LoRA parameters receive gradients; base parameter version counters remain unchanged.
- Loss decreases on the disposable subset. This is a plumbing assertion, not evidence of generalization.
- Mid-run adapter/optimizer/RNG save and reload; final adapter state and logits survive reload.
- Two independently initialized adapters route correctly on one native base with fresh forward passes.

The separate CPU export step pins llama.cpp commit `c1d0e7a00` to match the installed local server, uses the exact cached base revision, and writes two F32 GGUF adapters. The base remains Q4_K_M at inference. If only conversion fails, retry with `modal run training/modal_smoke.py --export-only RUN_ID`; do not retrain unnecessarily.

## Local Q4 loading and routing

Download the run directory from the Modal volume into an ignored local artifacts directory. Run `node training/verify-gguf-smoke.mjs /absolute/path/to/run`.

The verifier starts an isolated server on port 8084, loads the current Q4 base and both GGUF adapters, explicitly resets both global scales to zero, then selects adapters per request. The installed server reported scale 1 despite the initialization flag; do not rely on that flag alone. It compares token probabilities for base → extraction → questions → extraction, requires distinct adapter effects and repeat consistency, captures sample generations under the same JSON schemas and output ceilings as the demo, and shuts its server down. It does not modify the app profile or promote toy adapters.

Successful loading/routing does not establish native/Q4 quality parity. Record results in the native, export and local Q4 reports, then run the separately reviewed corpus and held-out evaluation before any promotion.

## Recorded outcome: October 22, 2026

Run `20261022T164456Z-f8b40980` passed native training, save/resume, reload, GGUF conversion and isolated Q4 switching. Each adapter has 1,703,936 trainable parameters and a 6,820,768-byte GGUF. Peak allocated CUDA memory was 8.35 GiB. Each task used 12 optimizer steps on four disposable fixtures. Both base-weight checks passed, reload logits matched exactly, and returning to the extraction adapter reproduced native logits and local Q4 token probabilities exactly. See [summary](smoke-summary.json), [native report](smoke-latest-native.json), [export report](smoke-latest-export.json) and [local Q4 report](smoke-latest-q4.json).

This is not a quality pass. The Q4 extraction sample recovered the email but also emitted three invalid set/null operations. Unconstrained Q4 generations did not reliably follow JSON; schema-constrained generations parsed. The native question sample abstained on an ask fixture. Keep operation/evidence validation and JSON constraints, and run the reviewed domain corpus and held-out evaluations before promotion. Cache-enabled switching remains untested.

Training completed before a local report-deserialization failure caused by a PyTorch version-string subclass. Saved artifacts were intact. Results now cross the boundary as plain JSON; export resumed from the saved run without retraining. The app continues using its baseline profile.
