export const WORD_LENGTH = 5;

/** Wildcard-bucket adjacency index over the validity word set. */
export interface WordGraph {
  /** Every valid word (graph node). */
  words: string[];
  /** Fast membership test for validity / `isValidWord`. */
  valid: Set<string>;
  /** pattern (e.g. "_atch") -> words sharing it. Powers O(1)-ish neighbor lookup. */
  buckets: Map<string, string[]>;
}

export interface Puzzle {
  /** The starting word. */
  start: string;
  /** The target word to reach. */
  target: string;
  /** Shortest number of moves from start to target (BFS), or null if unreachable. */
  par: number | null;
}

export type MoveRejection =
  | "wrong-length"
  | "not-a-word"
  | "no-change"
  | "too-many-changes";

export type MoveResult =
  | { ok: true; word: string }
  | { ok: false; reason: MoveRejection };
