import {
  buildDailyPools,
  buildWordGraph,
  parseWordList,
  practicePoolsForDifficulty,
  type PracticeDifficulty,
  type WordGraph,
} from "@word-golf/engine";

// The bundled lists are inlined at build time via Vite's `?raw` import.
import combinedRaw from "../../../data/combined_wordlist.txt?raw";
import answersRaw from "../../../data/shuffled_real_wordles.txt?raw";
import commonRaw from "../../../data/common_words.txt?raw";
import difficultRaw from "../../../data/difficult_words.txt?raw";

export const graph: WordGraph = buildWordGraph(parseWordList(combinedRaw));

const answers = parseWordList(answersRaw);
const common = parseWordList(commonRaw);
const difficult = parseWordList(difficultRaw);

const { startPool, targetPool } = buildDailyPools(answers, common);

export { startPool, targetPool };

/** Practice-only pool presets; daily always uses `startPool` / `targetPool` above. */
export function practicePools(difficulty: PracticeDifficulty) {
  return practicePoolsForDifficulty(difficulty, answers, common, difficult);
}
