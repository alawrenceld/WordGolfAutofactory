/**
 * Pure utility functions for the `enable-observability-plugin` flag path.
 * Extracted as a separate module so they can be unit-tested without a React
 * environment — the provider.tsx imports from here.
 */
import Observability from "@launchdarkly/observability";
import { FLAG_DEFAULTS } from "./flags.js";
import type { Flags } from "./flags.js";

/**
 * Lazily-created observability plugin instance.
 * Allocated at most once per session, only when the flag is enabled.
 * Exposed for testing so the singleton can be reset between test runs.
 */
export let _observabilityPlugin: Observability | null = null;

/** Reset the singleton — for use in tests only. */
export function _resetObservabilityPlugin(): void {
  _observabilityPlugin = null;
}

export function getObservabilityPlugin(): Observability {
  if (!_observabilityPlugin) {
    _observabilityPlugin = new Observability();
  }
  return _observabilityPlugin;
}

/**
 * Build LDProvider `options` based on whether the observability flag is on.
 * When the flag is off the returned value is `undefined` (no options object),
 * preserving the exact pre-PR behaviour.
 */
export function buildLDOptions(
  observabilityEnabled: boolean
): { plugins: Observability[] } | undefined {
  return observabilityEnabled
    ? { plugins: [getObservabilityPlugin()] }
    : undefined;
}

/**
 * Extract the flag value from the live SDK flags map, falling back to the
 * FLAG_DEFAULTS value when the key is absent (i.e. SDK not yet connected).
 */
export function resolveObservabilityFlag(ldFlags: Record<string, unknown>): boolean {
  return "enable-observability-plugin" in ldFlags
    ? Boolean(ldFlags["enable-observability-plugin"])
    : FLAG_DEFAULTS["enable-observability-plugin"];
}

/** Interface for the LD client subset used by metric emission. */
export interface TrackClient {
  track(key: string, data?: unknown, value?: number): void;
}

/**
 * Emit guarded-release metrics when the observability plugin flag is **on**.
 * Fires three events: latency (numeric), activated (occurrence), and on error,
 * the error metric.  Every `track()` call is wrapped individually so a telemetry
 * failure can never propagate to the render path.
 *
 * When the flag is **off** this function is a no-op — no events are emitted and
 * the plugin is never allocated.
 *
 * @param flagValue  Current value of `enable-observability-plugin`.
 * @param client     The LD client to track against (may be undefined).
 */
export function emitObservabilityMetrics(
  flagValue: boolean,
  client: TrackClient | undefined
): void {
  if (!flagValue) {
    // Control path — no plugin, no events.
    return;
  }

  try {
    const t0 = Date.now();
    getObservabilityPlugin(); // ensures the singleton is allocated
    const initMs = Date.now() - t0;
    try {
      client?.track("enable-observability-plugin-latency", undefined, initMs);
    } catch (_) {
      /* telemetry must never throw */
    }
    try {
      client?.track("enable-observability-plugin-activated");
    } catch (_) {
      /* telemetry must never throw */
    }
  } catch (_err) {
    // Plugin initialisation failed — record the error metric.
    try {
      client?.track("enable-observability-plugin-error");
    } catch (_) {
      /* telemetry must never throw */
    }
  }
}
