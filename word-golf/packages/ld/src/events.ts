/**
 * Metric event taxonomy, grouped by the AutoFactory's three guarded-release
 * metric categories (see plan.md section 3.1 and config/metrics.json).
 */
export const METRIC_EVENTS = {
  // Business
  puzzleCompleted: "puzzle_completed",
  madePar: "made_par",
  dailyReturned: "daily_returned",
  resultShared: "result_shared",
  /** Fired when the clipboard write in shareResult() fails (treatment path only). */
  clipboardError: "enable-share-result-button-clipboard-error",
  /** Fired each time a player clicks the Hint button (treatment path only). */
  hintButtonUsed: "hint-button-used",
  // Latency (numeric metrics; pass `value`)
  timeToSolveMs: "time_to_solve_ms",
  moveLatencyMs: "move_latency_ms",
  // Error
  invalidMove: "invalid_move",
  puzzleAbandoned: "puzzle_abandoned",
} as const;

export type MetricEvent = (typeof METRIC_EVENTS)[keyof typeof METRIC_EVENTS];

export interface TrackOptions {
  /** Arbitrary structured payload attached to the event. */
  data?: unknown;
  /** Numeric metric value, for numeric metrics like `time_to_solve_ms`. */
  value?: number;
}

export type TrackFn = (event: MetricEvent, options?: TrackOptions) => void;
