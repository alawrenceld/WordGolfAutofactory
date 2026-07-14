/**
 * Build the start/target pools for the default Daily mode.
 *
 * Shared by the web app and the CLI verifier so a quoted puzzle always matches
 * what renders on screen.
 *
 * - start pool: answers that are also among the most common words (familiar
 *   openers), falling back to all answers if the intersection is too small.
 * - target pool: the full common-word list, so the walk only ever stops on a
 *   recognizable word.
 */
export type PracticeDifficulty = "easy" | "medium" | "hard";

export interface DailyPools {
  startPool: string[];
  targetPool: string[];
}

export interface PracticePoolOptions extends DailyPools {
  minPar: number;
  /** Hard mode picks targets from the difficult list via target-first BFS. */
  hardTargetPool?: string[];
}

export function buildDailyPools(answers: string[], common: string[]): DailyPools {
  const commonTop = new Set(common.slice(0, 2500));
  const friendly = answers.filter((w) => commonTop.has(w));
  const startPool = friendly.length >= 100 ? friendly : answers;
  return { startPool, targetPool: common };
}

export const PRACTICE_DIFFICULTIES: readonly PracticeDifficulty[] = [
  "easy",
  "medium",
  "hard",
];

/** Coerce unknown runtime values (e.g. misconfigured LD flags) to a safe level. */
export function normalizePracticeDifficulty(raw: unknown): PracticeDifficulty {
  if (
    typeof raw === "string" &&
    (PRACTICE_DIFFICULTIES as readonly string[]).includes(raw)
  ) {
    return raw as PracticeDifficulty;
  }
  return "medium";
}

/** Practice-only pools; daily generation ignores difficulty entirely. */
export function practicePoolsForDifficulty(
  difficulty: PracticeDifficulty,
  answers: string[],
  common: string[],
  difficult: string[]
): PracticePoolOptions {
  const daily = buildDailyPools(answers, common);
  const level = normalizePracticeDifficulty(difficulty);
  switch (level) {
    case "easy":
      return { ...daily, minPar: 3 };
    case "medium":
      return {
        startPool: answers,
        targetPool: daily.targetPool,
        minPar: 4,
      };
    case "hard":
      return {
        startPool: answers,
        targetPool: daily.targetPool,
        minPar: 5,
        hardTargetPool: difficult,
      };
    default:
      // Exhaustiveness guard — should be unreachable after normalizePracticeDifficulty.
      return {
        startPool: answers,
        targetPool: daily.targetPool,
        minPar: 4,
      };
  }
}
