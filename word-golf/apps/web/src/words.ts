import {
  buildDailyPools,
  buildWordGraph,
  parseWordList,
  type WordGraph,
} from "@word-golf/engine";

// The bundled lists are inlined at build time via Vite's `?raw` import.
import combinedRaw from "../../../data/combined_wordlist.txt?raw";
import answersRaw from "../../../data/shuffled_real_wordles.txt?raw";
import commonRaw from "../../../data/common_words.txt?raw";

export const graph: WordGraph = buildWordGraph(parseWordList(combinedRaw));

const { startPool, targetPool } = buildDailyPools(
  parseWordList(answersRaw),
  parseWordList(commonRaw)
);

export { startPool, targetPool };
