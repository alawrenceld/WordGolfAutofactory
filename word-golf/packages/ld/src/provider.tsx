import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  createLDReactProvider,
  useFlags as useLDFlags,
  useLDClient,
} from "@launchdarkly/react-sdk";
import Observability from "@launchdarkly/observability";
import SessionReplay, { LDRecord } from "@launchdarkly/session-replay";
import { LDContext, defaultLD, type WordGolfLD } from "./context.js";
import { FLAG_DEFAULTS, FLAG_KEYS, type Flags } from "./flags.js";
import type { TrackFn } from "./events.js";

const SERVICE_NAME = "word-golf-web";

let observabilityPlugin: Observability | null = null;
let sessionReplayPlugin: SessionReplay | null = null;

/** Lazily construct plugins only when a live LD client is in play. */
function getObservabilityPlugin(): Observability {
  if (!observabilityPlugin) {
    observabilityPlugin = new Observability({ serviceName: SERVICE_NAME });
  }
  return observabilityPlugin;
}

function getSessionReplayPlugin(): SessionReplay {
  if (!sessionReplayPlugin) {
    sessionReplayPlugin = new SessionReplay({
      serviceName: SERVICE_NAME,
      manualStart: true,
      privacySetting: "none",
    });
  }
  return sessionReplayPlugin;
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
      <SessionReplayGate />
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
            plugins: [getObservabilityPlugin(), getSessionReplayPlugin()],
            useCamelCaseFlagKeys: false,
          },
        }
      ),
    [clientSideID]
  );

  return <LDProvider>{children}</LDProvider>;
}

/**
 * Starts session replay only when the enable-session-replay flag is on.
 * manualStart keeps replay off by default (word-game input privacy).
 */
function SessionReplayGate() {
  const ldFlags = useLDFlags();
  const replayEnabled = Boolean(ldFlags[FLAG_KEYS.enableSessionReplay]);
  const wasEnabled = useRef(false);

  useEffect(() => {
    if (replayEnabled) {
      LDRecord.start({ silent: true });
      wasEnabled.current = true;
      return;
    }
    if (wasEnabled.current) {
      LDRecord.stop();
      wasEnabled.current = false;
    }
  }, [replayEnabled]);

  return null;
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
