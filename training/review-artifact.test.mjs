import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { protectReview, reviewHash, saveReviewState } from "./review-artifact.mjs";

test("rebuilding cannot erase user edits and stale reconciliation hashes fail", () => {
  const root = mkdtempSync(join(tmpdir(), "interview-review-"));
  try {
    const review = join(root, "review.md"), state = join(root, "state.json");
    writeFileSync(review, "User correction");
    assert.throws(() => protectReview(review, state), /manual edits/);
    protectReview(review, state, reviewHash("User correction"));
    writeFileSync(review, "Reconciled review"); saveReviewState(state, "Reconciled review");
    protectReview(review, state);
    writeFileSync(review, "Another user correction");
    assert.throws(() => protectReview(review, state), /manual edits/);
    assert.throws(() => protectReview(review, state, reviewHash("User correction")), /stale/);
    assert.equal(readFileSync(review, "utf8"), "Another user correction");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
