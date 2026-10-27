import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
export const reviewHash = (text) => createHash("sha256").update(text).digest("hex");

/** Refuse to erase manually edited review text before any generated artifact is written. */
export function protectReview(reviewPath, statePath, reconciledInputHash) {
  if (!existsSync(reviewPath)) return;
  const currentHash = reviewHash(readFileSync(reviewPath, "utf8"));
  if (reconciledInputHash) {
    if (reconciledInputHash !== currentHash) throw new Error("Reviewed input hash is stale; review changed during reconciliation");
    return;
  }
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : null;
  if (state?.generated_review_sha256 !== currentHash) throw new Error(`Review contains manual edits. Reconcile them into the source labels before rebuilding; input SHA256: ${currentHash}`);
}
export function saveReviewState(statePath, reviewText) {
  writeFileSync(statePath, JSON.stringify({ generated_review_sha256: reviewHash(reviewText), note: "Manual edits block regeneration until reconciled into source labels." }, null, 2) + "\n");
}
