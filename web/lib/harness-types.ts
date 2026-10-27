export type Speaker = "Interviewer" | "Candidate";

export type TranscriptTurn = {
  turnId?: number;
  responseComplete?: boolean;
  speaker: Speaker;
  text: string;
};

export type TranscriptSegment = {
  id: string;
  date: string;
  timestamp: string;
  startSeconds: number;
  endSeconds: number;
  turns: TranscriptTurn[];
};

export type Scenario = {
  id: string;
  title: string;
  role: string;
  segments: TranscriptSegment[];
  expectations: GroundTruthEvent[];
  questionExpectations?: QuestionExpectation[];
};

export type GroundTruthEvent = {
  fieldId: string;
  fromSegment: number;
  value: string;
};

export type QuestionExpectation = {
  segment: number;
  minQuestions: number;
  maxQuestions: number;
  categories?: FollowUp["category"][];
};

export type ExtractionField = {
  id: string;
  label: string;
  description: string;
};

export type FieldStatus = "not_provided" | "provided" | "ambiguous" | "conflicting" | "retracted";

export type FieldResult = {
  fieldId: string;
  status: FieldStatus;
  value: string | null;
  evidence?: { turnId: number; quote: string; chunkIds: string[]; timestamp: string | null }[];
  quote?: string;
  segmentId?: string;
  timestamp?: string;
};

export type ExtractionCandidate = {
  fieldId?: string;
  status?: string;
  value?: string | null;
  quote?: string | null;
  segmentId?: string | null;
};

export type RejectedExtraction = {
  update: ExtractionCandidate;
  rejectionReason: string;
};

export type FollowUp = {
  question: string;
  reason?: string;
  triggerQuote?: string;
  category?: "clarify_vague_claim" | "quantify_impact" | "surface_gap";
};

export type RejectedFollowUp = {
  question: FollowUp;
  rejectionReason: string;
};

export type PerformanceMetrics = {
  totalMs: number;
  ttftMs: number;
  decodeTokensPerSecond: number;
  inputTokens: number;
  outputTokens: number;
  processRamMb: number;
  gpuMemoryMb: number | null;
  extractionMs?: number;
  questionMs?: number;
  modelStorageMb?: number;
  modelId?: string;
  modelLabel?: string;
};

export type ModelProfile = {
  id: string;
  label: string;
  description: string;
  modelStorageMb?: number;
  available: boolean;
};

export type AnalysisResponse = {
  analysisPerformed: true;
  completedResponseCount: number;
  checklistSnapshot: FieldResult[];
  checklistChanges: FieldResult[];
  rawExtractionPayload?: Record<string, unknown>;
  rawExtractionUpdates?: ExtractionCandidate[];
  acceptedExtractionUpdates?: FieldResult[];
  rejectedExtractionUpdates?: RejectedExtraction[];
  followUpQuestions: FollowUp[];
  rankedFollowUpQuestions?: FollowUp[];
  rawFollowUpQuestions?: FollowUp[];
  rejectedFollowUpQuestions?: RejectedFollowUp[];
  metrics: PerformanceMetrics;
};

export type BufferedResponse = {
  analysisPerformed: false;
  completedResponseCount: number;
};

export type FinalizationResponse = {
  liveSnapshot: FieldResult[];
  finalSnapshot: (FieldResult & { evidence: { turnId: number; quote: string; chunkIds: string[]; timestamp: string }[] })[];
  changes: { fieldId: string; before: string | null; after: string | null }[];
  missingFieldIds: string[];
  rejectedExtractions: { fieldId: string; value: string; reason: string }[];
  summary: { summary: string; keyPoints: string[]; unresolvedQuestions: string[] };
  rawExtractionPayload: Record<string, unknown>;
  rawSummaryPayload: Record<string, unknown>;
  metrics: { totalMs: number; extractionMs: number; summaryMs: number; modelLabel: string };
};
