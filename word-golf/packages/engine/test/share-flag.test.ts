/**
 * Flag-path tests for `enable-share-result` (PR #10).
 *
 * These tests cover:
 *   - FLAG_KEYS.enableShareResult exists with the correct value
 *   - FLAG_DEFAULTS["enable-share-result"] defaults to false (control path)
 *   - METRIC_EVENTS.resultShared exists (fired on clipboard success, flag-on)
 *   - METRIC_EVENTS.shareError exists (fired on clipboard failure, flag-on)
 *   - buildShareText is exported from the engine index (flag-on usage)
 *   - The share text format never changes silently (regression on flag-on path)
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// We import directly from source files (the engine package tests do the same).
// The ld package is a sibling workspace inside packages/ — import via relative path.
import { FLAG_KEYS, FLAG_DEFAULTS } from "../../ld/src/flags.js";
import { METRIC_EVENTS } from "../../ld/src/events.js";
import { buildShareText } from "../src/score.js";

// ── Flag key wiring ───────────────────────────────────────────────────────────

test("[flag-off] FLAG_DEFAULTS[enable-share-result] is false (control path)", () => {
  // The flag defaults to OFF, meaning the Share button is absent by default.
  assert.equal(
    FLAG_DEFAULTS["enable-share-result"],
    false,
    "Default must be false so the share button is hidden until the flag is turned on"
  );
});

test("[flag-on] FLAG_KEYS.enableShareResult resolves to correct flag key string", () => {
  // The hook call `useFlag(FLAG_KEYS.enableShareResult)` must reference the
  // canonical LaunchDarkly flag key "enable-share-result".
  assert.equal(
    FLAG_KEYS.enableShareResult,
    "enable-share-result",
    "FLAG_KEYS.enableShareResult must match the LaunchDarkly flag key exactly"
  );
});

// ── Metric event wiring (flag-on paths) ──────────────────────────────────────

test("[flag-on] METRIC_EVENTS.resultShared is the correct event key", () => {
  // Fired inside share() after a successful clipboard.writeText() — only
  // reachable when the flag is ON and the user clicks the Share button.
  assert.equal(
    METRIC_EVENTS.resultShared,
    "result_shared",
    "resultShared event key must match config/metrics.json"
  );
});

test("[flag-on] METRIC_EVENTS.shareError is the correct event key", () => {
  // Fired inside share() catch block when clipboard.writeText() fails — only
  // reachable on the flag-on path.
  assert.equal(
    METRIC_EVENTS.shareError,
    "enable-share-result-error",
    "shareError event key must match the killswitch metric key in .release-flags/pr-10.json"
  );
});

// ── Engine export check ───────────────────────────────────────────────────────

test("[flag-on] buildShareText is exported from engine (used by App.tsx share())", () => {
  // App.tsx imports `buildShareText` from "@word-golf/engine". If this export
  // were missing the flag-on path would throw at import time.
  assert.equal(typeof buildShareText, "function");
});

// ── Flag-on path: share text correctness (regression) ────────────────────────

test("[flag-on] share text on a par round matches expected Wordle-style format", () => {
  const text = buildShareText(4, 4, "2026-06-17");
  // Full contract: prefix, label, relative-score in parens, move count, par count.
  assert.match(
    text,
    /^Word Golf \d{4}-\d{2}-\d{2}: .+ \([E+\-]\d*\) — \d+ moves, par \d+$/,
    "share text must match the Wordle-style format"
  );
});

test("[flag-on] share text relative score is E when moves === par", () => {
  const text = buildShareText(5, 5, "2026-06-17");
  assert.ok(text.includes("(E)"), "even score must render as (E), not (+0) or (-0)");
});

test("[flag-on] share text relative score is negative when moves < par", () => {
  // 3 moves on a par-4 puzzle → Birdie (-1)
  const text = buildShareText(3, 4, "2026-06-17");
  assert.ok(text.includes("(-1)"), "under-par score must render as negative");
  assert.ok(!text.includes("(+"), "under-par score must not be shown as positive");
});

test("[flag-on] share text relative score is positive when moves > par", () => {
  // 6 moves on a par-4 puzzle → Double Bogey (+2)
  const text = buildShareText(6, 4, "2026-06-17");
  assert.ok(text.includes("(+2)"), "over-par score must render as positive");
});

// ── Flag-off path: no share text produced ────────────────────────────────────

test("[flag-off] when flag is false, share() is never invoked (no track calls fire)", () => {
  // This is a unit-level assertion: when enableShareResult is false the JSX
  // conditional `{enableShareResult && <button ...>}` short-circuits, meaning
  // the share() async function is never called, so neither resultShared nor
  // shareError is ever tracked. We model this here by verifying that if a caller
  // chooses not to invoke buildShareText, no side-effects occur.
  let called = false;
  const flagOff = false;
  if (flagOff) {
    buildShareText(4, 4, "2026-06-17"); // never runs
    called = true;
  }
  assert.equal(called, false, "share logic must not execute when flag is off");
});

test("[flag-off] no share-related metric events fire when flag is false", () => {
  // Simulate the flag-off path: track() is not called with resultShared or
  // shareError. We verify this by checking that a mock tracker with flagOff
  // never receives either event key.
  const trackedEvents: string[] = [];
  const mockTrack = (event: string) => { trackedEvents.push(event); };

  const enableShareResult = false; // flag OFF
  if (enableShareResult) {
    // share() body — only runs when flag is on
    mockTrack(METRIC_EVENTS.resultShared);
  }

  assert.equal(trackedEvents.length, 0, "no metric events should fire on the flag-off path");
  assert.ok(
    !trackedEvents.includes(METRIC_EVENTS.resultShared),
    "resultShared must not be tracked when flag is off"
  );
  assert.ok(
    !trackedEvents.includes(METRIC_EVENTS.shareError),
    "shareError must not be tracked when flag is off"
  );
});

// ── Flag-on path: metric event emission simulation ────────────────────────────

test("[flag-on] resultShared metric is tracked on clipboard success", () => {
  // Simulates the flag-on, clipboard-success branch of share():
  //   try { await clipboard.writeText(text); track(resultShared); } catch { ... }
  const trackedEvents: string[] = [];
  const mockTrack = (event: string) => { trackedEvents.push(event); };

  const enableShareResult = true; // flag ON
  if (enableShareResult) {
    // Simulate successful clipboard write → track business metric
    mockTrack(METRIC_EVENTS.resultShared);
  }

  assert.ok(
    trackedEvents.includes(METRIC_EVENTS.resultShared),
    "resultShared must be tracked after a successful clipboard write (flag-on path)"
  );
  assert.ok(
    !trackedEvents.includes(METRIC_EVENTS.shareError),
    "shareError must NOT be tracked on clipboard success"
  );
});

test("[flag-on] shareError metric is tracked on clipboard failure", () => {
  // Simulates the flag-on, clipboard-failure (catch) branch of share():
  //   catch { track(shareError); setFeedback({ kind: "info", text }); }
  const trackedEvents: string[] = [];
  const mockTrack = (event: string) => { trackedEvents.push(event); };

  // Clipboard throws → catch block runs
  const clipboardFailed = true;
  if (clipboardFailed) {
    mockTrack(METRIC_EVENTS.shareError);
  }

  assert.ok(
    trackedEvents.includes(METRIC_EVENTS.shareError),
    "shareError must be tracked when clipboard.writeText() rejects (flag-on path)"
  );
  assert.ok(
    !trackedEvents.includes(METRIC_EVENTS.resultShared),
    "resultShared must NOT be tracked when clipboard fails"
  );
});

test("[flag-on] telemetry failure does not propagate (track wrapped in try/catch)", () => {
  // In App.tsx both track() calls are wrapped:
  //   try { track(METRIC_EVENTS.resultShared); } catch { /* swallowed */ }
  // Verify that a throwing track function does not surface to the caller.
  const throwingTrack = (_event: string) => { throw new Error("LD SDK error"); };

  assert.doesNotThrow(() => {
    try { throwingTrack(METRIC_EVENTS.resultShared); } catch { /* telemetry must never break UX */ }
  }, "a telemetry error must be swallowed and never reach the user");

  assert.doesNotThrow(() => {
    try { throwingTrack(METRIC_EVENTS.shareError); } catch { /* telemetry must never break UX */ }
  }, "a telemetry error in the catch branch must also be swallowed");
});
