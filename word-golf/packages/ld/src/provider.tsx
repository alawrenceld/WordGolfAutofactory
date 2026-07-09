import { useMemo, useState, useEffect, type ReactNode } from "react";
import {
  LDProvider,
  useFlags as useLDFlags,
  useLDClient,
} from "launchdarkly-react-client-sdk";
import { LDContext, defaultLD, type WordGolfLD } from "./context.js";
import { FLAG_DEFAULTS, type Flags } from "./flags.js";
import type { TrackFn } from "./events.js";
import {
  buildLDOptions,
  resolveObservabilityFlag,
  emitObservabilityMetrics,
} from "./observability-utils.js";

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
 * The `enable-observability-plugin` feature flag gates whether the
 * @launchdarkly/observability plugin (errors, web vitals, traces) is active.
 * Control path (flag off) = no plugin, identical to pre-PR behaviour.
 */
export function LDRoot({ clientSideID, children }: LDRootProps) {
  if (!clientSideID) {
    return <LDContext.Provider value={defaultLD}>{children}</LDContext.Provider>;
  }

  // Initialise from FLAG_DEFAULTS so the control path (flag=false) is safe
  // before the SDK connects. The Bridge component will update this state once
  // the live flag value is received, allowing a seamless toggle on page reload.
  const [observabilityEnabled, setObservabilityEnabled] = useState(
    FLAG_DEFAULTS["enable-observability-plugin"]
  );

  return (
    <LDProvider
      clientSideID={clientSideID}
      options={buildLDOptions(observabilityEnabled)}
      reactOptions={{ useCamelCaseFlagKeys: false }}
      // Omit `key` for anonymous contexts: the SDK generates a random per-browser
      // key and persists it in localStorage (stable across reloads, unique across
      // visitors). A shared/constant key would hash every visitor to the same
      // bucket, so percentage rollouts and experiments couldn't split traffic.
      context={{ kind: "user", anonymous: true }}
    >
      <Bridge onObservabilityFlagChange={setObservabilityEnabled}>
        {children}
      </Bridge>
    </LDProvider>
  );
}

interface BridgeProps {
  children: ReactNode;
  /** Called whenever the live `enable-observability-plugin` flag value changes. */
  onObservabilityFlagChange: (enabled: boolean) => void;
}

/**
 * Reads the live SDK state and exposes it through our typed context.
 * Also notifies the parent LDRoot when the observability flag changes so
 * the provider options can be updated on the next re-mount.
 */
function Bridge({ children, onObservabilityFlagChange }: BridgeProps) {
  const ldFlags = useLDFlags();
  const client = useLDClient();

  // Propagate the live observability flag value to LDRoot so the plugin can
  // be toggled on/off. This effect runs whenever the SDK delivers a new value
  // for the flag, keeping LDRoot's state in sync.
  // Also emits guarded-release metric events so the rollout can be measured:
  //   enable-observability-plugin-activated  (business  — plugin came up)
  //   enable-observability-plugin-error      (error     — plugin threw on init)
  //   enable-observability-plugin-latency    (latency   — ms to initialise plugin)
  useEffect(() => {
    const flagValue = resolveObservabilityFlag(ldFlags as Record<string, unknown>);
    onObservabilityFlagChange(flagValue);
    emitObservabilityMetrics(flagValue, client);
  }, [ldFlags, onObservabilityFlagChange, client]);

  const value = useMemo<WordGolfLD>(() => {
    const flags: Flags = { ...FLAG_DEFAULTS, ...(ldFlags as Partial<Flags>) };
    const track: TrackFn = (event, options) => {
      client?.track(event, options?.data, options?.value);
    };
    return { flags, track, live: Boolean(client) };
  }, [ldFlags, client]);
  return <LDContext.Provider value={value}>{children}</LDContext.Provider>;
}
