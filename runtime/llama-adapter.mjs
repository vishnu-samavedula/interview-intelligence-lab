import http from "node:http";
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";

const PORT = Number(process.env.ADAPTER_PORT || 8000);
const EXTRACTION_MAX_TOKENS = Number(process.env.EXTRACTION_MAX_TOKENS || 1536);
const QUESTION_MAX_TOKENS = Number(process.env.QUESTION_MAX_TOKENS || 768);
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

const questionSchema = {
  type: "object", additionalProperties: false,
  properties: {
    questions: {
      type: "array", minItems: 0,
      items: { type: "string" },
    },
  },
  required: ["questions"],
};

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

function serializeSegments(segments) {
  return segments.map((segment) => segment.turns.map((turn) => `${turn.speaker}: ${turn.text}`).join("\n")).join("\n\n");
}

function extractionMessages(input) {
  const transcript = serializeSegments(input.segments || []);
  const fields = input.fields.map((field) => field.id).join("\n");
  const user = `Extract the candidate details from this interview transcript.

Transcript:
${transcript}

Fields:
${fields}

Rules:
- Use only information stated in the transcript. Do not invent or infer missing details.
- Set full_name to null unless the candidate explicitly states their personal name in words. Never use or transform an email address or email username as a name.
- Read the entire transcript for corrections before answering. If a value is explicitly corrected, discard the earlier value and return only its replacement.
- Current fields describe only the candidate's latest role. Do not put a former employer, title, or program into a current field.
- Set current_program to null unless a program is explicitly connected to the latest role.
- Set area_of_interest to null unless the candidate explicitly states desired future work. Set reason_for_leaving to null unless the candidate explicitly states why they want to leave their current employer.
- Availability means start timing or notice period. A later correction to timing or notice replaces the earlier availability.
- Current salary is existing compensation. Target salary is desired compensation for the next role.
- Convert colloquial salary figures to complete US-dollar values before returning JSON. In salary discussion, a two- or three-digit number means thousands: 178 means $178,000 and 205 to 215 means $205,000-$215,000.
- Preserve stated qualifiers such as base salary, bonus, equity, notice period, and relocation constraints.
- Return one valid JSON object using exactly the field names above. Use null when a field is not stated.`;
  return [{ role: "user", content: user }];
}

function extractionSchema(input) {
  const properties = Object.fromEntries(input.fields.map((field) => [field.id, { type: ["string", "null"] }]));
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required: input.fields.map((field) => field.id),
  };
}

function questionMessages(input) {
  const transcript = serializeSegments((input.segments || []).slice(-1));
  const user = `This is an interview transcript.

From an interviewer's point of view, generate follow-up questions only when the candidate's answer needs:
- clarification of the claim or personal contribution,
- clarification of the nature of the impact, or
- quantification of the impact.

Default to no questions. Do not ask a question merely because more detail could be interesting.

Ask at most one question for each distinct unresolved claim. There is no overall three-question limit.

Only ask about a candidate achievement or outcome that is unclear or vague.

A quantified achievement is complete for this task when the transcript states the candidate's contribution and a concrete result, such as a number, percentage, scale, scope, or timeframe. Missing methodology does not make that achievement unclear. Do not ask how the result was achieved, measured, calculated, validated, or attributed.

Do not ask about methodology, tools, project scope, challenges, process, lessons learned, or next steps unless the candidate's personal contribution itself is unclear.

Read the whole transcript and do not ask for information that was already answered.

Only follow up on claims about work, achievements, or outcomes. Do not probe contact details, compensation, availability, or relocation.

If the candidate's meaning, contribution, and impact are already clear, return no questions.

Return only the schema-enforced JSON.

Transcript:
${transcript}`;
  return [{ role: "user", content: user }];
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

async function generateJson({ messages, schema, schemaName, maxTokens, url, model, temperature, topK = 50, topP = 0.1, repeatPenalty = 1.05, seed = -1 }) {
  const started = performance.now();
  const body = { model, messages, temperature, top_k: topK, top_p: topP, repeat_penalty: repeatPenalty, seed, max_tokens: maxTokens, stream: true, cache_prompt: true };
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

function validateExtraction(payload, input) {
  const configured = new Set(input.fields.map((field) => field.id));
  const previousById = new Map((input.previousSnapshot || []).map((item) => [item.fieldId, item]));
  const rawPayload = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const isPlaceholder = (value) => {
    const text = String(value || "").trim().toLowerCase().replace(/[.!]+$/g, "").replace(/\s+/g, " ");
    return ["null", "n/a", "na", "none", "unknown"].includes(text)
      || /^(?:not|none) (?:explicitly )?(?:provided|mentioned|stated|specified)(?: in (?:the )?transcript)?$/.test(text);
  };
  const normalizeSalary = (value) => {
    const text = String(value || "").trim();
    if (!text || /[€£]|\b(?:EUR|GBP)\b/i.test(text)) return text;
    const normalized = text.replace(/\$?\b(\d{2,3})(?:,?000|[Kk]|\s+thousand)?\b(?!\s*(?:%|percent))/gi, (match, amount) => {
      const number = Number(amount);
      return number >= 50 ? `$${number.toLocaleString("en-US")},000` : match;
    });
    return normalized.replace(/\$([\d,]+)\s*(?:to|[-–])\s*\$([\d,]+)/g, "$$$1–$$$2");
  };
  const accepted = [], rejected = [], raw = [];
  for (const [fieldId, rawValue] of Object.entries(rawPayload)) {
    const item = { fieldId, status: "provided", value: rawValue };
    if (!configured.has(fieldId)) {
      raw.push(item);
      rejected.push({ update: item, rejectionReason: "Field ID is not in the configured checklist" });
      continue;
    }
    if (rawValue === null || rawValue === undefined) continue;
    const valueText = Array.isArray(rawValue) ? rawValue.join(", ") : String(rawValue).trim();
    raw.push(item);
    if (!valueText || isPlaceholder(valueText)) {
      rejected.push({ update: item, rejectionReason: "Placeholder response treated as empty" });
      continue;
    }
    const value = ["current_salary", "target_salary"].includes(fieldId) ? normalizeSalary(valueText) : valueText;
    accepted.push({ fieldId, status: "provided", value });
  }
  const updatesById = new Map(accepted.map((item) => [item.fieldId, item]));
  const snapshot = input.fields.map((field) => updatesById.get(field.id) || previousById.get(field.id) || { fieldId: field.id, status: "not_provided", value: null });
  const previous = new Map((input.previousSnapshot || []).map((item) => [item.fieldId, `${item.status}:${item.value}`]));
  return {
    checklistSnapshot: snapshot,
    checklistChanges: accepted.filter((item) => previous.get(item.fieldId) !== `${item.status}:${item.value}`),
    rawExtractionPayload: rawPayload,
    rawExtractionUpdates: raw,
    acceptedExtractionUpdates: accepted,
    rejectedExtractionUpdates: rejected,
  };
}

function validateQuestions(payload) {
  const raw = Array.isArray(payload.questions) ? payload.questions.map((question) => ({ question })) : [];
  const accepted = [], rejected = [];
  const seen = new Set();
  for (const item of raw) {
    let rejectionReason = "";
    if (!item?.question || typeof item.question !== "string") rejectionReason = "Malformed question output";
    else if (!item.question.trim().endsWith("?")) rejectionReason = "Output is not phrased as a question";
    const key = item.question.trim().toLowerCase();
    if (!rejectionReason && seen.has(key)) rejectionReason = "Duplicate question in the same update";
    if (rejectionReason) rejected.push({ question: item, rejectionReason });
    else { seen.add(key); accepted.push(item); }
  }
  return { raw, accepted, rejected };
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
  const extractionRun = await generateJson({ messages: extractionMessages(input), schema: extractionSchema(input), schemaName: "interview_extraction", maxTokens: EXTRACTION_MAX_TOKENS, url: profile.extractionUrl, model: profile.extractionModel, temperature: 0, topK: 1, topP: 1, repeatPenalty: 1, seed: 0 });
  const extraction = validateExtraction(extractionRun.payload, input);
  const questionRun = await generateJson({ messages: questionMessages(input), schema: questionSchema, schemaName: "follow_up_questions", maxTokens: QUESTION_MAX_TOKENS, url: profile.questionUrl, model: profile.questionModel, temperature: 0 });
  const questions = validateQuestions(questionRun.payload);
  return { ...extraction, followUpQuestions: questions.accepted, rawFollowUpQuestions: questions.raw, rejectedFollowUpQuestions: questions.rejected, metrics: { ...mergeMetrics(extractionRun.metrics, questionRun.metrics), processRamMb: profileMemoryMb(profile), modelStorageMb: Number(modelStorageMb(profile).toFixed(1)), modelId: profile.id, modelLabel: profile.label } };
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
  if (!analyze) return send(response, 404, { error: "Not found" });
  try {
    const input = await readBody(request);
    return send(response, 200, await infer(input));
  } catch (error) { return send(response, 502, { detail: error instanceof Error ? error.message : String(error) }); }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Split inference adapter: http://127.0.0.1:${PORT}`);
  for (const profile of MODEL_PROFILES.values()) console.log(`${profile.label}: ${profile.extractionModel} at ${profile.extractionUrl}`);
});
