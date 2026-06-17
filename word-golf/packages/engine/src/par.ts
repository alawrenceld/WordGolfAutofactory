import { WORD_LENGTH, type WordGraph } from "./types.js";

/**
 * Shortest number of single-letter-change moves from `start` to `target`.
 *
 * Breadth-first search over the wildcard-bucket graph. Returns the move count
 * (path length in edges), 0 when start === target, or null when unreachable.
 * BFS expands neighbors inline via the bucket index rather than materializing a
 * neighbor list per node, which keeps the hot loop allocation-light.
 */
export function bfsPar(
  start: string,
  target: string,
  graph: WordGraph
): number | null {
  if (start === target) return 0;
  if (!graph.valid.has(start) || !graph.valid.has(target)) return null;

  const visited = new Set<string>([start]);
  let frontier: string[] = [start];
  let distance = 0;

  while (frontier.length > 0) {
    distance++;
    const next: string[] = [];
    for (const word of frontier) {
      for (let i = 0; i < WORD_LENGTH; i++) {
        const pattern = word.slice(0, i) + "_" + word.slice(i + 1);
        const bucket = graph.buckets.get(pattern);
        if (!bucket) continue;
        for (const w of bucket) {
          if (w === target) return distance;
          if (!visited.has(w)) {
            visited.add(w);
            next.push(w);
          }
        }
      }
    }
    frontier = next;
  }
  return null;
}
