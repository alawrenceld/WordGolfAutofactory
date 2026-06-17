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
export interface DailyPools {
  startPool: string[];
  targetPool: string[];
}

export function buildDailyPools(answers: string[], common: string[]): DailyPools {
  const commonTop = new Set(common.slice(0, 2500));
  const friendly = answers.filter((w) => commonTop.has(w));
  const startPool = friendly.length >= 100 ? friendly : answers;
  return { startPool, targetPool: common };
}
