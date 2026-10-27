import { readFileSync, writeFileSync } from "node:fs";
import { digest } from "./corpus-audit.mjs";
const endpoint = process.env.LLAMA_URL || "http://127.0.0.1:8080";
const output = process.env.TEMPLATE_PROBE_OUTPUT || "/tmp/interview-template-probe.json";
async function request(path, body) {
  const response = await fetch(`${endpoint}${path}`, { ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
const props = await request("/props");
const { records } = JSON.parse(readFileSync(new URL("./smoke-inputs.json", import.meta.url)));
const report = { model: props.model_alias, build_info: props.build_info, native_chat_template: props.chat_template, chat_template_hash: digest(props.chat_template), bos_token: props.bos_token, eos_token: props.eos_token, records: [] };
for (const record of records) {
  const { prompt } = await request("/apply-template", { messages: record.messages });
  const target = JSON.stringify(record.target);
  const promptTokens = await request("/tokenize", { content: prompt, add_special: true, parse_special: true });
  const fullTokens = await request("/tokenize", { content: prompt + target + props.eos_token, add_special: true, parse_special: true });
  const actual = report.records.length ? null : await request("/v1/chat/completions", { model: props.model_alias, messages: record.messages, max_tokens: 1, temperature: 0, stream: false, cache_prompt: false });
  if (actual && actual.usage?.prompt_tokens !== promptTokens.tokens.length) throw new Error(`Serving prompt count ${actual.usage?.prompt_tokens} differs from tokenizer ${promptTokens.tokens.length}`);
  report.records.push({ effective_prompt: prompt.startsWith(props.bos_token) ? prompt : props.bos_token + prompt, actual_generation_prompt_tokens: actual?.usage?.prompt_tokens ?? null, tokenizer_add_special: true, id: record.id, task: record.task, prompt, prompt_hash: digest(prompt), messages_hash: record.messages_hash, target_hash: record.target_hash,
    prompt_tokens: promptTokens.tokens.length, target_tokens: fullTokens.tokens.length - promptTokens.tokens.length,
    generation_prefix_tail: prompt.slice(-100), token_prefix_stable: promptTokens.tokens.every((token, index) => fullTokens.tokens[index] === token),
    prompt_token_ids: promptTokens.tokens, full_token_ids: fullTokens.tokens });
}
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
for (const record of report.records) console.log(JSON.stringify({ id: record.id, prompt_tokens: record.prompt_tokens, total_tokens: record.prompt_tokens + record.target_tokens, prefix: record.generation_prefix_tail.slice(-55), prefix_stable: record.token_prefix_stable }));
console.log(`Local template/tokenization report: ${output}`);
