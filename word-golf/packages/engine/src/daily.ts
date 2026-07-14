import { bfsPar } from "./par.js";
import { neighbors } from "./graph.js";
import { seededRng, pick } from "./rng.js";
import type { PracticeDifficulty, PracticePoolOptions } from "./pools.js";
import type { Puzzle, WordGraph } from "./types.js";

/**
 * Breadth-first search for the nearest word in `pool` reachable from `start`
 * (excluding `start` itself). Used as a guaranteed fallback so a constrained
 * target pool always yields a reachable, in-pool target. Returns null if no
 * pool word is reachable.
 */
function nearestInPool(
  start: string,
  pool: Set<string>,
  graph: WordGraph
): string | null {
  const visited = new Set([start]);
  let frontier = [start];
  while (frontier.length) {
    const next: string[] = [];
    for (const word of frontier) {
      for (const n of neighbors(word, graph)) {
        if (visited.has(n)) continue;
        if (pool.has(n)) return n;
        visited.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

/** UTC date as `YYYY-MM-DD`, used as the daily seed so everyone shares a puzzle. */
export function utcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export interface DailyOptions {
  /** Seed string, typically a UTC date (see `utcDateString`). */
  dateUtc: string;
  /** Pool to draw the start word from (e.g. the answers list). */
  startPool: string[];
  /** The validity graph; the walk traverses its edges. */
  graph: WordGraph;
  /** Target walk length. The walk may stop short if it hits a dead end. */
  steps: number;
  /**
   * If provided, the target must be one of these words. The walk keeps going
   * (past `steps`, up to an internal cap) until it lands on a pool word, so the
   * shown target is always familiar (e.g. a common word) rather than an obscure
   * graph node. Intermediate words are unconstrained.
   */
  targetPool?: string[];
  /**
   * Preferred minimum par. Random walks often loop back near the start, so we
   * re-roll to find a target at least this many moves away. Best-effort: if no
   * attempt reaches it, the hardest puzzle found is used. Defaults to 3.
   */
  minPar?: number;
}

/**
 * Generate a deterministic daily puzzle.
 *
 * Seed an RNG from the date, pick a start word from the pool, then random-walk
 * `steps` valid neighbors (never immediately backtracking) to reach the target.
 * Because the target is produced *by walking the graph*, a solvable path always
 * exists. Par is then computed independently by BFS and may be shorter than the
 * walk length.
 *
 * When `targetPool` is given, the walk continues until it reaches a word in
 * that pool (capped), so the target is always a recognizable word.
 */
export function makeDailyPuzzle(options: DailyOptions): Puzzle {
  const { dateUtc, startPool, graph, steps, targetPool } = options;
  const minPar = options.minPar ?? 3;
  const rng = seededRng(dateUtc);

  if (!Array.isArray(startPool) || startPool.length === 0) {
    throw new Error("makeDailyPuzzle requires a non-empty startPool array.");
  }

  // Only start from pool words that exist in the graph and have neighbors.
  const candidates = startPool.filter(
    (w) => graph.valid.has(w) && neighbors(w, graph).length > 0
  );
  if (candidates.length === 0) {
    throw new Error("No valid start words with neighbors in the pool.");
  }

  const allowedTarget = targetPool ? new Set(targetPool) : null;

  // Some starts sit in tiny islands with no acceptable target reachable
  // (e.g. "image" only links to "imago"), and random walks often loop back
  // close to the start. Re-roll a few times so a bad start never forces an
  // off-pool or trivial target. Deterministic: each attempt advances the
  // shared RNG stream. We keep the hardest valid puzzle as a best-effort
  // fallback if none reaches `minPar`.
  const ATTEMPTS = 40;
  let best: Puzzle | null = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const start = pick(rng, candidates);
    const target = walkToTarget(start, rng, graph, steps, allowedTarget);
    if (!target || target === start) continue;
    if (allowedTarget && !allowedTarget.has(target)) continue;
    const par = bfsPar(start, target, graph);
    if (par === null) continue;
    const puzzle: Puzzle = { start, target, par };
    if (par >= minPar) return puzzle;
    if (best === null || par > (best.par ?? 0)) best = puzzle;
  }

  if (best) return best;
  // Extremely unlikely: no candidate produced a target. Use a direct neighbor.
  const start = candidates[0];
  const target = neighbors(start, graph)[0];
  return { start, target, par: bfsPar(start, target, graph) };
}

/**
 * Generate a one-off *practice* puzzle from a random (non-date) seed.
 *
 * Same generator and guarantees as {@link makeDailyPuzzle} — a solvable path
 * always exists and par is finite — but seeded from an unpredictable string so
 * each call yields a fresh puzzle. Pass an explicit `seed` for reproducibility
 * (e.g. in tests); otherwise a random one is used.
 */
export function makeRandomPuzzle(
  options: Omit<DailyOptions, "dateUtc"> & { seed?: string }
): Puzzle {
  const { seed, ...rest } = options;
  const resolved =
    seed ??
    `practice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return makeDailyPuzzle({ ...rest, dateUtc: resolved });
}

/**
 * Practice puzzle respecting Easy/Medium/Hard pool settings. Hard mode uses a
 * target-first search so obscure targets are actually reachable.
 */
export function makePracticePuzzle(
  options: PracticePoolOptions & {
    difficulty: PracticeDifficulty;
    graph: WordGraph;
    steps?: number;
    seed?: string;
  }
): Puzzle {
  const {
    difficulty,
    graph,
    steps = 6,
    seed,
    hardTargetPool,
    startPool,
    targetPool,
    minPar,
  } = options;
  const resolved =
    seed ??
    `practice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  if (difficulty === "hard" && hardTargetPool?.length) {
    const hard = makeHardPracticePuzzle({
      seed: resolved,
      graph,
      startPool,
      difficultPool: hardTargetPool,
      minPar,
    });
    if (hard) return hard;
  }

  return makeRandomPuzzle({
    seed: resolved,
    startPool,
    graph,
    steps,
    targetPool,
    minPar,
  });
}

/** Pick a difficult target, then a start at least `minPar` moves away. */
function makeHardPracticePuzzle(options: {
  seed: string;
  graph: WordGraph;
  startPool: string[];
  difficultPool: string[];
  minPar: number;
}): Puzzle | null {
  const { seed, graph, startPool, difficultPool, minPar } = options;
  const rng = seededRng(seed);
  const allowedStarts = new Set(startPool.filter((w) => graph.valid.has(w)));
  const targets = difficultPool.filter(
    (w) => graph.valid.has(w) && neighbors(w, graph).length > 0
  );
  if (!targets.length || !allowedStarts.size) return null;

  const ATTEMPTS = 50;
  let best: Puzzle | null = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const target = pick(rng, targets);
    const starts = startsAtMinPar(target, graph, minPar, allowedStarts);
    if (!starts.length) continue;
    const start = pick(rng, starts);
    const par = bfsPar(start, target, graph);
    if (par === null) continue;
    const puzzle: Puzzle = { start, target, par };
    if (par >= minPar) return puzzle;
    if (best === null || par > (best.par ?? 0)) best = puzzle;
  }
  return best;
}

function startsAtMinPar(
  target: string,
  graph: WordGraph,
  minPar: number,
  allowedStarts: Set<string>,
  maxDepth = minPar + 16
): string[] {
  const visited = new Set([target]);
  let frontier = [target];
  let distance = 0;
  const hits: string[] = [];
  while (frontier.length && distance < maxDepth) {
    distance++;
    const next: string[] = [];
    for (const word of frontier) {
      for (const n of neighbors(word, graph)) {
        if (visited.has(n)) continue;
        visited.add(n);
        if (distance >= minPar && allowedStarts.has(n)) hits.push(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return hits;
}

/**
 * Random-walk from `start` to a target. With `allowedTarget`, the walk keeps
 * going (capped) until it lands on a pool word; if it never does, it BFS-falls
 * back to the nearest pool word. Returns null only when the start is trapped
 * with no acceptable target reachable.
 */
function walkToTarget(
  start: string,
  rng: () => number,
  graph: WordGraph,
  steps: number,
  allowedTarget: Set<string> | null
): string | null {
  const inPool = (w: string) =>
    w !== start && (allowedTarget === null || allowedTarget.has(w));

  const maxSteps = Math.max(steps * 4, steps + 12);
  let current = start;
  let previous: string | null = null;
  let lastValidTarget: string | null = null;
  for (let i = 0; i < maxSteps; i++) {
    const moves = neighbors(current, graph).filter((w) => w !== previous);
    if (moves.length === 0) break;
    const nextWord = pick(rng, moves);
    previous = current;
    current = nextWord;
    if (inPool(current)) lastValidTarget = current;
    if (i + 1 >= steps && lastValidTarget) break;
  }

  if (lastValidTarget) return lastValidTarget;
  if (allowedTarget) return nearestInPool(start, allowedTarget, graph);
  return current !== start ? current : neighbors(start, graph)[0] ?? null;
}
