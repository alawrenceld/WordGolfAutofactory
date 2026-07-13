import { useMemo, type ReactNode } from "react";
import {
  createLDReactProvider,
  useFlags as useLDFlags,
  useLDClient,
} from "@launchdarkly/react-sdk";
import Observability from "@launchdarkly/observability";
import { LDContext, defaultLD, type WordGolfLD } from "./context.js";
import { FLAG_DEFAULTS, type Flags } from "./flags.js";
import type { TrackFn } from "./events.js";

let observabilityPlugin: Observability | null = null;

/** Lazily construct the plugin only when a live LD client is in play. */
function getObservabilityPlugin(): Observability {
  if (!observabilityPlugin) {
    observabilityPlugin = new Observability();
  }
  return observabilityPlugin;
}

export interface LDRootProps {
  /** App project client-side ID (Vite: VITE_LD_CLIENT_ID). */
  clientSideID?: string;
  children: ReactNode;
}

/**
 * Root LaunchDarkly provider.
 *
 * When `clientSideID` is set, it connects the real client (with the Observability
 * plugin for errors, web vitals, and traces) and bridges flags + `track` into
 * our typed context. When it is absent (local dev, tests, no LD configured), it
 * renders an offline context with safe defaults and a no-op tracker.
 *
 * Requires @launchdarkly/react-sdk v4+ — the v3 client SDK silently ignores
 * `options.plugins`, so observability only works with the v4 plugin API.
 */
export function LDRoot({ clientSideID, children }: LDRootProps) {
  if (!clientSideID) {
    return <LDContext.Provider value={defaultLD}>{children}</LDContext.Provider>;
  }

  return (
    <LDConnected clientSideID={clientSideID}>
      <Bridge>{children}</Bridge>
    </LDConnected>
  );
}

/** Wraps createLDReactProvider so we can pass a runtime client-side ID. */
function LDConnected({
  clientSideID,
  children,
}: {
  clientSideID: string;
  children: ReactNode;
}) {
  const LDProvider = useMemo(
    () =>
      createLDReactProvider(
        clientSideID,
        { kind: "user", anonymous: true },
        {
          ldOptions: {
            plugins: [getObservabilityPlugin()],
            useCamelCaseFlagKeys: false,
          },
        }
      ),
    [clientSideID]
  );

  return <LDProvider>{children}</LDProvider>;
}

/** Reads the live SDK state and exposes it through our typed context. */
function Bridge({ children }: { children: ReactNode }) {
  const ldFlags = useLDFlags();
  const client = useLDClient();
  const value = useMemo<WordGolfLD>(() => {
    const flags: Flags = { ...FLAG_DEFAULTS, ...(ldFlags as Partial<Flags>) };
    const track: TrackFn = (event, options) => {
      client?.track(event, options?.data, options?.value);
    };
    return { flags, track, live: Boolean(client) };
  }, [ldFlags, client]);
  return <LDContext.Provider value={value}>{children}</LDContext.Provider>;
}
