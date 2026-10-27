/** Isolated Q4 server; smoke adapters never replace the app's baseline model. */
import assert from "node:assert/strict";
import { fields } from "../runtime/field-contract.mjs";
import { liveExtractionSchema } from "../runtime/live-extraction.mjs";
import { questionSchema } from "../runtime/model-prompts.mjs";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, openSync, closeSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const directory = process.argv[2];
if (!directory) throw new Error("Usage: node training/verify-gguf-smoke.mjs /path/to/downloaded/run");
const root = resolve(directory), output = resolve(root, "local-q4-report.json");
const paths = [resolve(root, "extraction.gguf"), resolve(root, "questions.gguf")];
assert.ok(paths.every(existsSync));
const log = openSync("/tmp/interview-lora-server.log", "w");
const child = spawn("llama-server", ["-m", resolve("models/LFM2.5-2.6B-GGUF/LFM2.5-2.6B-Q4_K_M.gguf"), "--host", "127.0.0.1", "--port", "8084", "--alias", "interview-adapter-smoke", "--gpu-layers", "99", "--ctx-size", "8192", "--parallel", "1", "--jinja", "--reasoning", "off", "--reasoning-budget", "0", "--no-warmup", "--lora", paths.join(","), "--lora-init-without-apply"], { stdio: ["ignore", log, log] });
let exited = false;
child.on("exit", () => { exited = true; });
const endpoint = "http://127.0.0.1:8084";
async function request(path, body) {
  const response = await fetch(endpoint + path, { ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const probabilityVector = (result) => {
  const first = (result.completion_probabilities || result.probs)?.[0];
  const values = first?.top_logprobs || first?.probs;
  if (!Array.isArray(values) || !values.length) throw new Error("Missing token probabilities");
  return Object.fromEntries(values.map((value) => [value.id ?? value.tok_str ?? value.token, value.logprob ?? value.prob]));
};
const difference = (left, right) => {
  const common = Object.keys(left).filter((key) => Number.isFinite(left[key]) && Number.isFinite(right[key]));
  assert.ok(common.length, "No common finite probability values");
  return Math.max(...common.map((key) => Math.abs(left[key] - right[key])));
};
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (exited) throw new Error(`Smoke server exited. See /tmp/interview-lora-server.log`);
    try { if ((await request("/health")).status === "ok") { ready = true; break; } } catch { /* startup */ }
    await sleep(500);
  }
  assert.ok(ready, "Smoke server startup timeout");
  const initialAdapters = await request("/lora-adapters");
  assert.ok(paths.every((path) => initialAdapters.some((adapter) => adapter.path === path)));
  await request("/lora-adapters", []);
  const adapters = await request("/lora-adapters");
  writeFileSync(resolve(root, "local-adapter-inventory.json"), JSON.stringify(adapters, null, 2));
  assert.equal(adapters.length, 2);
  assert.ok(paths.every((path) => adapters.some((adapter) => adapter.path === path && adapter.scale === 0)), JSON.stringify(adapters));
  const inputs = JSON.parse(readFileSync(new URL("./smoke-inputs.json", import.meta.url)));
  const { prompt } = await request("/apply-template", { messages: inputs.records[0].messages });
  const probes = [];
  for (const [task, lora] of [["base", []], ["extraction", [{ id: 0, scale: 1 }]], ["questions", [{ id: 1, scale: 1 }]], ["extraction-repeat", [{ id: 0, scale: 1 }]]]) {
    const result = await request("/completion", { prompt, n_predict: 1, temperature: 0, top_k: 1, top_p: 1, repeat_penalty: 1, seed: 17, n_probs: 10, cache_prompt: false, lora });
    probes.push({ task, lora, vector: probabilityVector(result), raw: result });
  }
  const repeatDelta = difference(probes[1].vector, probes[3].vector);
  const extractionDelta = difference(probes[0].vector, probes[1].vector);
  const questionDelta = difference(probes[1].vector, probes[2].vector);
  assert.ok(repeatDelta < 1e-5, `Repeated adapter changed probabilities: ${repeatDelta}`);
  assert.ok(extractionDelta > 1e-5 && questionDelta > 1e-5, "Adapters did not change probabilities");
  const generations = [];
  for (const [task, index, id] of [["extraction", 0, 0], ["questions", 4, 1]]) {
    const result = await request("/v1/chat/completions", { model: "interview-adapter-smoke", messages: inputs.records[index].messages, response_format: { type: "json_schema", json_schema: { name: `smoke_${task}`, strict: true, schema: task === "extraction" ? liveExtractionSchema(fields) : questionSchema } }, max_tokens: task === "extraction" ? 4096 : 768, temperature: 0, top_k: 1, top_p: 1, seed: 17, cache_prompt: false, lora: [{ id, scale: 1 }] });
    const payload = JSON.parse(result.choices[0].message.content);
    assert.equal(result.choices[0].finish_reason, "stop", "Generation hit its token ceiling");
    generations.push({ task, schema_enforced: true, payload, result });
  }
  const report = { passed: true, scope: "GGUF loading and task routing only; not quantized quality promotion", initialAdapters, adapters, probes, generations, repeat_probability_delta: repeatDelta, extraction_effect_delta: extractionDelta, task_effect_delta: questionDelta, existing_app_profile_modified: false };
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: true, repeatDelta, extractionDelta, questionDelta, report: output }));
} finally {
  child.kill("SIGTERM");
  await Promise.race([new Promise((done) => child.once("exit", done)), sleep(3000)]);
  if (!exited) child.kill("SIGKILL");
  closeSync(log);
}
