import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { completedResponses, serializeSegments, transcriptChunks } from "./transcript-json.mjs";
import { extractionMessages, questionMessages } from "./model-prompts.mjs";
import { staticCases, multiChunkCases } from "../web/lib/static-cases.ts";

test("chunking preserves every word, speaker, exchange ID, and order", () => {
  for (const scenario of multiChunkCases) {
    const single = staticCases.find((item) => item.id === scenario.id);
    const reconstruct = (segments) => {
      const exchanges = new Map();
      for (const segment of segments) for (const turn of segment.turns) {
        const key = `${turn.turnId}:${turn.speaker}`;
        exchanges.set(key, [...(exchanges.get(key) ?? []), ...turn.text.split(/\s+/)]);
      }
      return [...exchanges];
    };
    assert.deepEqual(reconstruct(scenario.segments), reconstruct(single.segments));
    scenario.segments.forEach((segment, index) => {
      const count = segment.turns.reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0);
      assert.ok(count > 0 && count <= 35);
      if (index < scenario.segments.length - 1) assert.equal(count, 35);
      assert.equal(segment.startSeconds, index * 15);
      assert.equal(segment.endSeconds, (index + 1) * 15);
      assert.equal(new Date(`${segment.date}T${segment.timestamp}`).toISOString(), new Date(Date.UTC(2026, 9, 21, 10, 0, segment.endSeconds)).toISOString());
    });
    assert.equal(new Set(scenario.segments.map((segment) => segment.id)).size, scenario.segments.length);
    assert.deepEqual(scenario.questionExpectations, []);
  }
});

test("JSON keeps partial exchanges and temporal metadata without fabricating speech", () => {
  const original = multiChunkCases.find((item) => item.id === "static-original-document");
  const chunks = transcriptChunks(original.segments);
  assert.ok(chunks.length > 1);
  assert.equal(chunks[0].chunk_id, original.segments[0].id);
  assert.equal(chunks[0].date, "2026-10-21");
  assert.equal(chunks[0].turns[0].turn_id, 1);
  assert.equal(chunks[1].turns[0].turn_id, 1);
  assert.equal(chunks[1].turns[0].interviewer, undefined);
  assert.deepEqual(JSON.parse(serializeSegments(original.segments)), { chunks });
});

test("completed answers reconstruct negation and exclude unfinished speech", () => {
  const scenario = multiChunkCases.find((item) => item.id === "static-original-document");
  assert.deepEqual(scenario.segments.map((_, index) => completedResponses(scenario.segments.slice(0, index + 1)).length), [0, 1, 1, 2, 2, 3, 4, 5]);
  const responses = completedResponses(scenario.segments);
  const single = staticCases.find((item) => item.id === scenario.id);
  const full = completedResponses(single.segments);
  assert.deepEqual(responses.map(({ interviewer, candidate }) => ({ interviewer, candidate })), full.map(({ interviewer, candidate }) => ({ interviewer, candidate })));
  assert.ok(responses.at(-1).candidate.startsWith("I'm not looking to relocate"));
  assert.ok(responses[0].candidate.includes("I still have my .mil address"));
  assert.equal(completedResponses(scenario.segments.slice(0, 7)).some((item) => item.turn_id === 5), false);
});

test("prompts use complete answers and questions see only the latest three exchanges", () => {
  const scenario = multiChunkCases.find((item) => item.id === "static-original-document");
  for (let count = 1; count <= scenario.segments.length; count++) {
    const input = { segments: scenario.segments.slice(0, count), fields: [{ id: "email" }], previousQuestions: [{ question: "What was the outcome?" }] };
    const ready = completedResponses(input.segments);
    const extraction = extractionMessages(input)[0].content;
    const questions = questionMessages(input)[0].content;
    const extractionJson = JSON.parse(extraction.slice(extraction.indexOf("{\n"), extraction.indexOf("\n\nFields:")));
    const questionJson = JSON.parse(questions.slice(questions.indexOf("{\n")));
    assert.deepEqual(extractionJson.responses, ready);
    assert.deepEqual(questionJson.responses, ready.slice(-3));
    assert.deepEqual(questionJson.recently_suggested_questions, ["What was the outcome?"]);
  }
});

test("adapter skips inference until a new complete response arrives", async () => {
  const source = readFileSync(new URL("./llama-adapter.mjs", import.meta.url), "utf8");
  let calls = 0;
  const context = vm.createContext({ completedResponses, MODEL_PROFILES: new Map([["test", {}]]), DEFAULT_MODEL_ID: "test", extractionMessages: () => [], liveExtractionSchema: () => ({}), EXTRACTION_MAX_TOKENS: 1, generateJson: () => { calls++; throw new Error("inference started"); } });
  vm.runInContext(source.slice(source.indexOf("async function infer"), source.indexOf("const server =")), context);
  const scenario = multiChunkCases.find((item) => item.id === "static-original-document");
  assert.equal((await context.infer({ segments: scenario.segments.slice(0, 1) })).analysisPerformed, false);
  assert.equal(calls, 0);
  await assert.rejects(context.infer({ segments: scenario.segments.slice(0, 2) }), /inference started/);
  assert.equal(calls, 1);
  assert.equal((await context.infer({ segments: scenario.segments.slice(0, 3), processedResponseCount: 1 })).analysisPerformed, false);
  assert.equal(calls, 1);
});

test("question ranking preserves six candidates, shows top three, and rejects exact repeats or malformed values", () => {
  const source = readFileSync(new URL("./llama-adapter.mjs", import.meta.url), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf("function validateQuestions"), source.indexOf("function mergeMetrics")), context);
  const result = context.validateQuestions({ questions: ["How much?", 42, "What changed?", "What was the outcome?", "What did you own?", "What did that enable?", "Which constraint mattered?", "What interested you?", "Seventh candidate?"] }, [{ question: "How much?" }]);
  assert.equal(result.accepted.length, 3);
  assert.equal(result.ranked.length, 6);
  assert.equal(result.accepted[0].question, "What changed?");
  assert.equal(result.accepted[2].question, "What did you own?");
  assert.equal(result.rejected[0].rejectionReason, "Previously suggested question");
  assert.equal(result.rejected[1].rejectionReason, "Malformed question output");
  assert.equal(result.rejected[2].rejectionReason, "At most six ranked candidates are allowed per analysis");
});
