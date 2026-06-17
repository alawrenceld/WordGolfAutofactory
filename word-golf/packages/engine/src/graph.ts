import { WORD_LENGTH, type WordGraph } from "./types.js";

/**
 * Build the wildcard-bucket adjacency index.
 *
 * For each word we generate its `WORD_LENGTH` one-position-wildcard patterns
 * (e.g. "match" -> "_atch", "m_tch", "ma_ch", "mat_h", "matc_") and group words
 * by pattern. Two words are neighbors iff they share a pattern, i.e. they differ
 * in exactly one position. This gives O(1)-ish neighbor lookup instead of an
 * O(n) scan, which keeps BFS fast even at ~13k nodes.
 */
export function buildWordGraph(words: string[]): WordGraph {
  const valid = new Set(words);
  const buckets = new Map<string, string[]>();
  for (const word of words) {
    for (let i = 0; i < WORD_LENGTH; i++) {
      const pattern = word.slice(0, i) + "_" + word.slice(i + 1);
      const bucket = buckets.get(pattern);
      if (bucket) bucket.push(word);
      else buckets.set(pattern, [word]);
    }
  }
  return { words, valid, buckets };
}

/** All valid words exactly one letter different from `word` (excluding itself). */
export function neighbors(word: string, graph: WordGraph): string[] {
  const result = new Set<string>();
  for (let i = 0; i < WORD_LENGTH; i++) {
    const pattern = word.slice(0, i) + "_" + word.slice(i + 1);
    const bucket = graph.buckets.get(pattern);
    if (!bucket) continue;
    for (const w of bucket) {
      if (w !== word) result.add(w);
    }
  }
  return [...result];
}

export function isValidWord(word: string, graph: WordGraph): boolean {
  return graph.valid.has(word);
}
