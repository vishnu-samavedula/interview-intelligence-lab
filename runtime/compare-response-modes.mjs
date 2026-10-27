import { writeFileSync } from "node:fs";
import { staticCases, multiChunkCases } from "../web/lib/static-cases.ts";
import { defaultFields } from "../web/lib/default-fields.ts";

const endpoint = process.env.ADAPTER_URL || "http://127.0.0.1:8000";
const output = process.env.COMPARISON_OUTPUT || "/tmp/interview-response-comparison.json";
const report = { modelId: process.env.COMPARISON_MODEL || "lfm2.5-2.6b-no-think", recordedAt: new Date().toISOString(), runs: [] };
const repeats = Number(process.env.COMPARISON_REPEATS || 3);

for (let repeat = 1; repeat <= repeats; repeat++) {
  for (const [mode, scenarios] of [["single", staticCases], ["multi", multiChunkCases]]) {
    const scenario = scenarios.find((item) => item.id === "static-original-document");
    const run = { repeat, mode, steps: [] };
    report.runs.push(run);
    let previousSnapshot = [], previousQuestions = [], processedResponseCount = 0;
    for (let cursor = 1; cursor <= scenario.segments.length; cursor++) {
      const response = await fetch(`${endpoint}/v1/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: report.modelId, segments: scenario.segments.slice(0, cursor), fields: defaultFields, previousSnapshot, previousQuestions, processedResponseCount }),
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`${mode}/${cursor}: ${await response.text()}`);
      const result = await response.json();
      run.steps.push({ chunk: cursor, result });
      if (result.analysisPerformed) {
        previousSnapshot = result.checklistSnapshot;
        previousQuestions.push(...result.followUpQuestions);
        processedResponseCount = result.completedResponseCount;
      }
      writeFileSync(output, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ repeat, mode, chunk: cursor, analyzed: result.analysisPerformed, completedResponses: result.completedResponseCount, questions: result.followUpQuestions, ms: result.metrics?.totalMs }));
    }
  }
}
console.log(`Raw results saved to ${output}`);
