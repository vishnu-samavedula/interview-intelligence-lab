import http from "node:http";
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { extractionMessages, questionMessages, questionSchema } from "./model-prompts.mjs";
import { completedResponses } from "./transcript-json.mjs";
import { finalExtractionSchema, reconcileExtraction, summaryMessages, summarySchema, validateSummary } from "./end-of-call.mjs";
import { fields as frozenFields } from "./field-contract.mjs";
import { liveExtractionSchema, validateExtraction } from "./live-extraction.mjs";

const PORT = Number(process.env.ADAPTER_PORT || 8000);
const EXTRACTION_MAX_TOKENS = Number(process.env.EXTRACTION_MAX_TOKENS || 4096);
const QUESTION_MAX_TOKENS = Number(process.env.QUESTION_MAX_TOKENS || 1024);
const FINAL_EXTRACTION_MAX_TOKENS = Number(process.env.FINAL_EXTRACTION_MAX_TOKENS || 4096);
const SUMMARY_MAX_TOKENS = Number(process.env.SUMMARY_MAX_TOKENS || 1536);
const DEFAULT_MODEL_ID = process.env.DEFAULT_MODEL_ID || "lfm2.5-2.6b-no-think";
const LFM12_URL = process.env.LFM12_URL || "http://127.0.0.1:8081";
const LFM26_URL = process.env.LFM26_URL || "http://127.0.0.1:8080";
const LFM12_MODEL_NAME = process.env.LFM12_MODEL_NAME || "LFM2.5-1.2B-Thinking-Q4_K_M";
const LFM26_MODEL_NAME = process.env.LFM26_MODEL_NAME || "LFM2.5-2.6B-Q4_K_M";
const LFM12_MODEL_PATH = process.env.LFM12_MODEL_PATH || "models/LFM2.5-1.2B-Thinking-GGUF/LFM2.5-1.2B-Thinking-Q4_K_M.gguf";
const LFM26_MODEL_PATH = process.env.LFM26_MODEL_PATH || "models/LFM2.5-2.6B-GGUF/LFM2.5-2.6B-Q4_K_M.gguf";
const MODEL_PROFILES = new Map([
  ["lfm2.5-1.2b-no-think", {
    id: "lfm2.5-1.2b-no-think",
    label: "LFM2.5 1.2B · no thinking",
    description: "Smaller reasoning checkpoint with reasoning disabled",
    extractionUrl: LFM12_URL,
    questionUrl: LFM12_URL,
    extractionModel: LFM12_MODEL_NAME,
    questionModel: LFM12_MODEL_NAME,
    modelPaths: [LFM12_MODEL_PATH],
  }],
  ["lfm2.5-2.6b-no-think", {
    id: "lfm2.5-2.6b-no-think",
    label: "LFM2.5 2.6B · no thinking",
    description: "Larger reasoning checkpoint with reasoning disabled",
    extractionUrl: LFM26_URL,
    questionUrl: LFM26_URL,
    extractionModel: LFM26_MODEL_NAME,
    questionModel: LFM26_MODEL_NAME,
    modelPaths: [LFM26_MODEL_PATH],
  }],
]);


MODEL_PROFILES.set("lfm2.5-2.6b-demo-adapters", {
  id: "lfm2.5-2.6b-demo-adapters", label: "LFM2.5 2.6B · trained demo",
  description: "Experimental extraction and ranked-question LoRAs; compare with the base model",
  extractionUrl: process.env.LFM26_ADAPTED_URL || "http://127.0.0.1:8084",
  questionUrl: process.env.LFM26_ADAPTED_URL || "http://127.0.0.1:8084",
  extractionModel: "interview-trained-demo", questionModel: "interview-trained-demo",
  extractionLora: [{ id: 0, scale: 1 }], questionLora: [{ id: 1, scale: 1 }],
  modelPaths: [LFM26_MODEL_PATH],
});


function send(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function timecode(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return hours ? `${hours}:${minutes}:${secs}` : `${minutes}:${secs}`;
}

function parseModelJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return a complete JSON object");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function llamaMemoryMb(model) {
  try {
    const row = execFileSync("ps", ["-axo", "pid=,rss=,command="], { encoding: "utf8" }).split("\n").find((line) => line.includes("llama-server") && line.includes(model));
    const match = row?.trim().match(/^\d+\s+(\d+)\s+/);
    return match ? Math.round(Number(match[1]) / 1024) : 0;
  } catch { return 0; }
}

function profileMemoryMb(profile) {
  return [...new Set([profile.extractionModel, profile.questionModel])].reduce((sum, model) => sum + llamaMemoryMb(model), 0);
}

function modelStorageMb(profile) {
  return [...new Set(profile.modelPaths)].reduce((sum, path) => {
    try { return sum + statSync(path).size / 1024 / 1024; }
    catch { return sum; }
  }, 0);
}

async function generateJson({ messages, schema, schemaName, maxTokens, url, model, temperature, topK = 50, topP = 0.1, repeatPenalty = 1.05, seed = -1, lora }) {
  const started = performance.now();
  const body = { model, messages, temperature, top_k: topK, top_p: topP, repeat_penalty: repeatPenalty, seed, max_tokens: maxTokens, stream: true, cache_prompt: lora === undefined, ...(lora !== undefined ? { lora } : {}) };
  if (schema) body.response_format = { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } };
  const upstream = await fetch(`${url}/v1/chat/completions`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!upstream.ok || !upstream.body) throw new Error(`llama-server returned ${upstream.status}: ${await upstream.text()}`);
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", generated = "", firstTokenAt = null, timings = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n"); buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      const event = JSON.parse(line.slice(6));
      const content = event.choices?.[0]?.delta?.content || "";
      if (content && firstTokenAt === null) firstTokenAt = performance.now();
      generated += content;
      if (event.timings) timings = event.timings;
    }
  }
  const finished = performance.now();
  const first = firstTokenAt ?? finished;
  const outputTokens = timings?.predicted_n ?? Math.max(1, Math.round(generated.length / 4));
  const estimatedInput = Math.round(JSON.stringify(messages).length / 4);
  return {
    payload: parseModelJson(generated),
    metrics: {
      totalMs: Math.round(finished - started), ttftMs: Math.round(first - started),
      decodeTokensPerSecond: Number((timings?.predicted_per_second ?? outputTokens / Math.max((finished - first) / 1000, .001)).toFixed(2)),
      inputTokens: Math.max(timings?.prompt_n ?? 0, estimatedInput), outputTokens,
      processRamMb: llamaMemoryMb(model), gpuMemoryMb: null,
    },
  };
}

function validateQuestions(payload, previousQuestions = []) {
  const raw = Array.isArray(payload.questions) ? payload.questions.map((question) => ({ question })) : [];
  const accepted = [], rejected = [];
  const previous = new Set(previousQuestions.filter((item) => typeof item.question === "string").map((item) => item.question.trim().toLowerCase()));
  const seen = new Set();
  for (const item of raw) {
    let rejectionReason = "";
    if (!item?.question || typeof item.question !== "string") rejectionReason = "Malformed question output";
    else if (!item.question.trim().endsWith("?")) rejectionReason = "Output is not phrased as a question";
    const key = typeof item.question === "string" ? item.question.trim().toLowerCase() : "";
    if (!rejectionReason && previous.has(key)) rejectionReason = "Previously suggested question";
    if (!rejectionReason && seen.has(key)) rejectionReason = "Duplicate question in the same update";
    if (!rejectionReason && accepted.length >= 6) rejectionReason = "At most six ranked candidates are allowed per analysis";
    if (rejectionReason) rejected.push({ question: item, rejectionReason });
    else { seen.add(key); accepted.push(item); }
  }
  return { raw, ranked: accepted, accepted: accepted.slice(0, 3), rejected };
}

function mergeMetrics(extraction, question) {
  if (!question) return { ...extraction, extractionMs: extraction.totalMs, questionMs: 0 };
  const outputTokens = extraction.outputTokens + question.outputTokens;
  const decode = outputTokens ? (extraction.decodeTokensPerSecond * extraction.outputTokens + question.decodeTokensPerSecond * question.outputTokens) / outputTokens : 0;
  return {
    totalMs: extraction.totalMs + question.totalMs, ttftMs: extraction.ttftMs,
    decodeTokensPerSecond: Number(decode.toFixed(2)), inputTokens: extraction.inputTokens + question.inputTokens, outputTokens,
    processRamMb: Math.max(extraction.processRamMb, question.processRamMb), gpuMemoryMb: null,
    extractionMs: extraction.totalMs, questionMs: question.totalMs,
  };
}

async function infer(input) {
  const profile = MODEL_PROFILES.get(input.modelId || DEFAULT_MODEL_ID);
  if (!profile) throw new Error(`Unknown model profile: ${input.modelId}`);
  const completedResponseCount = completedResponses(input.segments || []).length;
  if (completedResponseCount <= (input.processedResponseCount || 0)) return { analysisPerformed: false, completedResponseCount };
  const extractionRun = await generateJson({ messages: extractionMessages(input), schema: liveExtractionSchema(input.fields), schemaName: "interview_extraction", maxTokens: EXTRACTION_MAX_TOKENS, url: profile.extractionUrl, model: profile.extractionModel, lora: profile.extractionLora, temperature: 0, topK: 1, topP: 1, repeatPenalty: 1, seed: 0 });
  const extraction = validateExtraction(extractionRun.payload, input);
  const questionRun = await generateJson({ messages: questionMessages({ ...input, previousSnapshot: extraction.checklistSnapshot }), schema: questionSchema, schemaName: "follow_up_questions", maxTokens: QUESTION_MAX_TOKENS, url: profile.questionUrl, model: profile.questionModel, lora: profile.questionLora, temperature: 0 });
  const questions = validateQuestions(questionRun.payload, input.previousQuestions);
  return { analysisPerformed: true, completedResponseCount, ...extraction, followUpQuestions: questions.accepted, rankedFollowUpQuestions: questions.ranked, rawFollowUpQuestions: questions.raw, rejectedFollowUpQuestions: questions.rejected, metrics: { ...mergeMetrics(extractionRun.metrics, questionRun.metrics), processRamMb: profileMemoryMb(profile), modelStorageMb: Number(modelStorageMb(profile).toFixed(1)), modelId: profile.id, modelLabel: profile.label } };
}

async function finalize(input) {
  if (!Array.isArray(input.segments) || !input.segments.length || !Array.isArray(input.fields) || !input.fields.length) throw new Error("Finalization requires a transcript and configured fields");
  const profile = MODEL_PROFILES.get(input.modelId || DEFAULT_MODEL_ID);
  if (!profile) throw new Error(`Unknown model profile: ${input.modelId}`);
  const extraction = await generateJson({ messages: extractionMessages({ ...input, finalize: true }), schema: finalExtractionSchema(input.fields), schemaName: "final_extraction", maxTokens: FINAL_EXTRACTION_MAX_TOKENS, url: profile.extractionUrl, model: profile.extractionModel, lora: profile.extractionLora, temperature: 0, topK: 1, topP: 1, repeatPenalty: 1, seed: 0 });
  const reconciled = reconcileExtraction(extraction.payload, input);
  const summary = await generateJson({ messages: summaryMessages(input, reconciled.finalSnapshot), schema: summarySchema, schemaName: "interview_summary", maxTokens: SUMMARY_MAX_TOKENS, url: profile.extractionUrl, model: profile.extractionModel, lora: profile.extractionLora ? [] : undefined, temperature: 0, topK: 1, topP: 1, repeatPenalty: 1, seed: 0 });
  return { ...reconciled, summary: validateSummary(summary.payload), rawSummaryPayload: summary.payload, metrics: { totalMs: extraction.metrics.totalMs + summary.metrics.totalMs, extractionMs: extraction.metrics.totalMs, summaryMs: summary.metrics.totalMs, modelLabel: profile.label } };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return send(response, 204, {});
  if (request.method === "GET" && request.url === "/v1/models") {
    const models = await Promise.all([...MODEL_PROFILES.values()].map(async (profile) => {
      try { return { id: profile.id, label: profile.label, description: profile.description, modelStorageMb: Number(modelStorageMb(profile).toFixed(1)), available: (await fetch(`${profile.extractionUrl}/health`)).ok }; }
      catch { return { id: profile.id, label: profile.label, description: profile.description, modelStorageMb: Number(modelStorageMb(profile).toFixed(1)), available: false }; }
    }));
    return send(response, 200, { defaultModelId: DEFAULT_MODEL_ID, models });
  }
  if (request.method === "GET" && request.url === "/health") {
    try {
      const profile = MODEL_PROFILES.get(DEFAULT_MODEL_ID);
      const [extraction, question] = await Promise.all([fetch(`${profile.extractionUrl}/health`), fetch(`${profile.questionUrl}/health`)]);
      return send(response, extraction.ok && question.ok ? 200 : 503, { status: extraction.ok && question.ok ? "ok" : "loading", mode: "split-inference", defaultModelId: DEFAULT_MODEL_ID });
    } catch (error) { return send(response, 503, { status: "unavailable", error: error instanceof Error ? error.message : String(error) }); }
  }
  const analyze = request.method === "POST" && request.url === "/v1/analyze";
  const finalizing = request.method === "POST" && request.url === "/v1/finalize";
  if (!analyze && !finalizing) return send(response, 404, { error: "Not found" });
  try {
    const body = await readBody(request);
    const input = { ...body, fields: frozenFields };
    return send(response, 200, await (finalizing ? finalize(input) : infer(input)));
  } catch (error) { return send(response, 502, { detail: error instanceof Error ? error.message : String(error) }); }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Split inference adapter: http://127.0.0.1:${PORT}`);
  for (const profile of MODEL_PROFILES.values()) console.log(`${profile.label}: ${profile.extractionModel} at ${profile.extractionUrl}`);
});
