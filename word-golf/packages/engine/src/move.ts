import { WORD_LENGTH, type MoveResult, type WordGraph } from "./types.js";

/** Number of positions at which two equal-length words differ. */
export function letterDiff(a: string, b: string): number {
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff;
}

/**
 * Validate a move from `from` to `next`.
 *
 * A legal move changes exactly one letter and produces a valid word. Anything
 * else is rejected with a reason; the caller keeps the board on the last good
 * word (the rollback metaphor). Input is normalized (trim + lowercase) first.
 */
export function validateMove(
  from: string,
  next: string,
  graph: WordGraph
): MoveResult {
  const candidate = next.trim().toLowerCase();
  if (candidate.length !== WORD_LENGTH) {
    return { ok: false, reason: "wrong-length" };
  }
  const diff = letterDiff(from, candidate);
  if (diff === 0) return { ok: false, reason: "no-change" };
  if (diff > 1) return { ok: false, reason: "too-many-changes" };
  if (!graph.valid.has(candidate)) return { ok: false, reason: "not-a-word" };
  return { ok: true, word: candidate };
}
