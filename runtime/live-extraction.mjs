import { normalizeSalary } from "./salary-normalization.mjs";
import { completedResponses } from "./transcript-json.mjs";

export function liveExtractionSchema(fields) {
  return {
    type: "object", additionalProperties: false, required: fields.map(({ id }) => id),
    properties: Object.fromEntries(fields.map(({ id }) => [id, {
      type: "object", additionalProperties: false, required: ["operation", "value", "evidence"],
      properties: {
        operation: { type: "string", enum: ["set", "clear", "unchanged"] },
        value: { type: ["string", "null"] },
        evidence: { type: "array", items: {
          type: "object", additionalProperties: false, required: ["turn_id", "quote"],
          properties: { turn_id: { type: "integer" }, quote: { type: "string" } },
        } },
      },
    }])),
  };
}

const normalize = (value) => value.trim().replace(/\s+/g, " ");

/** Apply explicit model decisions. Invalid updates preserve state and remain visible in the audit. */
export function validateExtraction(payload, input) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Extraction must be a JSON object");
  const configured = new Set(input.fields.map(({ id }) => id));
  const previous = new Map((input.previousSnapshot || []).map((item) => [item.fieldId, item]));
  const responses = new Map(completedResponses(input.segments || []).map((item) => [item.turn_id, item]));
  const accepted = [], rejected = [], raw = [];
  for (const fieldId of new Set([...configured, ...Object.keys(payload)])) {
    const decision = payload[fieldId];
    const item = { fieldId, operation: decision?.operation, value: decision?.value ?? null };
    raw.push(item);
    let reason = "";
    if (!configured.has(fieldId)) reason = "Field ID is not in the frozen checklist";
    else if (!decision || typeof decision !== "object" || Array.isArray(decision)
      || Object.keys(decision).some((key) => !["operation", "value", "evidence"].includes(key))
      || !["set", "clear", "unchanged"].includes(decision.operation)
      || !Array.isArray(decision.evidence)) reason = "Invalid extraction operation";
    else if (decision.operation === "set" ? typeof decision.value !== "string" || !decision.value.trim() : decision.value !== null) reason = "Value does not match extraction operation";
    else if (decision.evidence.some((evidence) => !Number.isInteger(evidence?.turn_id) || typeof evidence.quote !== "string" || !evidence.quote.trim()
      || Object.keys(evidence).some((key) => !["turn_id", "quote"].includes(key))
      || !responses.get(evidence.turn_id)?.candidate || !normalize(responses.get(evidence.turn_id).candidate).includes(normalize(evidence.quote)))) reason = "No matching complete candidate evidence";
    else if (decision.operation === "set" && !decision.evidence.length) reason = "Set requires candidate evidence";
    else if (decision.operation === "unchanged" && decision.evidence.length) reason = "Unchanged requires empty evidence";
    else if (decision.operation === "set" && /^(?:null|unknown|n\/?a|none|not (?:explicitly )?(?:stated|provided|mentioned|specified))\.?$/i.test(decision.value.trim())) reason = "Placeholder is not a field value";
    if (reason) { rejected.push({ update: item, rejectionReason: reason }); continue; }
    if (decision.operation === "unchanged") continue;
    const evidence = decision.evidence.map(({ turn_id, quote }) => {
      const response = responses.get(turn_id);
      return { turnId: turn_id, quote, chunkIds: response.source_chunk_ids, timestamp: response.completed_at };
    });
    accepted.push({
      fieldId, status: decision.operation === "set" ? "provided" : "not_provided",
      value: decision.operation === "set" ? normalizeSalary(fieldId, decision.value.trim(), decision.evidence, responses) : null,
      evidence,
    });
  }
  const updates = new Map(accepted.map((item) => [item.fieldId, item]));
  return {
    checklistSnapshot: input.fields.map(({ id }) => updates.get(id) || previous.get(id) || { fieldId: id, status: "not_provided", value: null }),
    checklistChanges: accepted.filter((item) => (previous.get(item.fieldId)?.value ?? null) !== item.value),
    rawExtractionPayload: payload, rawExtractionUpdates: raw, acceptedExtractionUpdates: accepted, rejectedExtractionUpdates: rejected,
  };
}
