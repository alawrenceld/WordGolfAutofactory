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
  // Latency (numeric metrics; pass `value`)
  timeToSolveMs: "time_to_solve_ms",
  moveLatencyMs: "move_latency_ms",
  // Error
  invalidMove: "invalid_move",
  puzzleAbandoned: "puzzle_abandoned",
  // Observability plugin (guarded-release metrics for enable-observability-plugin)
  observabilityPluginError: "enable-observability-plugin-error",
  observabilityPluginInitMs: "enable-observability-plugin-init-ms",
  observabilityPluginActivated: "enable-observability-plugin-activated",
} as const;

export type MetricEvent = (typeof METRIC_EVENTS)[keyof typeof METRIC_EVENTS];

export interface TrackOptions {
  /** Arbitrary structured payload attached to the event. */
  data?: unknown;
  /** Numeric metric value, for numeric metrics like `time_to_solve_ms`. */
  value?: number;
}

export type TrackFn = (event: MetricEvent, options?: TrackOptions) => void;
