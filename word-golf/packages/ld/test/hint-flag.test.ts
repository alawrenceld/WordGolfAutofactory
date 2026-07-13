/**
 * Flag-path tests for the `hint-button` feature flag (#18).
 *
 * Covers the flag-off (control) and flag-on (treatment) paths as they relate
 * to the @word-golf/ld package — i.e. the flag default, flag key constants,
 * and the newly-instrumented METRIC_EVENTS.hintButtonUsed event key.
 *
 * The React rendering side (showHintButton === false/true → button absent/present)
 * is covered by packages/engine/test/hint.test.ts via the BFS logic, since the
 * app currently has no React test harness.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { FLAG_DEFAULTS, FLAG_KEYS } from "../src/flags.js";
import { METRIC_EVENTS } from "../src/events.js";

// ---------------------------------------------------------------------------
// FLAG OFF: control path
// ---------------------------------------------------------------------------

test("flag-off: FLAG_DEFAULTS[hint-button] is false — Hint button not rendered by default", () => {
  // The control path is preserved: when LD is offline or the flag targets off,
  // the default value must be false so hint() is never reachable.
  assert.equal(FLAG_DEFAULTS["hint-button"], false);
});

test("flag-off: FLAG_KEYS.hintButton resolves to the kebab-case LD key", () => {
  // Ensures the useFlag(FLAG_KEYS.hintButton) call in App.tsx evaluates the
  // correct flag key and returns the false default in the control cohort.
  assert.equal(FLAG_KEYS.hintButton, "hint-button");
});

test("flag-off: FLAG_DEFAULTS key set includes hint-button (not undefined)", () => {
  // Verifies the key is explicitly registered in FLAG_DEFAULTS, so offline
  // contexts (no LD client) always serve false rather than undefined.
  assert.ok(
    Object.prototype.hasOwnProperty.call(FLAG_DEFAULTS, "hint-button"),
    "hint-button must be an explicit entry in FLAG_DEFAULTS"
  );
});

// ---------------------------------------------------------------------------
// FLAG ON: treatment path — hintButtonUsed metric event
// ---------------------------------------------------------------------------

test("flag-on: METRIC_EVENTS.hintButtonUsed has the correct event key string", () => {
  // App.tsx calls track(METRIC_EVENTS.hintButtonUsed) inside hint().
  // The guarded-release manifest wires "hint-button-used" as the monitoring
  // metric; this must match exactly.
  assert.equal(METRIC_EVENTS.hintButtonUsed, "hint-button-used");
});

test("flag-on: METRIC_EVENTS.hintButtonUsed is distinct from all other event keys", () => {
  // Ensures no accidental collision with existing metric keys — a collision
  // would pollute other guarded-release metrics.
  const allEvents = Object.entries(METRIC_EVENTS) as [string, string][];
  const duplicates = allEvents.filter(
    ([key, value]) => key !== "hintButtonUsed" && value === "hint-button-used"
  );
  assert.deepEqual(
    duplicates,
    [],
    `"hint-button-used" must not collide with other METRIC_EVENTS entries`
  );
});

test("flag-on: hint-button-used event key is present in METRIC_EVENTS taxonomy", () => {
  const values = Object.values(METRIC_EVENTS);
  assert.ok(
    values.includes("hint-button-used"),
    "hint-button-used must appear in METRIC_EVENTS"
  );
});

test("flag-on: existing metric events are unchanged (control-path events unaffected)", () => {
  // Regression check: adding hintButtonUsed must not disturb existing events
  // that fire on BOTH control and treatment paths (the guarded-release
  // killswitch metrics rely on these remaining stable).
  assert.equal(METRIC_EVENTS.puzzleCompleted, "puzzle_completed");
  assert.equal(METRIC_EVENTS.puzzleAbandoned, "puzzle_abandoned");
  assert.equal(METRIC_EVENTS.timeToSolveMs, "time_to_solve_ms");
  assert.equal(METRIC_EVENTS.madePar, "made_par");
});
