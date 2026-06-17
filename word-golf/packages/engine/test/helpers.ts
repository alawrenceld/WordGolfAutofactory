import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseWordList } from "../src/wordlists.js";
import { buildWordGraph } from "../src/graph.js";
import type { WordGraph } from "../src/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "..", "..", "data");

export function loadList(name: string): string[] {
  return parseWordList(readFileSync(join(dataDir, name), "utf8"));
}

let cachedGraph: WordGraph | null = null;
export function realGraph(): WordGraph {
  if (!cachedGraph) cachedGraph = buildWordGraph(loadList("combined_wordlist.txt"));
  return cachedGraph;
}
