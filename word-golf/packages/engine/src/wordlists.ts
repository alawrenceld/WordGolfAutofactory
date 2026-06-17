import { WORD_LENGTH } from "./types.js";

const VALID_WORD = /^[a-z]{5}$/;

/**
 * Parse a bundled word-list file into a clean array of words.
 *
 * Every provided list has a leading `#` comment line (and may contain blanks or
 * stray casing/whitespace), so we strip comments, lowercase, trim, and keep only
 * exactly-5-letter a-z words. De-duplicated, original order preserved.
 */
export function parseWordList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const word = line.trim().toLowerCase();
    if (word.length === 0 || word.startsWith("#")) continue;
    if (!VALID_WORD.test(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  return out;
}

export { WORD_LENGTH };
