import { useMemo, type ReactNode } from "react";
import {
  LDProvider,
  useFlags as useLDFlags,
  useLDClient,
} from "launchdarkly-react-client-sdk";
import { LDContext, defaultLD, type WordGolfLD } from "./context.js";
import { FLAG_DEFAULTS, type Flags } from "./flags.js";
import type { TrackFn } from "./events.js";

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
 */
export function LDRoot({ clientSideID, children }: LDRootProps) {
  if (!clientSideID) {
    return <LDContext.Provider value={defaultLD}>{children}</LDContext.Provider>;
  }
  return (
    <LDProvider
      clientSideID={clientSideID}
      reactOptions={{ useCamelCaseFlagKeys: false }}
      context={{ kind: "user", key: "anonymous", anonymous: true }}
    >
      <Bridge>{children}</Bridge>
    </LDProvider>
  );
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
