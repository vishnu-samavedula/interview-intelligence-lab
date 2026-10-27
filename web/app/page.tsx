"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { BarChart3, ChevronDown, Cpu, FlaskConical, Play, Radio, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { normalized, valuesMatch } from "../../runtime/quality-scoring.mjs";
import trainingResults from "@/lib/demo-training-results.json";
import { defaultFields } from "@/lib/default-fields";
import { demoCases, demoMultiChunkCases } from "@/lib/static-cases";
import { completedResponses, transcriptChunks } from "../../runtime/transcript-json.mjs";
import type { AnalysisResponse, BufferedResponse, FieldResult, FinalizationResponse, FollowUp, ModelProfile, PerformanceMetrics, RejectedExtraction, RejectedFollowUp, TranscriptSegment } from "@/lib/harness-types";

type RunState = "idle" | "running" | "complete" | "error";
type QuestionBatch = { segmentId: string; timestamp: string; questions: FollowUp[]; ranked?: FollowUp[]; rawCount: number; rejected: RejectedFollowUp[] };
type ExtractionAudit = { rawCount: number; acceptedCount: number; rejected: RejectedExtraction[] };
const fallbackModels: ModelProfile[] = [
  { id: "lfm2.5-1.2b-no-think", label: "LFM2.5 1.2B · no thinking", description: "Smaller reasoning checkpoint with reasoning disabled", available: true },
  { id: "lfm2.5-2.6b-no-think", label: "LFM2.5 2.6B · no thinking", description: "Larger checkpoint with reasoning disabled", available: true },
];

function timecode(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function Home() {
  const [mode, setMode] = useState<"single" | "multiple">("single");
  const [scenarioId, setScenarioId] = useState(demoCases[0].id);
  const [endpoint] = useState("http://127.0.0.1:8000");
  const [models, setModels] = useState<ModelProfile[]>(fallbackModels);
  const [modelId, setModelId] = useState("lfm2.5-2.6b-no-think");
  const fields = defaultFields;
  const [runState, setRunState] = useState<RunState>("idle");
  const [cursor, setCursor] = useState(0);
  const [processedResponses, setProcessedResponses] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [visibleSegments, setVisibleSegments] = useState<TranscriptSegment[]>([]);
  const [snapshot, setSnapshot] = useState<FieldResult[]>(defaultFields.map((field) => ({ fieldId: field.id, status: "not_provided", value: null })));
  const [questions, setQuestions] = useState<FollowUp[]>([]);
  const [questionHistory, setQuestionHistory] = useState<QuestionBatch[]>([]);
  const [extractionAudits, setExtractionAudits] = useState<ExtractionAudit[]>([]);
  const [rawExtractionPayload, setRawExtractionPayload] = useState<Record<string, unknown> | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [lastChanges, setLastChanges] = useState<FieldResult[]>([]);
  const [error, setError] = useState("");
  const [finalResult, setFinalResult] = useState<FinalizationResponse | null>(null);
  const [finalState, setFinalState] = useState<RunState>("idle");
  const [finalError, setFinalError] = useState("");
  const processing = useRef(false);

  const allScenarios = mode === "single" ? demoCases : demoMultiChunkCases;
  const scenario = useMemo(() => allScenarios.find((item) => item.id === scenarioId) ?? allScenarios[0], [allScenarios, scenarioId]);
  const progress = scenario.segments.length ? (cursor / scenario.segments.length) * 100 : 0;
  const covered = snapshot.filter((field) => field.status === "provided").length;
  const latestTurns = (visibleSegments.length ? visibleSegments : mode === "single" ? scenario.segments : []).flatMap((segment) => segment.turns.map((turn) => ({ ...turn, segment })));
  const incomingSegment = mode === "multiple" ? scenario.segments[cursor] : scenario.segments[0];
  const jsonSegment = runState === "running" ? visibleSegments.at(-1) : incomingSegment ?? visibleSegments.at(-1);
  const finished = cursor === scenario.segments.length;
  const busy = runState === "running" || finalState === "running";
  const readyResponses = completedResponses(visibleSegments);

  const reset = useCallback(() => {
    setFinalResult(null); setFinalState("idle"); setFinalError("");
    setProcessedResponses(0); setBuffering(false);
    setRunState("idle"); setCursor(0); setVisibleSegments([]); setQuestions([]); setQuestionHistory([]); setExtractionAudits([]); setRawExtractionPayload(null); setMetrics([]); setLastChanges([]); setError("");
    setSnapshot(fields.map((field) => ({ fieldId: field.id, status: "not_provided", value: null })));
  }, [fields]);

  const analyze = useCallback(async (nextSegments: TranscriptSegment[], previous: FieldResult[], previousQuestions: FollowUp[]): Promise<AnalysisResponse | BufferedResponse> => {
    const response = await fetch(`${endpoint}/v1/analyze`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: scenario.id, modelId, segments: nextSegments, fields, previousSnapshot: previous, previousQuestions, processedResponseCount: processedResponses }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({})) as { detail?: string };
      throw new Error(failure.detail ? `Liquid endpoint ${response.status}: ${failure.detail}` : `Liquid endpoint returned ${response.status}`);
    }
    return response.json();
  }, [endpoint, fields, modelId, processedResponses, scenario.id]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${endpoint}/v1/models`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Model catalog unavailable");
        return await response.json() as { defaultModelId?: string; models?: ModelProfile[] };
      })
      .then((catalog: { defaultModelId?: string; models?: ModelProfile[] }) => {
        if (catalog.models?.length) setModels(catalog.models);
        const saved = window.localStorage.getItem("interview-model-id");
        const available = (id?: string | null) => id && catalog.models?.some((model) => model.id === id && model.available !== false);
        const preferred = available(saved) ? saved : available("lfm2.5-2.6b-demo-adapters") ? "lfm2.5-2.6b-demo-adapters" : catalog.defaultModelId;
        if (preferred && available(preferred)) setModelId(preferred);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [endpoint]);

  const runStaticPreset = useCallback(async () => {
    if (processing.current || cursor >= scenario.segments.length) return;
    processing.current = true; setRunState("running"); setError(""); setBuffering(false);
    const nextCursor = mode === "multiple" ? cursor + 1 : scenario.segments.length;
    const nextSegments = scenario.segments.slice(0, nextCursor);
    const segment = nextSegments.at(-1);
    setVisibleSegments(nextSegments);
    try {
      const response = await analyze(nextSegments, snapshot, questionHistory.flatMap((batch) => batch.questions));
      if (!response.analysisPerformed) {
        setCursor(nextCursor); setBuffering(true); setLastChanges([]);
        setRunState(nextCursor === scenario.segments.length ? "complete" : "idle");
        return;
      }
      setProcessedResponses(response.completedResponseCount); setBuffering(false);
      const batch = { segmentId: segment?.id ?? scenario.id, timestamp: timecode(segment?.endSeconds ?? 0), questions: response.followUpQuestions, ranked: response.rankedFollowUpQuestions ?? response.followUpQuestions, rawCount: response.rawFollowUpQuestions?.length ?? response.followUpQuestions.length, rejected: response.rejectedFollowUpQuestions ?? [] };
      const audit = { rawCount: response.rawExtractionUpdates?.length ?? response.checklistChanges.length, acceptedCount: (response.rawExtractionUpdates?.length ?? response.checklistChanges.length) - (response.rejectedExtractionUpdates?.length ?? 0), rejected: response.rejectedExtractionUpdates ?? [] };
      setSnapshot(response.checklistSnapshot); setLastChanges(response.checklistChanges); setQuestions(response.followUpQuestions); setQuestionHistory((current) => [...current, batch]); setExtractionAudits((current) => [...current, audit]); setRawExtractionPayload(response.rawExtractionPayload ?? null); setMetrics((current) => [...current, response.metrics]); setCursor(nextCursor);
      setRunState(nextCursor === scenario.segments.length ? "complete" : "idle");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Static preset failed"); setRunState("error"); }
    finally { processing.current = false; }
  }, [analyze, cursor, mode, questionHistory, scenario, snapshot]);

  const finalizeCall = useCallback(async () => {
    if (processing.current || !finished) return;
    processing.current = true; setFinalState("running"); setFinalError("");
    try {
      const response = await fetch(`${endpoint}/v1/finalize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, segments: visibleSegments, fields, previousSnapshot: snapshot }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({})) as { detail?: string };
        throw new Error(failure.detail || `Finalization failed (${response.status})`);
      }
      setFinalResult(await response.json() as FinalizationResponse); setFinalState("complete");
    } catch (cause) { setFinalError(cause instanceof Error ? cause.message : "End-of-call processing failed"); setFinalState("error"); }
    finally { processing.current = false; }
  }, [endpoint, fields, finished, modelId, snapshot, visibleSegments]);

  const latest = metrics.at(-1);
  const selectedModel = models.find((model) => model.id === modelId) ?? fallbackModels.find((model) => model.id === modelId) ?? fallbackModels[0];
  const totalQuestions = questionHistory.reduce((sum, batch) => sum + batch.questions.length, 0);
  const quality = useMemo(() => {
    const defaultIds = new Set(defaultFields.map((field) => field.id));
    const expected = new Map<string, string>();
    for (const event of scenario.expectations) if (event.fromSegment <= cursor) expected.set(event.fieldId, event.value);
    let correct = 0, wrong = 0, unsupported = 0, missed = 0, trueNegative = 0;
    const misses: string[] = [], wrongValues: string[] = [], unsupportedValues: string[] = [];
    for (const field of fields.filter((item) => defaultIds.has(item.id))) {
      const wanted = expected.get(field.id);
      const result = snapshot.find((item) => item.fieldId === field.id);
      const actual = result?.status === "provided" && result.value ? result.value : null;
      if (wanted && actual && valuesMatch(field.id, wanted, actual)) correct += 1;
      else if (wanted && actual) { wrong += 1; wrongValues.push(field.label); }
      else if (wanted) { missed += 1; misses.push(field.label); }
      else if (actual) { unsupported += 1; unsupportedValues.push(field.label); }
      else trueNegative += 1;
    }
    const provided = snapshot.filter((item) => item.status === "provided");
    const responses = new Map(readyResponses.map((response) => [response.turn_id, response]));
    const evidenceValid = provided.filter((item) => item.evidence?.length && item.evidence.every((evidence) => responses.get(evidence.turnId)?.candidate.replace(/\s+/g, " ").includes(evidence.quote.replace(/\s+/g, " ")))).length;
    const allQuestions = questionHistory.flatMap((batch) => batch.questions.map((question) => ({ ...question, segmentId: batch.segmentId })));
    const rawQuestionCount = questionHistory.reduce((sum, batch) => sum + batch.rawCount, 0);
    const rejectedQuestionCount = questionHistory.reduce((sum, batch) => sum + batch.rejected.length, 0);
    const rawExtractionCount = extractionAudits.reduce((sum, audit) => sum + audit.rawCount, 0);
    const acceptedExtractionCount = extractionAudits.reduce((sum, audit) => sum + audit.acceptedCount, 0);
    const rejectedExtractionCount = extractionAudits.reduce((sum, audit) => sum + audit.rejected.length, 0);
    const placeholderCleanupCount = extractionAudits.reduce((sum, audit) => sum + audit.rejected.filter((item) => item.rejectionReason === "Placeholder response treated as empty").length, 0);
    const invalidExtractionCount = rejectedExtractionCount - placeholderCleanupCount;
    const validQuestions = allQuestions.filter((item) => item.question.trim().endsWith("?")).length;
    const normalizedQuestions = allQuestions.map((item) => normalized(item.question));
    const duplicates = normalizedQuestions.length - new Set(normalizedQuestions).size;
    const evaluatedQuestionBatches = questionHistory.map((batch, index) => ({ batch, expected: scenario.questionExpectations?.find((item) => item.segment === index + 1) })).filter((item) => item.expected);
    const matchingQuestionBatches = evaluatedQuestionBatches.filter(({ batch, expected }) => {
      if (!expected) return false;
      const countFits = batch.questions.length >= expected.minQuestions && batch.questions.length <= expected.maxQuestions;
      return countFits;
    }).length;
    return {
      precision: correct + wrong + unsupported ? correct / (correct + wrong + unsupported) : null,
      recall: correct + wrong + missed ? correct / (correct + wrong + missed) : null,
      evidence: provided.length ? evidenceValid / provided.length : null,
      extractionAcceptance: rawExtractionCount ? acceptedExtractionCount / rawExtractionCount : null,
      questionContract: rawQuestionCount ? validQuestions / rawQuestionCount : null,
      questionFit: evaluatedQuestionBatches.length ? matchingQuestionBatches / evaluatedQuestionBatches.length : null,
      intervalCoverage: cursor ? cursor / scenario.segments.length : null,
      correct, wrong, unsupported, missed, trueNegative, duplicates, rejectedQuestionCount, rejectedExtractionCount, placeholderCleanupCount, invalidExtractionCount, misses, wrongValues, unsupportedValues,
    };
  }, [cursor, extractionAudits, fields, questionHistory, scenario.expectations, scenario.questionExpectations, scenario.segments.length, snapshot, readyResponses]);
  const latestRejected = questionHistory.at(-1)?.rejected ?? [];
  const latestRejectedExtraction = extractionAudits.at(-1)?.rejected ?? [];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-white/13 bg-[#0a0a0a]/90 px-5 py-4 backdrop-blur-xl lg:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4">
          <Image src="/liquid-ai-black.svg" alt="Liquid AI" width={120} height={39} priority className="h-7 w-auto invert" />
          <div className="h-8 w-px bg-white/13" aria-hidden />
          <div><h1 className="font-serif text-lg font-normal tracking-[-0.02em]">Interview Intelligence Lab demo</h1><p className="text-xs text-zinc-400">offline interview transcript inference and intelligence</p></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 p-5 lg:p-8 xl:grid-cols-[320px_minmax(480px,1fr)_320px]">
        <aside className="flex flex-col gap-5">
          <section className="panel p-5">
            <div className="flex items-center justify-between"><p className="eyebrow">Test setup</p><Badge variant="outline" className="border-violet-300/20 text-violet-200"><FlaskConical className="size-3" /> Static</Badge></div>
            <label className="form-label" htmlFor="mode">Transcription mode</label>
            <select id="mode" className="input-shell w-full" value={mode} disabled={busy} onChange={(event) => { reset(); const nextMode = event.target.value as "single" | "multiple"; setMode(nextMode); setScenarioId(nextMode === "multiple" ? "static-original-document" : demoCases[0].id); }}><option value="single">Single chunk</option><option value="multiple">Multiple chunks</option></select>
            <label className="form-label" htmlFor="scenario">Candidate interview</label>
            <select id="scenario" className="input-shell w-full" value={scenarioId} onChange={(event) => { reset(); setScenarioId(event.target.value); }} disabled={busy}>{allScenarios.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
            <label className="form-label" htmlFor="model">Model under test</label>
            <select id="model" className="input-shell w-full" value={modelId} onChange={(event) => { reset(); setModelId(event.target.value); window.localStorage.setItem("interview-model-id", event.target.value); }} disabled={busy}>{models.map((model) => <option key={model.id} value={model.id} disabled={!model.available}>{model.label}{model.available ? "" : " · unavailable"}</option>)}</select>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{selectedModel.description}{selectedModel.modelStorageMb ? ` · ${(selectedModel.modelStorageMb / 1024).toFixed(2)} GB on disk` : ""}</p>
            <div className="mt-3 grid grid-cols-2 gap-2"><div className="stat-tile"><span>Input</span><strong>{mode === "multiple" ? `${scenario.segments.length} chunks · 15s each` : "Single chunk"}</strong></div><div className="stat-tile"><span>Profile</span><strong>{scenario.role}</strong></div></div>
            <div className="mt-4 grid gap-2">
              {runState !== "running" ? <Button onClick={() => void runStaticPreset()} disabled={finished || busy}><Play className="size-4 fill-current" />{mode === "multiple" ? "Process chunk" : "Analyze preset"}</Button> : <Button variant="secondary" disabled><FlaskConical className="size-4" />Analyzing</Button>}
              <Button variant="secondary" disabled={!finished || busy || finalState === "complete"} onClick={() => void finalizeCall()}><Sparkles className="size-4" />{finalState === "running" ? "Reconciling and summarizing…" : finalState === "complete" ? "Call finalized" : "End call & summarize"}</Button>
              <Button variant="ghost" onClick={reset} disabled={busy}><RotateCcw className="size-4" />Reset result</Button>
              {questionHistory.length > 0 && <a href="#follow-up-questions" className="text-center text-sm text-primary underline underline-offset-4">{questions.length ? `View ${questions.length} suggested question${questions.length === 1 ? "" : "s"}` : "View question status and history"}</a>}
            </div>
            {mode === "multiple" && <p className="mt-3 text-xs text-zinc-400" role="status">{finished ? "End of chunk received · All chunks processed." : `${cursor} / ${scenario.segments.length} chunks processed${runState === "running" ? " · Receiving…" : ""}`}</p>}
            {mode === "multiple" && <p className="mt-2 text-xs text-zinc-400" role="status">{buffering ? "Awaiting continuation · candidate response buffered." : `${processedResponses} complete responses analyzed`}</p>}
          </section>

          <details className="group panel overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-2"><BarChart3 className="size-4 text-primary" /><p className="eyebrow">Performance samples</p></div>
              <span className="flex items-center gap-2 text-xs text-zinc-500">{metrics.length} run{metrics.length === 1 ? "" : "s"}{latest ? ` · ${latest.totalMs} ms` : ""}<ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" /></span>
            </summary>
            <div className="max-h-[430px] overflow-y-auto border-t border-white/13">
              {metrics.slice(-8).reverse().map((item, index) => <section className="border-b border-white/13 p-5 last:border-b-0" key={`${metrics.length-index}-${item.totalMs}`}><div className="flex items-start justify-between gap-3"><div><strong className="text-sm font-medium">Run #{metrics.length - index}</strong><p className="mt-1 text-xs text-zinc-500">{item.modelLabel ?? selectedModel.label}</p></div><span className="font-mono text-xs text-primary">{item.totalMs} ms</span></div><dl className="performance-list mt-4"><div><dt>Extract</dt><dd>{item.extractionMs ?? 0} ms</dd></div><div><dt>Questions</dt><dd>{item.questionMs ?? 0} ms</dd></div><div><dt>TTFT</dt><dd>{item.ttftMs} ms</dd></div><div><dt>Decode</dt><dd>{item.decodeTokensPerSecond.toFixed(1)} t/s</dd></div><div><dt>Tokens</dt><dd>{item.inputTokens} in · {item.outputTokens} out</dd></div><div><dt>Process RAM</dt><dd>{(item.processRamMb / 1024).toFixed(2)} GB</dd></div><div><dt>Storage</dt><dd>{item.modelStorageMb ? `${(item.modelStorageMb / 1024).toFixed(2)} GB` : "—"}</dd></div><div><dt>Accelerator</dt><dd>{item.gpuMemoryMb ? `${item.gpuMemoryMb} MB` : "Unified"}</dd></div></dl></section>)}
              {!metrics.length && <p className="p-5 text-xs leading-5 text-zinc-500">Performance appears after analyzing a preset.</p>}
            </div>
          </details>


        </aside>

        <section className="min-w-0 space-y-5">
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/13 px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary"><Radio className="size-4" /></span><div><h2>Preset transcript</h2><p className="text-xs text-zinc-500">{runState === "running" ? "Receiving chunk · analyzing complete responses" : finished ? "Analysis complete" : mode === "multiple" ? `Next: chunk ${cursor + 1} of ${scenario.segments.length}` : "Ready to analyze"}</p></div></div><Badge variant="secondary" className="bg-white/5 text-zinc-400">Static input</Badge></div>
            <Progress value={progress} className="h-1 rounded-none bg-white/5 [&>div]:bg-primary" />
            <div className="min-h-[340px] max-h-[470px] overflow-y-auto p-5" aria-live="polite">
              {!latestTurns.length && <p className="text-sm text-zinc-500">Press Process chunk to receive the first 15 seconds of this interview.</p>}
              {latestTurns.map((turn, index) => <div className={`transcript-row ${turn.speaker === "Candidate" ? "candidate" : ""}`} key={`${turn.segment.id}-${index}`}><span>{turn.speaker}</span><p>{turn.text}</p><time>{timecode(turn.segment.startSeconds)}–{timecode(turn.segment.endSeconds)} · Turn {turn.turnId}{turn.speaker === "Candidate" && turn.responseComplete === false ? " · continued" : ""}</time></div>)}
            </div>
          </div>

          {jsonSegment && <details className="panel overflow-hidden" open={mode === "multiple"}><summary className="cursor-pointer p-5 text-sm">{finished ? "Last received chunk" : runState === "running" ? "Processing chunk" : mode === "multiple" ? "Next incoming chunk" : "Incoming transcript"} · JSON</summary><pre className="max-h-72 overflow-auto border-t border-white/13 p-5 text-[11px] leading-5 text-zinc-300">{JSON.stringify(transcriptChunks([jsonSegment])[0], null, 2)}</pre></details>}

          {!!readyResponses.length && <details className="panel overflow-hidden"><summary className="cursor-pointer p-5 text-sm">Complete responses used for inference · {readyResponses.length}</summary><pre className="max-h-72 overflow-auto border-t border-white/13 p-5 text-[11px] leading-5 text-zinc-300">{JSON.stringify({ responses: readyResponses }, null, 2)}</pre></details>}

          {error && <div className="rounded-md border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">{error}. Check the local LFM endpoint and model server.</div>}

          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/13 p-5"><div className="flex items-center gap-2"><Cpu className="size-4 text-primary" /><h2>Extraction results</h2></div><span className="text-xs text-zinc-400">{covered} / {fields.length} covered</span></div>
            <Progress value={fields.length ? covered / fields.length * 100 : 0} className="h-1 rounded-none bg-white/8 [&>div]:bg-primary" />
            <div className="max-h-[520px] overflow-auto"><table className="extraction-table"><thead><tr><th>Field</th><th>Extracted value</th><th>Status</th></tr></thead><tbody>{snapshot.map((result) => { const field = fields.find((item) => item.id === result.fieldId); const changed = lastChanges.some((item) => item.fieldId === result.fieldId); return <tr key={result.fieldId}><td>{field?.label ?? result.fieldId}</td><td><strong className={result.status === "provided" ? "text-zinc-100" : "text-zinc-600"}>{result.value ?? "Not provided"}</strong>{result.evidence?.map((item, index) => <blockquote key={index}>“{item.quote}” <span className="text-zinc-500">· Turn {item.turnId}</span></blockquote>)}</td><td>{changed ? <Badge className="bg-primary/10 text-primary">extracted</Badge> : <span className={result.status === "provided" ? "text-primary" : "text-zinc-600"}>{result.status === "provided" ? "provided" : "not found"}</span>}</td></tr>; })}</tbody></table></div>
            {!!latestRejectedExtraction.length && <div className="quality-alert mx-5 mb-5"><p>{latestRejectedExtraction.length} model extraction{latestRejectedExtraction.length === 1 ? " was" : "s were"} rejected:</p>{latestRejectedExtraction.map((item, index) => <p key={`${item.update.fieldId ?? "unknown"}-${index}`}>{item.update.fieldId ?? "Unknown field"}: {item.rejectionReason}</p>)}</div>}
          </section>

          <section className="panel overflow-hidden" aria-label="End-of-call review">
            <div className="border-b border-white/13 p-5"><h2>End-of-call review</h2><p className="mt-2 text-xs text-zinc-400">{finalState === "running" ? "Rebuilding the checklist from the full transcript and generating a summary…" : finalResult ? "Final results are separate from the live checklist. Changes include wording differences; review the supporting evidence." : "After all chunks are processed, use End call & summarize to reconcile extraction and create an AI summary."}</p></div>
            {finalError && <p className="p-5 text-sm text-rose-300" role="alert">{finalError}. Your live results are preserved; retry End call & summarize.</p>}
            {finalResult && <div className="space-y-5 p-5">
              <div><h3 className="text-sm font-medium text-primary">AI summary</h3><p className="mt-2 text-sm leading-6 text-zinc-300">{finalResult.summary.summary}</p></div>
              {!!finalResult.summary.keyPoints.length && <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-300">{finalResult.summary.keyPoints.map((point, index) => <li key={index}>{point}</li>)}</ul>}
              <div><h3 className="text-sm font-medium">Unresolved questions</h3>{finalResult.summary.unresolvedQuestions.length ? <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-300">{finalResult.summary.unresolvedQuestions.map((question, index) => <li key={index}>{question}</li>)}</ul> : <p className="mt-2 text-xs text-zinc-500">None identified by the model.</p>}</div>
              <div><h3 className="text-sm font-medium">Missing checklist information</h3><p className="mt-2 text-xs leading-5 text-zinc-400">{finalResult.missingFieldIds.length ? finalResult.missingFieldIds.map((id) => fields.find((field) => field.id === id)?.label ?? id).join(", ") : "All configured fields have a final value."}</p></div>
              <div><h3 className="mb-2 text-sm font-medium">Live → final changes · {finalResult.changes.length}</h3>{finalResult.changes.length ? <div className="overflow-auto"><table className="extraction-table"><thead><tr><th>Field</th><th>Live</th><th>Final</th></tr></thead><tbody>{finalResult.changes.map((change) => <tr key={change.fieldId}><td>{fields.find((field) => field.id === change.fieldId)?.label ?? change.fieldId}</td><td>{change.before ?? "Not provided"}</td><td>{change.after ?? "Not provided"}</td></tr>)}</tbody></table></div> : <p className="text-xs text-zinc-500">No value changes.</p>}</div>
              <details open><summary className="cursor-pointer text-sm font-medium">Final checklist with evidence</summary><div className="mt-3 max-h-[520px] overflow-auto"><table className="extraction-table"><thead><tr><th>Field</th><th>Final value / evidence</th></tr></thead><tbody>{finalResult.finalSnapshot.map((result) => <tr key={result.fieldId}><td>{fields.find((field) => field.id === result.fieldId)?.label ?? result.fieldId}</td><td><strong>{result.value ?? "Not provided"}</strong>{result.evidence.map((item, index) => <blockquote key={index}>“{item.quote}”<br /><span className="text-[10px] text-zinc-500">Turn {item.turnId} · {item.timestamp} · {item.chunkIds.join(", ")}</span></blockquote>)}</td></tr>)}</tbody></table></div></details>
              {!!finalResult.rejectedExtractions.length && <div className="quality-alert"><p>Rejected final values:</p>{finalResult.rejectedExtractions.map((item) => <p key={item.fieldId}>{item.fieldId}: {item.reason}</p>)}</div>}
              <details><summary className="cursor-pointer text-xs text-zinc-400">Raw end-of-call model output</summary><pre className="mt-2 max-h-72 overflow-auto text-[11px] text-zinc-400">{JSON.stringify({ extraction: finalResult.rawExtractionPayload, summary: finalResult.rawSummaryPayload }, null, 2)}</pre></details>
              <p className="text-xs leading-5 text-zinc-500">AI-generated review · {(finalResult.metrics.totalMs / 1000).toFixed(1)} s · Quotes are checked against candidate speech; factual interpretation still needs review.</p>
            </div>}
          </section>

          {rawExtractionPayload && <details className="group panel overflow-hidden"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden"><div className="flex items-center gap-2"><Cpu className="size-4 text-primary" /><p className="eyebrow">Raw extraction output</p></div><ChevronDown className="size-4 text-zinc-500 transition-transform duration-200 group-open:rotate-180" /></summary><pre className="max-h-96 overflow-auto border-t border-white/13 p-5 text-[11px] leading-5 text-zinc-300">{JSON.stringify(rawExtractionPayload, null, 2)}</pre></details>}
        </section>

        <aside className="flex flex-col gap-5">
          <section id="follow-up-questions" className="panel scroll-mt-5 p-5">
            <div><div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /><h2>Suggested follow-ups</h2></div><span className="mt-1 block pl-6 text-xs text-zinc-500">Top {questions.length} · ranked by the model · {totalQuestions} shown so far</span></div>
            <ol className="mt-4 max-h-[390px] space-y-3 overflow-y-auto pr-1">{questions.map((question, index) => <li className="question-card" key={question.question}><span>{index + 1}</span><div><p>{question.question}</p>{question.reason && <small>{question.reason}</small>}{question.triggerQuote && <blockquote>“{question.triggerQuote}”</blockquote>}{question.category && <em>{question.category.replaceAll("_", " ")}</em>}</div></li>)}{!questions.length && <li className="empty-compact">{buffering && !questionHistory.length ? "Awaiting a complete candidate response." : questionHistory.length ? (questionHistory.at(-1)?.rawCount ? "The model returned questions, but they were duplicates or failed formatting. See Model output below." : "The model returned no questions for this window. Earlier suggestions remain in Model output below.") : "Suggestions appear after processing a complete response."}</li>}</ol>
            {!!latestRejected.length && <div className="quality-alert mt-3"><p>{latestRejected.length} model suggestion{latestRejected.length === 1 ? " was" : "s were"} rejected:</p>{latestRejected.map((item, index) => <p key={`${item.question.question}-${index}`}>{item.rejectionReason}</p>)}</div>}
            {(questionHistory.at(-1)?.ranked?.length ?? 0) > 3 && <details className="mt-4 border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs text-zinc-400">All ranked candidates ({questionHistory.at(-1)?.ranked?.length})</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300">{questionHistory.at(-1)?.ranked?.map((item) => <li key={item.question}>{item.question}</li>)}</ol></details>}
            {!!questionHistory.length && <details className="group mt-5 border-t border-white/13"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 pt-4 [&::-webkit-details-marker]:hidden"><p className="eyebrow">Model output</p><span className="flex items-center gap-2 text-[11px] text-zinc-600">{mode === "multiple" ? "chunk history" : "single static analysis"}<ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" /></span></summary><div className="mt-3 space-y-3">{questionHistory.map((batch) => <div className="history-batch" key={batch.segmentId}><div><strong>{batch.timestamp}</strong><span>{batch.segmentId}</span></div>{batch.questions.length ? <ul>{batch.questions.map((question) => <li key={question.question}>{question.question}</li>)}</ul> : <p>No useful follow-up returned</p>}</div>)}</div></details>}
          </section>

          <section className="panel p-5">
            <div className="flex items-center gap-2"><FlaskConical className="size-4 text-primary" /><h2>Training comparison</h2></div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{trainingResults.interviews} unseen synthetic interviews · {trainingResults.families} held-out families</p>
            <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-zinc-400">Raw extraction F1</span><strong>{(trainingResults.baseExtractionF1 * 100).toFixed(1)}% → {(trainingResults.trainedExtractionF1 * 100).toFixed(1)}%</strong></div><div className="flex justify-between gap-3"><span className="text-zinc-400">Trained questions preferred</span><strong>{trainingResults.questionTrainedVotes}/{trainingResults.questionTotalVotes} ratings</strong></div></div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">Question ratings are subjective, blinded reviews by two teacher models. Use the model selector to compare outputs.</p>
            <p className="mt-2 text-xs leading-5 text-amber-300/80">{trainingResults.limitation}</p>
          </section>

          <section className="panel p-5">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h2>Quality check</h2></div><Badge variant="outline" className="border-primary/20 text-primary">Synthetic truth</Badge></div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{mode === "multiple" && !finished ? "Extraction quality is scored after the last chunk. Analysis runs when a candidate response is complete." : "Scores the live checklist using conservative text equivalence. Paraphrases may need human review; final results are separate."}</p>
            <div className="quality-grid mt-4">
              <QualityStat label="Extraction precision" value={mode === "multiple" && !finished ? null : quality.precision} />
              <QualityStat label="Extraction recall" value={mode === "multiple" && !finished ? null : quality.recall} />
              <QualityStat label="Quote provenance" value={quality.evidence} />
              <QualityStat label="Extraction acceptance" value={quality.extractionAcceptance} />
              <QualityStat label="Question acceptance" value={quality.questionContract} />
              <QualityStat label="Question formatting" value={quality.questionContract} />
            </div>
            {(mode === "single" || finished) && <div className="quality-detail mt-4">
              <span><strong>{quality.correct}</strong> correct</span><span><strong>{quality.wrong}</strong> wrong field/value</span><span><strong>{quality.unsupported}</strong> unsupported</span><span><strong>{quality.missed}</strong> missed</span><span><strong>{quality.placeholderCleanupCount}</strong> placeholder cleanup</span><span><strong>{quality.invalidExtractionCount}</strong> invalid extraction</span><span><strong>{quality.rejectedQuestionCount}</strong> rejected question</span>
            </div>}
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500"><span>Transcript received</span><strong className="font-mono text-zinc-300">{quality.intervalCoverage === null ? "—" : `${Math.round(quality.intervalCoverage * 100)}%`}</strong></div>
            {(mode === "single" || finished) && (quality.misses.length > 0 || quality.wrongValues.length > 0 || quality.unsupportedValues.length > 0) && <div className="quality-alert mt-3">{quality.misses.length > 0 && <p>Missed: {quality.misses.join(", ")}</p>}{quality.wrongValues.length > 0 && <p>Wrong field or value: {quality.wrongValues.join(", ")}</p>}{quality.unsupportedValues.length > 0 && <p>Unsupported by transcript: {quality.unsupportedValues.join(", ")}</p>}</div>}
          </section>

        </aside>
      </div>
    </main>
  );
}

function QualityStat({ label, value }: { label: string; value: number | null }) {
  return <div><span>{label}</span><strong className={value !== null && value < .8 ? "warn" : ""}>{value === null ? "—" : `${Math.round(value * 100)}%`}</strong></div>;
}
