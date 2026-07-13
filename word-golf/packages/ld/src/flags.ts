/**
 * Flag keys and their typed shapes. This is the app-side mirror of the flags
 * the AutoFactory creates in the LaunchDarkly app project (see config/). Keys
 * are kebab-case to match LaunchDarkly exactly (the provider is configured with
 * useCamelCaseFlagKeys: false).
 */
export const FLAG_KEYS = {
  hintButton: "hint-button",
  parAlgorithm: "par-algorithm",
  wordPoolDifficulty: "word-pool-difficulty",
  dailyTheme: "daily-theme",
  showMissionControl: "show-mission-control",
  enableRandomPuzzle: "enable-random-puzzle",
  shareResultButton: "enable-share-result-button",
} as const;

export type ParAlgorithm = "shortest" | "no-reuse" | "heuristic";
export type WordPoolDifficulty = "easy" | "medium" | "hard";

export interface Flags {
  "hint-button": boolean;
  "par-algorithm": ParAlgorithm;
  "word-pool-difficulty": WordPoolDifficulty;
  "daily-theme": string;
  "show-mission-control": boolean;
  "enable-random-puzzle": boolean;
  "enable-share-result-button": boolean;
}

/**
 * Defaults used until a flag exists / the client connects. The AutoFactory
 * creates new flags targeting **off**, so booleans default to the "control"
 * value here too.
 */
export const FLAG_DEFAULTS: Flags = {
  "hint-button": false,
  "par-algorithm": "shortest",
  "word-pool-difficulty": "medium",
  "daily-theme": "",
  "show-mission-control": false,
  "enable-random-puzzle": false,
  "enable-share-result-button": false,
};
