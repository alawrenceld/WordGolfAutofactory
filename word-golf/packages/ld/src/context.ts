import { createContext } from "react";
import { FLAG_DEFAULTS, type Flags } from "./flags.js";
import type { TrackFn } from "./events.js";

export interface WordGolfLD {
  flags: Flags;
  track: TrackFn;
  /** True when a real LaunchDarkly client is connected (vs. offline defaults). */
  live: boolean;
}

const noopTrack: TrackFn = () => {};

/** Offline value: real defaults and a no-op tracker, so the app runs with no LD. */
export const defaultLD: WordGolfLD = {
  flags: FLAG_DEFAULTS,
  track: noopTrack,
  live: false,
};

export const LDContext = createContext<WordGolfLD>(defaultLD);
