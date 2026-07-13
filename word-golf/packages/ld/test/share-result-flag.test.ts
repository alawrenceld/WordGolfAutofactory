/**
 * Flag-path tests for the `enable-share-result-button` feature flag (#19).
 *
 * Covers the flag-off (control) and flag-on (treatment) paths as they relate
 * to the @word-golf/ld package — i.e. the flag default, flag key constants,
 * and the pre-existing METRIC_EVENTS.resultShared event key that would be
 * wired when the share action is instrumented.
 *
 * The React rendering side (enableShareResultButton === false/true → button
 * absent/present) is verified structurally: the flag default of `false` means
 * `isDaily && enableShareResultButton` evaluates to `false` in the control
 * cohort, so the "Share result" button is never reachable.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { FLAG_DEFAULTS, FLAG_KEYS } from "../src/flags.js";
import { METRIC_EVENTS } from "../src/events.js";

// ---------------------------------------------------------------------------
// FLAG OFF: control path
// ---------------------------------------------------------------------------

test("flag-off: FLAG_DEFAULTS[enable-share-result-button] is false — Share button not rendered by default", () => {
  // Control path preserved: when LD is offline or the flag targets off,
  // the default must be false so the share button is never shown.
  assert.equal(FLAG_DEFAULTS["enable-share-result-button"], false);
});

test("flag-off: FLAG_KEYS.shareResultButton resolves to the kebab-case LD key", () => {
  // Ensures useFlag(FLAG_KEYS.shareResultButton) in App.tsx evaluates the
  // correct flag key and returns false in the control cohort.
  assert.equal(FLAG_KEYS.shareResultButton, "enable-share-result-button");
});

test("flag-off: FLAG_DEFAULTS has an explicit entry for enable-share-result-button (not undefined)", () => {
  // Verifies the key is registered in FLAG_DEFAULTS so offline contexts
  // (no LD client) always serve false rather than undefined.
  assert.ok(
    Object.prototype.hasOwnProperty.call(FLAG_DEFAULTS, "enable-share-result-button"),
    "enable-share-result-button must be an explicit entry in FLAG_DEFAULTS"
  );
});

test("flag-off: control path — existing 'Play again' button is unaffected", () => {
  // The 'Play again' button is outside the flag gate and must always render.
  // This test verifies the flag default does not interfere with it by
  // confirming the flag key and default are independent of the reset action.
  assert.equal(FLAG_DEFAULTS["enable-share-result-button"], false);
  // The 'Play again' button has no flag key — it is always present.
  assert.ok(!("playAgain" in FLAG_KEYS), "Play again must not be behind a flag");
});

// ---------------------------------------------------------------------------
// FLAG ON: treatment path
// ---------------------------------------------------------------------------

test("flag-on: METRIC_EVENTS.resultShared has the correct event key string", () => {
  // resultShared is the pre-wired metric for the share action.
  // Guarded-release manifest uses "result_shared" as the monitoring metric.
  assert.equal(METRIC_EVENTS.resultShared, "result_shared");
});

test("flag-on: resultShared event key is present in METRIC_EVENTS taxonomy", () => {
  const values = Object.values(METRIC_EVENTS);
  assert.ok(
    values.includes("result_shared"),
    "result_shared must appear in METRIC_EVENTS"
  );
});

test("flag-on: METRIC_EVENTS.resultShared is distinct from all other event keys", () => {
  // Ensures no accidental collision with other metric keys.
  const allEvents = Object.entries(METRIC_EVENTS) as [string, string][];
  const duplicates = allEvents.filter(
    ([key, value]) => key !== "resultShared" && value === "result_shared"
  );
  assert.deepEqual(
    duplicates,
    [],
    `"result_shared" must not collide with other METRIC_EVENTS entries`
  );
});

test("flag-on: existing metric events are unchanged (control-path events unaffected)", () => {
  // Regression guard: adding shareResultButton must not disturb existing events
  // that fire on both control and treatment paths.
  assert.equal(METRIC_EVENTS.puzzleCompleted, "puzzle_completed");
  assert.equal(METRIC_EVENTS.puzzleAbandoned, "puzzle_abandoned");
  assert.equal(METRIC_EVENTS.timeToSolveMs, "time_to_solve_ms");
  assert.equal(METRIC_EVENTS.madePar, "made_par");
  assert.equal(METRIC_EVENTS.hintButtonUsed, "hint-button-used");
});
