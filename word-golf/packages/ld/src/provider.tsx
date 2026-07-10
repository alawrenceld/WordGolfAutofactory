import { useMemo, useState, type ReactNode } from "react";
import {
  LDProvider,
  useFlags as useLDFlags,
  useLDClient,
} from "launchdarkly-react-client-sdk";
import Observability from "@launchdarkly/observability";
import { LDContext, defaultLD, type WordGolfLD } from "./context.js";
import { FLAG_DEFAULTS, type Flags } from "./flags.js";
import { METRIC_EVENTS, type TrackFn } from "./events.js";

/**
 * Shared observability plugin instance — errors, logs, traces, and web vitals.
 * Instantiated once at module level so it is reused across LDProvider remounts.
 * Only injected into LDProvider when the `enable-observability-plugin` flag is on.
 */
const observabilityPlugin = new Observability();

export interface LDRootProps {
  /** App project client-side ID (Vite: VITE_LD_CLIENT_ID). */
  clientSideID?: string;
  children: ReactNode;
}

/**
 * Root LaunchDarkly provider.
 *
 * When `clientSideID` is set, it connects the real client and bridges flags +
 * `track` into our typed context. When it is absent (local dev, tests, no LD
 * configured), it renders an offline context with safe defaults and a no-op
 * tracker, so the game is fully playable without any LaunchDarkly setup.
 *
 * The Observability plugin (errors, web vitals, traces) is gated behind the
 * `enable-observability-plugin` feature flag. The provider mounts initially
 * without the plugin (control path / flag off). Once the LD client connects and
 * the flag evaluates to `true`, Bridge signals back and LDRoot remounts
 * LDProvider with the plugin included (treatment path / flag on).
 */
export function LDRoot({ clientSideID, children }: LDRootProps) {
  if (!clientSideID) {
    return <LDContext.Provider value={defaultLD}>{children}</LDContext.Provider>;
  }

  // pluginsEnabled drives which plugin array is passed to LDProvider.
  // It starts false (control: no plugin) and flips to true when Bridge reads
  // the live flag value as true. Changing the key forces LDProvider to remount
  // with the updated options so the plugin is properly registered.
  return <LDRootConnected clientSideID={clientSideID}>{children}</LDRootConnected>;
}

/** Inner stateful shell so hooks are valid (avoids early-return hook violations). */
function LDRootConnected({ clientSideID, children }: Required<LDRootProps>) {
  const [pluginsEnabled, setPluginsEnabled] = useState(false);
  // Tracks whether the last plugin activation attempt threw so Bridge can emit
  // the error metric event.
  const [pluginActivationFailed, setPluginActivationFailed] = useState(false);

  // Control path (flag off): no plugins array — preserves pre-PR behavior exactly.
  // Treatment path (flag on): include the observability plugin.
  let ldOptions: { plugins: Observability[] } | undefined;
  try {
    ldOptions = pluginsEnabled ? { plugins: [observabilityPlugin] } : undefined;
    if (pluginsEnabled) setPluginActivationFailed(false);
  } catch {
    // If the plugin constructor ever throws, fall back to no-plugin (control)
    // and signal to Bridge that it should emit the error metric.
    ldOptions = undefined;
    setPluginActivationFailed(true);
  }

  return (
    <LDProvider
      // Re-key forces LDProvider to remount when plugin state changes so the
      // plugin is registered from the start of that client's lifetime.
      key={String(pluginsEnabled)}
      clientSideID={clientSideID}
      options={ldOptions}
      reactOptions={{ useCamelCaseFlagKeys: false }}
      // Omit `key` for anonymous contexts: the SDK generates a random per-browser
      // key and persists it in localStorage (stable across reloads, unique across
      // visitors). A shared/constant key would hash every visitor to the same
      // bucket, so percentage rollouts and experiments couldn't split traffic.
      context={{ kind: "user", anonymous: true }}
    >
      <Bridge
        onObservabilityFlag={setPluginsEnabled}
        pluginActivationFailed={pluginActivationFailed}
      >
        {children}
      </Bridge>
    </LDProvider>
  );
}

/** Reads the live SDK state and exposes it through our typed context. */
function Bridge({
  children,
  onObservabilityFlag,
  pluginActivationFailed,
}: {
  children: ReactNode;
  onObservabilityFlag: (enabled: boolean) => void;
  /** True when LDRootConnected caught an error building the plugin options. */
  pluginActivationFailed?: boolean;
}) {
  const ldFlags = useLDFlags();
  const client = useLDClient();
  const value = useMemo<WordGolfLD>(() => {
    const flags: Flags = { ...FLAG_DEFAULTS, ...(ldFlags as Partial<Flags>) };
    const track: TrackFn = (event, options) => {
      client?.track(event, options?.data, options?.value);
    };
    return { flags, track, live: Boolean(client) };
  }, [ldFlags, client]);

  // Propagate the enable-observability-plugin flag up to LDRootConnected so it
  // can remount LDProvider with (or without) the plugin. Using the resolved
  // flags object keeps this in sync with the same flag evaluation path used
  // everywhere else in the app.
  const observabilityEnabled = value.flags["enable-observability-plugin"];
  useMemo(() => {
    onObservabilityFlag(observabilityEnabled);

    // Guarded-release instrumentation: emit telemetry events so LaunchDarkly
    // can compare treatment vs. control audiences during the flag rollout.
    // Telemetry failures are silenced so they can never break the request.
    if (observabilityEnabled) {
      try {
        // Business: plugin successfully activated — higher is better.
        client?.track(METRIC_EVENTS.observabilityPluginActivated);
      } catch {
        // Intentionally silenced — telemetry must never break the request.
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observabilityEnabled]);

  // Error metric: emit when LDRootConnected signals a plugin activation failure.
  // Tracked on the same context as the flag so randomization units match.
  useMemo(() => {
    if (pluginActivationFailed) {
      try {
        // Error: plugin activation threw — lower is better (killswitch signal).
        client?.track(METRIC_EVENTS.observabilityPluginError);
      } catch {
        // Intentionally silenced — telemetry must never break the request.
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginActivationFailed]);

  return <LDContext.Provider value={value}>{children}</LDContext.Provider>;
}
