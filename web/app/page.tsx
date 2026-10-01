"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { BarChart3, ChevronDown, Cpu, FlaskConical, Play, Plus, Radio, RotateCcw, Settings2, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { defaultFields } from "@/lib/default-fields";
import { staticCases } from "@/lib/static-cases";
import type { AnalysisResponse, ExtractionField, FieldResult, FollowUp, ModelProfile, PerformanceMetrics, RejectedExtraction, RejectedFollowUp, TranscriptSegment } from "@/lib/harness-types";

type RunState = "idle" | "running" | "complete" | "error";
type QuestionBatch = { segmentId: string; timestamp: string; questions: FollowUp[]; rawCount: number; rejected: RejectedFollowUp[] };
type ExtractionAudit = { rawCount: number; acceptedCount: number; rejected: RejectedExtraction[] };
const allScenarios = staticCases;
const fallbackModels: ModelProfile[] = [
  { id: "lfm2.5-1.2b-instruct", label: "LFM2.5 1.2B Instruct", description: "Smaller instruction model", available: true },
  { id: "lfm2.5-2.6b-no-think", label: "LFM2.5 2.6B · no thinking", description: "Larger checkpoint with reasoning disabled", available: true },
];

function timecode(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function normalized(value: string) { return value.toLowerCase().replace(/[^a-z0-9@.]+/g, " ").replace(/\s+/g, " ").trim().split(" ").filter((token) => token !== "and" && token !== "the").join(" "); }
function salaryAmounts(value: string) {
  const withoutPercentages = value
    .replace(/\b\d+(?:\.\d+)?\s*(?:to|[-–])\s*\d+(?:\.\d+)?\s*(?:%|percent\b)/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:%|percent\b)/gi, "");
  return [...withoutPercentages.matchAll(/\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|thousand)?\b/gi)]
    .map((match) => {
      const amount = Number(match[1].replaceAll(",", ""));
      return match[2] || (amount >= 50 && amount < 1000) ? amount * 1000 : amount;
    })
    .filter((amount) => Number.isFinite(amount))
    .sort((left, right) => left - right);
}

function relocationIntent(value: string) {
  if (/\b(?:cannot|can't|unable to|won't|would not|not willing to|not looking to|not open to)\s+relocat/i.test(value)) return "no";
  if (/\b(?:can|would|willing to|looking to|open to)\s+relocat|\brelocat(?:e|ing|ion)\s+to\b/i.test(value)) return "yes";
  return null;
}

function valuesMatch(fieldId: string, expected: string, actual: string) {
  if (fieldId === "current_salary" || fieldId === "target_salary") {
    const expectedAmounts = salaryAmounts(expected);
    const actualAmounts = salaryAmounts(actual);
    if (expectedAmounts.length && actualAmounts.length) {
      return expectedAmounts.length === actualAmounts.length && expectedAmounts.every((amount, index) => amount === actualAmounts[index]);
    }
  }
  if (fieldId === "relocation") {
    const expectedIntent = relocationIntent(expected);
    const actualIntent = relocationIntent(actual);
    if (expectedIntent && actualIntent) return expectedIntent === actualIntent;
  }
  const a = normalized(expected); const b = normalized(actual);
  return a === b || a.includes(b) || b.includes(a);
}

export default function Home() {
  const [scenarioId, setScenarioId] = useState(allScenarios[0].id);
  const [endpoint] = useState("http://127.0.0.1:8000");
  const [models, setModels] = useState<ModelProfile[]>(fallbackModels);
  const [modelId, setModelId] = useState("lfm2.5-2.6b-no-think");
  const [fields, setFields] = useState(defaultFields);
  const [draftFields, setDraftFields] = useState(defaultFields);
  const [newField, setNewField] = useState("");
  const [runState, setRunState] = useState<RunState>("idle");
  const [cursor, setCursor] = useState(0);
  const [visibleSegments, setVisibleSegments] = useState<TranscriptSegment[]>([]);
  const [snapshot, setSnapshot] = useState<FieldResult[]>(defaultFields.map((field) => ({ fieldId: field.id, status: "not_provided", value: null })));
  const [questions, setQuestions] = useState<FollowUp[]>([]);
  const [questionHistory, setQuestionHistory] = useState<QuestionBatch[]>([]);
  const [extractionAudits, setExtractionAudits] = useState<ExtractionAudit[]>([]);
  const [rawExtractionPayload, setRawExtractionPayload] = useState<Record<string, unknown> | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [lastChanges, setLastChanges] = useState<FieldResult[]>([]);
  const [error, setError] = useState("");
  const processing = useRef(false);

  const scenario = useMemo(() => allScenarios.find((item) => item.id === scenarioId) ?? allScenarios[0], [scenarioId]);
  const progress = scenario.segments.length ? (cursor / scenario.segments.length) * 100 : 0;
  const covered = snapshot.filter((field) => field.status === "provided").length;
  const latestTurns = (visibleSegments.length ? visibleSegments : scenario.segments).flatMap((segment) => segment.turns.map((turn) => ({ ...turn, segment })));

  const reset = useCallback(() => {
    setRunState("idle"); setCursor(0); setVisibleSegments([]); setQuestions([]); setQuestionHistory([]); setExtractionAudits([]); setRawExtractionPayload(null); setMetrics([]); setLastChanges([]); setError("");
    setSnapshot(fields.map((field) => ({ fieldId: field.id, status: "not_provided", value: null })));
  }, [fields]);

  const analyze = useCallback(async (nextSegments: TranscriptSegment[], previous: FieldResult[], previousQuestions: FollowUp[]): Promise<AnalysisResponse> => {
    const response = await fetch(`${endpoint}/v1/analyze`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: scenario.id, modelId, segments: nextSegments, fields, previousSnapshot: previous, previousQuestions }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({})) as { detail?: string };
      throw new Error(failure.detail ? `Liquid endpoint ${response.status}: ${failure.detail}` : `Liquid endpoint returned ${response.status}`);
    }
    return response.json();
  }, [endpoint, fields, modelId, scenario.id]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${endpoint}/v1/models`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Model catalog unavailable")))
      .then((catalog: { defaultModelId?: string; models?: ModelProfile[] }) => {
        if (catalog.models?.length) setModels(catalog.models);
        if (catalog.defaultModelId && catalog.models?.some((model) => model.id === catalog.defaultModelId)) setModelId(catalog.defaultModelId);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [endpoint]);

  const runStaticPreset = useCallback(async () => {
    if (processing.current) return;
    processing.current = true; setRunState("running"); setError("");
    const initialSnapshot: FieldResult[] = fields.map((field) => ({ fieldId: field.id, status: "not_provided", value: null }));
    const segment = scenario.segments.at(-1);
    setCursor(0); setVisibleSegments(scenario.segments); setSnapshot(initialSnapshot); setQuestions([]); setQuestionHistory([]); setExtractionAudits([]); setRawExtractionPayload(null); setMetrics([]); setLastChanges([]);
    try {
      const response = await analyze(scenario.segments, initialSnapshot, []);
      const batch = { segmentId: segment?.id ?? scenario.id, timestamp: timecode(segment?.endSeconds ?? 0), questions: response.followUpQuestions, rawCount: response.rawFollowUpQuestions?.length ?? response.followUpQuestions.length, rejected: response.rejectedFollowUpQuestions ?? [] };
      const audit = { rawCount: response.rawExtractionUpdates?.length ?? response.checklistChanges.length, acceptedCount: response.acceptedExtractionUpdates?.length ?? response.checklistChanges.length, rejected: response.rejectedExtractionUpdates ?? [] };
      setSnapshot(response.checklistSnapshot); setLastChanges(response.checklistChanges); setQuestions(response.followUpQuestions); setQuestionHistory([batch]); setExtractionAudits([audit]); setRawExtractionPayload(response.rawExtractionPayload ?? null); setMetrics([response.metrics]); setCursor(scenario.segments.length);
      setRunState("complete");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Static preset failed"); setRunState("error"); }
    finally { processing.current = false; }
  }, [analyze, fields, scenario]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({ name: "configure_extraction_fields", title: "Configure extraction fields", description: "Replace the extraction checklist used by future transcript inference calls.", inputSchema: { type: "object", properties: { fields: { type: "array", items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" }, description: { type: "string" } }, required: ["id", "label"], additionalProperties: false } } }, required: ["fields"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input: unknown) { const value = input as { fields?: ExtractionField[] }; if (!value.fields?.length) throw new Error("At least one field is required"); setFields(value.fields); setDraftFields(value.fields); return { fieldCount: value.fields.length }; } }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const latest = metrics.at(-1);
  const selectedModel = models.find((model) => model.id === modelId) ?? fallbackModels.find((model) => model.id === modelId) ?? fallbackModels[0];
  const totalQuestions = questionHistory.reduce((sum, batch) => sum + batch.questions.length, 0);
  const quality = useMemo(() => {
    const defaultIds = new Set(defaultFields.map((field) => field.id));
    const expected = new Map<string, string>();
    for (const event of scenario.expectations) if (event.fromSegment <= cursor) expected.set(event.fieldId, event.value);
    let correct = 0, wrong = 0, falsePositive = 0, missed = 0, trueNegative = 0;
    const misses: string[] = [], wrongValues: string[] = [], falsePositives: string[] = [];
    for (const field of fields.filter((item) => defaultIds.has(item.id))) {
      const wanted = expected.get(field.id);
      const result = snapshot.find((item) => item.fieldId === field.id);
      const actual = result?.status === "provided" && result.value ? result.value : null;
      if (wanted && actual && valuesMatch(field.id, wanted, actual)) correct += 1;
      else if (wanted && actual) { wrong += 1; wrongValues.push(field.label); }
      else if (wanted) { missed += 1; misses.push(field.label); }
      else if (actual) { falsePositive += 1; falsePositives.push(field.label); }
      else trueNegative += 1;
    }
    const provided = snapshot.filter((item) => item.status === "provided");
    const transcript = new Map(visibleSegments.map((segment) => [segment.id, normalized(segment.turns.map((turn) => turn.text).join(" "))]));
    const evidenced = provided.filter((item) => item.quote && item.segmentId);
    const evidenceValid = evidenced.filter((item) => item.quote && item.segmentId && transcript.get(item.segmentId)?.includes(normalized(item.quote))).length;
    const allQuestions = questionHistory.flatMap((batch) => batch.questions.map((question) => ({ ...question, segmentId: batch.segmentId })));
    const rawQuestionCount = questionHistory.reduce((sum, batch) => sum + batch.rawCount, 0);
    const rejectedQuestionCount = questionHistory.reduce((sum, batch) => sum + batch.rejected.length, 0);
    const rawExtractionCount = extractionAudits.reduce((sum, audit) => sum + audit.rawCount, 0);
    const acceptedExtractionCount = extractionAudits.reduce((sum, audit) => sum + audit.acceptedCount, 0);
    const rejectedExtractionCount = extractionAudits.reduce((sum, audit) => sum + audit.rejected.length, 0);
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
      precision: correct + wrong + falsePositive ? correct / (correct + wrong + falsePositive) : null,
      recall: correct + wrong + missed ? correct / (correct + wrong + missed) : null,
      evidence: evidenced.length ? evidenceValid / evidenced.length : null,
      extractionAcceptance: rawExtractionCount ? acceptedExtractionCount / rawExtractionCount : null,
      questionContract: rawQuestionCount ? validQuestions / rawQuestionCount : null,
      questionFit: evaluatedQuestionBatches.length ? matchingQuestionBatches / evaluatedQuestionBatches.length : null,
      intervalCoverage: cursor ? questionHistory.length / cursor : null,
      correct, wrong, falsePositive, missed, trueNegative, duplicates, rejectedQuestionCount, rejectedExtractionCount, misses, wrongValues, falsePositives,
    };
  }, [cursor, extractionAudits, fields, questionHistory, scenario.expectations, scenario.questionExpectations, snapshot, visibleSegments]);
  const latestRejected = questionHistory.at(-1)?.rejected ?? [];
  const latestRejectedExtraction = extractionAudits.at(-1)?.rejected ?? [];

  function addDraftField() {
    const label = newField.trim(); if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!id || draftFields.some((field) => field.id === id)) return;
    setDraftFields((current) => [...current, { id, label, description: `Extract ${label.toLowerCase()} only when explicitly supported by the transcript` }]); setNewField("");
  }

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
            <label className="form-label" htmlFor="scenario">Candidate interview</label>
            <select id="scenario" className="input-shell w-full" value={scenarioId} onChange={(event) => { reset(); setScenarioId(event.target.value); }} disabled={runState === "running"}>{staticCases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
            <label className="form-label" htmlFor="model">Model under test</label>
            <select id="model" className="input-shell w-full" value={modelId} onChange={(event) => { reset(); setModelId(event.target.value); }} disabled={runState === "running"}>{models.map((model) => <option key={model.id} value={model.id} disabled={!model.available}>{model.label}{model.available ? "" : " · unavailable"}</option>)}</select>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{selectedModel.description}{selectedModel.modelStorageMb ? ` · ${(selectedModel.modelStorageMb / 1024).toFixed(2)} GB on disk` : ""}</p>
            <div className="mt-3 grid grid-cols-2 gap-2"><div className="stat-tile"><span>Input</span><strong>Static transcript</strong></div><div className="stat-tile"><span>Profile</span><strong>{scenario.role}</strong></div></div>
            <div className="mt-4 grid gap-2">
              {runState !== "running" ? <Button onClick={() => void runStaticPreset()} disabled={runState === "complete"}><Play className="size-4 fill-current" />Analyze preset</Button> : <Button variant="secondary" disabled><FlaskConical className="size-4" />Analyzing</Button>}
              <Button variant="ghost" onClick={reset}><RotateCcw className="size-4" />Reset result</Button>
            </div>
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

          <section className="panel p-5">
            <div className="flex items-center justify-between"><p className="eyebrow">Extraction fields</p>
              <Dialog onOpenChange={(open) => { if (open) setDraftFields(fields); }}><DialogTrigger asChild><Button variant="ghost" size="sm" className="h-7 px-2 text-primary"><Settings2 className="size-3.5" /> Configure</Button></DialogTrigger>
                <DialogContent className="max-h-[84vh] border-white/13 bg-zinc-950 sm:max-w-2xl">
                  <DialogHeader><DialogTitle>Configure extraction fields</DialogTitle><DialogDescription>These definitions are inserted into the extraction prompt on the next inference call.</DialogDescription></DialogHeader>
                  <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-2">{draftFields.map((field) => <div key={field.id} className="flex items-start gap-3 rounded-md border border-white/8 bg-white/3 p-3"><div className="min-w-0 flex-1"><Input value={field.label} onChange={(event) => setDraftFields((current) => current.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item))} className="h-8 border-white/8 bg-black/15" /><Input value={field.description} onChange={(event) => setDraftFields((current) => current.map((item) => item.id === field.id ? { ...item, description: event.target.value } : item))} className="mt-2 h-8 border-white/8 bg-black/15 text-xs text-zinc-400" /></div><Button variant="ghost" size="icon" aria-label={`Remove ${field.label}`} className="size-8 text-zinc-500 hover:text-rose-300" onClick={() => setDraftFields((current) => current.filter((item) => item.id !== field.id))}><Trash2 className="size-4" /></Button></div>)}</div>
                  <div className="flex gap-2"><Input placeholder="Add a field, e.g. Travel preference" value={newField} onChange={(event) => setNewField(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addDraftField(); }} className="border-white/10 bg-black/15" /><Button variant="secondary" onClick={addDraftField}><Plus className="size-4" />Add</Button></div>
                  <DialogFooter><Button variant="outline" className="border-white/10" onClick={() => setDraftFields(defaultFields)}>Restore defaults</Button><Button onClick={() => { setFields(draftFields); setSnapshot(draftFields.map((field) => snapshot.find((item) => item.fieldId === field.id) ?? { fieldId: field.id, status: "not_provided", value: null })); }}>Apply fields</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">{fields.slice(0, 8).map((field) => <span key={field.id} className="field-chip">{field.label}</span>)}{fields.length > 8 && <span className="field-chip more">+ {fields.length - 8} more</span>}</div>
          </section>

        </aside>

        <section className="min-w-0 space-y-5">
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/13 px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary"><Radio className="size-4" /></span><div><h2>Preset transcript</h2><p className="text-xs text-zinc-500">{runState === "idle" ? "Ready to analyze" : runState === "complete" ? "Analysis complete" : "Running extraction and follow-up inference"}</p></div></div><Badge variant="secondary" className="bg-white/5 text-zinc-400">Static input</Badge></div>
            <Progress value={progress} className="h-1 rounded-none bg-white/5 [&>div]:bg-primary" />
            <div className="min-h-[340px] max-h-[470px] overflow-y-auto p-5" aria-live="polite">
              {latestTurns.map((turn, index) => <div className={`transcript-row ${turn.speaker === "Candidate" ? "candidate" : ""}`} key={`${turn.segment.id}-${index}`}><span>{turn.speaker}</span><p>{turn.text}</p><time>Preset</time></div>)}
            </div>
          </div>

          {error && <div className="rounded-md border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">{error}. Check the local LFM endpoint and model server.</div>}

          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/13 p-5"><div className="flex items-center gap-2"><Cpu className="size-4 text-primary" /><h2>Extraction results</h2></div><span className="text-xs text-zinc-400">{covered} / {fields.length} covered</span></div>
            <Progress value={fields.length ? covered / fields.length * 100 : 0} className="h-1 rounded-none bg-white/8 [&>div]:bg-primary" />
            <div className="max-h-[520px] overflow-auto"><table className="extraction-table"><thead><tr><th>Field</th><th>Extracted value</th><th>Status</th></tr></thead><tbody>{snapshot.map((result) => { const field = fields.find((item) => item.id === result.fieldId); const changed = lastChanges.some((item) => item.fieldId === result.fieldId); return <tr key={result.fieldId}><td>{field?.label ?? result.fieldId}</td><td><strong className={result.status === "provided" ? "text-zinc-100" : "text-zinc-600"}>{result.value ?? "Not provided"}</strong>{result.quote && <blockquote>“{result.quote}”</blockquote>}</td><td>{changed ? <Badge className="bg-primary/10 text-primary">extracted</Badge> : <span className={result.status === "provided" ? "text-primary" : "text-zinc-600"}>{result.status === "provided" ? "provided" : "not found"}</span>}</td></tr>; })}</tbody></table></div>
            {!!latestRejectedExtraction.length && <div className="quality-alert mx-5 mb-5"><p>{latestRejectedExtraction.length} model extraction{latestRejectedExtraction.length === 1 ? " was" : "s were"} rejected:</p>{latestRejectedExtraction.map((item, index) => <p key={`${item.update.fieldId ?? "unknown"}-${index}`}>{item.update.fieldId ?? "Unknown field"}: {item.rejectionReason}</p>)}</div>}
          </section>

          {rawExtractionPayload && <details className="group panel overflow-hidden"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden"><div className="flex items-center gap-2"><Cpu className="size-4 text-primary" /><p className="eyebrow">Raw extraction output</p></div><ChevronDown className="size-4 text-zinc-500 transition-transform duration-200 group-open:rotate-180" /></summary><pre className="max-h-96 overflow-auto border-t border-white/13 p-5 text-[11px] leading-5 text-zinc-300">{JSON.stringify(rawExtractionPayload, null, 2)}</pre></details>}
        </section>

        <aside className="flex flex-col gap-5">
          <section className="panel p-5">
            <div><div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /><h2>Suggested follow-ups</h2></div><span className="mt-1 block pl-6 text-xs text-zinc-500">{questions.length} accepted · {totalQuestions} total</span></div>
            <ol className="mt-4 max-h-[390px] space-y-3 overflow-y-auto pr-1">{questions.map((question, index) => <li className="question-card" key={question.question}><span>{index + 1}</span><div><p>{question.question}</p>{question.reason && <small>{question.reason}</small>}{question.triggerQuote && <blockquote>“{question.triggerQuote}”</blockquote>}{question.category && <em>{question.category.replaceAll("_", " ")}</em>}</div></li>)}{!questions.length && <li className="empty-compact">{runState === "complete" ? "No accepted follow-up was returned for this preset." : "Suggestions appear after analyzing the preset."}</li>}</ol>
            {!!latestRejected.length && <div className="quality-alert mt-3"><p>{latestRejected.length} model suggestion{latestRejected.length === 1 ? " was" : "s were"} rejected:</p>{latestRejected.map((item, index) => <p key={`${item.question.question}-${index}`}>{item.rejectionReason}</p>)}</div>}
            {!!questionHistory.length && <details className="group mt-5 border-t border-white/13"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 pt-4 [&::-webkit-details-marker]:hidden"><p className="eyebrow">Model output</p><span className="flex items-center gap-2 text-[11px] text-zinc-600">single static analysis<ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" /></span></summary><div className="mt-3 space-y-3">{questionHistory.map((batch) => <div className="history-batch" key={batch.segmentId}><div><strong>Preset</strong><span>{batch.segmentId}</span></div>{batch.questions.length ? <ul>{batch.questions.map((question) => <li key={question.question}>{question.question}</li>)}</ul> : <p>No useful follow-up returned</p>}</div>)}</div></details>}
          </section>

          <section className="panel p-5">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h2>Quality check</h2></div><Badge variant="outline" className="border-primary/20 text-primary">Synthetic truth</Badge></div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">Checks the model result against the selected preset&apos;s extraction and follow-up expectations.</p>
            <div className="quality-grid mt-4">
              <QualityStat label="Extraction precision" value={quality.precision} />
              <QualityStat label="Extraction recall" value={quality.recall} />
              <QualityStat label="Evidence grounded" value={quality.evidence} />
              <QualityStat label="Extraction acceptance" value={quality.extractionAcceptance} />
              <QualityStat label="Question acceptance" value={quality.questionContract} />
              <QualityStat label="Question expectation" value={quality.questionFit} />
            </div>
            <div className="quality-detail mt-4">
              <span><strong>{quality.correct}</strong> correct</span><span><strong>{quality.wrong}</strong> wrong</span><span><strong>{quality.falsePositive}</strong> false positive</span><span><strong>{quality.missed}</strong> missed</span><span><strong>{quality.rejectedExtractionCount}</strong> rejected extraction</span><span><strong>{quality.rejectedQuestionCount}</strong> rejected question</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500"><span>Preset result recorded</span><strong className="font-mono text-zinc-300">{quality.intervalCoverage === null ? "—" : `${Math.round(quality.intervalCoverage * 100)}%`}</strong></div>
            {(quality.misses.length > 0 || quality.wrongValues.length > 0 || quality.falsePositives.length > 0) && <div className="quality-alert mt-3">{quality.misses.length > 0 && <p>Missed: {quality.misses.join(", ")}</p>}{quality.wrongValues.length > 0 && <p>Wrong value: {quality.wrongValues.join(", ")}</p>}{quality.falsePositives.length > 0 && <p>Unexpected: {quality.falsePositives.join(", ")}</p>}</div>}
          </section>

        </aside>
      </div>
    </main>
  );
}

function QualityStat({ label, value }: { label: string; value: number | null }) {
  return <div><span>{label}</span><strong className={value !== null && value < .8 ? "warn" : ""}>{value === null ? "—" : `${Math.round(value * 100)}%`}</strong></div>;
}
