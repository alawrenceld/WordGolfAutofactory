import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildDailyPools,
  buildWordGraph,
  parseWordList,
  makeDailyPuzzle,
  neighbors,
  validateMove,
  scoreLabel,
  utcDateString,
} from "../packages/engine/src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "data");
const load = (f: string) => parseWordList(readFileSync(join(dataDir, f), "utf8"));

const graph = buildWordGraph(load("combined_wordlist.txt"));
// Same pools the web app uses, so the quoted puzzle matches the screen.
const { startPool, targetPool } = buildDailyPools(
  load("shuffled_real_wordles.txt"),
  load("common_words.txt")
);
const today = utcDateString();
const puzzle = makeDailyPuzzle({
  dateUtc: today,
  startPool,
  graph,
  steps: 6,
  targetPool,
});

// BFS that returns an actual shortest path (to simulate a human solving it).
function shortestPath(start: string, target: string): string[] | null {
  if (start === target) return [start];
  const prev = new Map<string, string>();
  const visited = new Set([start]);
  let frontier = [start];
  while (frontier.length) {
    const next: string[] = [];
    for (const w of frontier) {
      for (const n of neighbors(w, graph)) {
        if (visited.has(n)) continue;
        visited.add(n);
        prev.set(n, w);
        if (n === target) {
          const path = [n];
          let cur = n;
          while (cur !== start) {
            cur = prev.get(cur)!;
            path.unshift(cur);
          }
          return path;
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

const path = shortestPath(puzzle.start, puzzle.target);
if (!path) throw new Error("Daily puzzle is unsolvable — generator bug.");

// Walk the solution applying each move through validateMove, as a player would.
let current = puzzle.start;
for (let i = 1; i < path.length; i++) {
  const result = validateMove(current, path[i], graph);
  if (!result.ok) {
    throw new Error(`Move ${current} -> ${path[i]} rejected: ${result.reason}`);
  }
  current = result.word;
}
if (current !== puzzle.target) throw new Error("Did not reach target.");

const moves = path.length - 1;
console.log(`Daily ${today}: ${puzzle.start} -> ${puzzle.target}`);
console.log(`Path: ${path.join(" -> ")}`);
console.log(`Solved in ${moves} (par ${puzzle.par}) -> ${scoreLabel(moves, puzzle.par ?? moves)}`);
console.log("PLAYTHROUGH OK");
