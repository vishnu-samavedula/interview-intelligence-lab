/** Preserve exchange IDs across chunk boundaries; a chunk may contain a partial exchange. */
export function transcriptChunks(segments) {
  return segments.map((segment) => {
    const turns = [];
    for (const utterance of segment.turns) {
      let turn = turns.at(-1);
      if (!turn || (utterance.turnId !== undefined ? turn.turn_id !== utterance.turnId : utterance.speaker === "Interviewer")) {
        turn = { turn_id: utterance.turnId ?? turns.length + 1 };
        turns.push(turn);
      }
      const speaker = utterance.speaker === "Interviewer" ? "interviewer" : "candidate";
      turn[speaker] = turn[speaker] ? `${turn[speaker]} ${utterance.text}` : utterance.text;
      if (speaker === "candidate") turn.response_complete = utterance.responseComplete ?? true;
    }
    return {
      chunk_id: segment.id,
      date: segment.date,
      timestamp: segment.timestamp,
      start_seconds: segment.startSeconds,
      end_seconds: segment.endSeconds,
      turns,
    };
  });
}

export function serializeSegments(segments) {
  return JSON.stringify({ chunks: transcriptChunks(segments) }, null, 2);
}

/** Reassemble received fragments, withholding every unfinished candidate response. */
export function transcriptResponses(segments) {
  const exchanges = new Map();
  let fallbackId = 0;
  for (const segment of segments) {
    for (const utterance of segment.turns) {
      if (utterance.turnId === undefined && (utterance.speaker === "Interviewer" || !fallbackId)) fallbackId++;
      const id = utterance.turnId ?? fallbackId;
      if (!exchanges.has(id)) exchanges.set(id, {
        turn_id: id, interviewer: "", candidate: "", response_complete: false,
        first_received_at: `${segment.date}T${segment.timestamp}`, completed_at: null,
        source_chunk_ids: [],
      });
      const exchange = exchanges.get(id);
      const speaker = utterance.speaker === "Interviewer" ? "interviewer" : "candidate";
      exchange[speaker] = [exchange[speaker], utterance.text].filter(Boolean).join(" ");
      if (!exchange.source_chunk_ids.includes(segment.id)) exchange.source_chunk_ids.push(segment.id);
      if (speaker === "candidate") {
        exchange.response_complete = utterance.responseComplete ?? true;
        exchange.completed_at = exchange.response_complete ? `${segment.date}T${segment.timestamp}` : null;
      }
    }
  }
  return [...exchanges.values()];
}

export function completedResponses(segments) {
  return transcriptResponses(segments).filter((exchange) => exchange.response_complete);
}
