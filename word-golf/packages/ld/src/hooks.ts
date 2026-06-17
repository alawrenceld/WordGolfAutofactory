import { useContext } from "react";
import { LDContext } from "./context.js";
import type { Flags } from "./flags.js";
import type { TrackFn } from "./events.js";

/** All current flag values (typed). */
export function useFlags(): Flags {
  return useContext(LDContext).flags;
}

/** A single flag value by key. */
export function useFlag<K extends keyof Flags>(key: K): Flags[K] {
  return useContext(LDContext).flags[key];
}

/** The typed metric tracker. No-ops when LD is not configured. */
export function useTrack(): TrackFn {
  return useContext(LDContext).track;
}

/** Whether a real LaunchDarkly client is connected. */
export function useLDLive(): boolean {
  return useContext(LDContext).live;
}
