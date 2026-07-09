import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  LDProvider,
  useFlags as useLDFlags,
  useLDClient,
} from "launchdarkly-react-client-sdk";
import { LDContext, defaultLD, type WordGolfLD } from "./context.js";
import { FLAG_DEFAULTS, type Flags } from "./flags.js";
import { METRIC_EVENTS, type TrackFn } from "./events.js";

export interface LDRootProps {
  /** App project client-side ID (Vite: VITE_LD_CLIENT_ID). */
  clientSideID?: string;
  /**
   * Enable the LaunchDarkly Observability plugin (errors, web vitals, traces).
   * Gated behind the `enable-observability-plugin` feature flag.
   * Pass `true` only when the flag is on; defaults to `false` (control path).
   */
  enableObservability?: boolean;
  children: ReactNode;
}

/**
 * Root LaunchDarkly provider.
 *
 * When `clientSideID` is set, it connects the real client and bridges flags +
 * `track` into our typed context. When it is absent (local dev, tests, no LD
 * configured), it renders an offline context with safe defaults and a no-op
 * tracker, so the game is fully playable without any LaunchDarkly setup.
 */
export function LDRoot({ clientSideID, enableObservability = false, children }: LDRootProps) {
  if (!clientSideID) {
    return <LDContext.Provider value={defaultLD}>{children}</LDContext.Provider>;
  }

  // Lazily import and instantiate the observability plugin only when the flag
  // is on. This keeps the control path (flag off) free of the plugin entirely,
  // preserving existing behavior and avoiding any side-effects on initialization.
  let plugins: object[] = [];
  let pluginInitResult: { durationMs: number; error?: string } | null = null;

  if (enableObservability) {
    const t0 = Date.now();
    try {
      // Dynamic require so the module is not evaluated on the control path.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Observability = require("@launchdarkly/observability").default as new () => object;
      plugins = [new Observability()];
      pluginInitResult = { durationMs: Date.now() - t0 };
    } catch (err) {
      // Telemetry must never fail the request — swallow and record the error.
      pluginInitResult = {
        durationMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return (
    <LDProvider
      clientSideID={clientSideID}
      options={{ plugins }}
      reactOptions={{ useCamelCaseFlagKeys: false }}
      // Omit `key` for anonymous contexts: the SDK generates a random per-browser
      // key and persists it in localStorage (stable across reloads, unique across
      // visitors). A shared/constant key would hash every visitor to the same
      // bucket, so percentage rollouts and experiments couldn't split traffic.
      context={{ kind: "user", anonymous: true }}
    >
      <Bridge pluginInitResult={pluginInitResult}>{children}</Bridge>
    </LDProvider>
  );
}

interface BridgeProps {
  children: ReactNode;
  /**
   * Result of the observability-plugin initialisation attempt, or null when
   * the flag is off (control path). Forwarded to Bridge so it can emit the
   * guarded-release metric events once the LD client is available.
   */
  pluginInitResult: { durationMs: number; error?: string } | null;
}

/** Reads the live SDK state and exposes it through our typed context. */
function Bridge({ children, pluginInitResult }: BridgeProps) {
  const ldFlags = useLDFlags();
  const client = useLDClient();
  const value = useMemo<WordGolfLD>(() => {
    const flags: Flags = { ...FLAG_DEFAULTS, ...(ldFlags as Partial<Flags>) };
    const track: TrackFn = (event, options) => {
      client?.track(event, options?.data, options?.value);
    };
    return { flags, track, live: Boolean(client) };
  }, [ldFlags, client]);

  // Guarded-release metric events for the enable-observability-plugin flag.
  // Emitted once per mount when the plugin init result is available.
  // Telemetry is fire-and-forget; failures must never affect the render path.
  const emittedRef = useRef(false);
  useEffect(() => {
    if (!client || !pluginInitResult || emittedRef.current) return;
    emittedRef.current = true;
    try {
      if (pluginInitResult.error !== undefined) {
        // error metric: occurrence (no value)
        client.track(METRIC_EVENTS.observabilityPluginError);
      } else {
        // latency metric: ms duration
        client.track(
          METRIC_EVENTS.observabilityPluginInitMs,
          undefined,
          undefined,
          pluginInitResult.durationMs,
        );
        // business metric: occurrence — plugin activated successfully
        client.track(METRIC_EVENTS.observabilityPluginActivated);
      }
    } catch {
      // Swallow — telemetry must not break the app.
    }
  }, [client, pluginInitResult]);

  return <LDContext.Provider value={value}>{children}</LDContext.Provider>;
}
