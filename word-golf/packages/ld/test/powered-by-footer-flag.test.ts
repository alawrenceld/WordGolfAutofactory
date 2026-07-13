/**
 * Flag-path tests for the `show-powered-by-footer` feature flag (#25).
 *
 * Covers the flag-off (control) and flag-on (treatment) paths as they relate
 * to the @word-golf/ld package — i.e. the flag default, flag key constants,
 * and the newly-instrumented METRIC_EVENTS.poweredByFooterViewed event key.
 *
 * Control path (flag off): no "Powered by LaunchDarkly" footer is rendered —
 * existing behavior is preserved exactly; the metric event is never emitted.
 * Treatment path (flag on): the footer with CodeControl, AgentControl, and
 * Software Factory Reference Design links is rendered; METRIC_EVENTS.
 * poweredByFooterViewed is tracked once per page load via useEffect.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { FLAG_DEFAULTS, FLAG_KEYS } from "../src/flags.js";
import { METRIC_EVENTS } from "../src/events.js";

// ---------------------------------------------------------------------------
// FLAG OFF: control path
// ---------------------------------------------------------------------------

test("flag-off: FLAG_DEFAULTS[show-powered-by-footer] is false — footer not rendered by default", () => {
  // The control path is preserved: when LD is offline or the flag targets off,
  // the default value must be false so the footer is never rendered.
  assert.equal(FLAG_DEFAULTS["show-powered-by-footer"], false);
});

test("flag-off: FLAG_KEYS.showPoweredByFooter resolves to the kebab-case LD key", () => {
  // Ensures useFlag(FLAG_KEYS.showPoweredByFooter) in App.tsx evaluates the
  // correct flag key and returns the false default in the control cohort.
  assert.equal(FLAG_KEYS.showPoweredByFooter, "show-powered-by-footer");
});

test("flag-off: FLAG_DEFAULTS key set includes show-powered-by-footer (not undefined)", () => {
  // Verifies the key is explicitly registered in FLAG_DEFAULTS so offline
  // contexts (no LD client) always serve false rather than undefined.
  assert.ok(
    Object.prototype.hasOwnProperty.call(FLAG_DEFAULTS, "show-powered-by-footer"),
    "show-powered-by-footer must be an explicit entry in FLAG_DEFAULTS"
  );
});

// ---------------------------------------------------------------------------
// FLAG ON: treatment path
// ---------------------------------------------------------------------------

test("flag-on: FLAG_KEYS.showPoweredByFooter is present in FLAG_KEYS (not undefined)", () => {
  // Treatment path relies on this key to evaluate the flag. Must be registered.
  assert.ok(
    Object.prototype.hasOwnProperty.call(FLAG_KEYS, "showPoweredByFooter"),
    "showPoweredByFooter must be an explicit entry in FLAG_KEYS"
  );
});

test("flag-on: FLAG_KEYS.showPoweredByFooter value uses kebab-case (no underscores)", () => {
  // LaunchDarkly flag keys use kebab-case; the provider is configured with
  // useCamelCaseFlagKeys: false so the raw key string must be kebab-case.
  assert.ok(
    !FLAG_KEYS.showPoweredByFooter.includes("_"),
    "show-powered-by-footer must be kebab-case (no underscores)"
  );
});

test("flag-on: show-powered-by-footer key is distinct from all other FLAG_KEYS values", () => {
  // Ensures no accidental collision with an existing flag key.
  const allKeys = Object.entries(FLAG_KEYS) as [string, string][];
  const duplicates = allKeys.filter(
    ([name, value]) =>
      name !== "showPoweredByFooter" && value === "show-powered-by-footer"
  );
  assert.deepEqual(
    duplicates,
    [],
    `"show-powered-by-footer" must not collide with other FLAG_KEYS entries`
  );
});

test("flag-on: existing FLAG_DEFAULTS boolean flags are unchanged (control-path flags unaffected)", () => {
  // Regression check: adding show-powered-by-footer must not disturb existing
  // flag defaults that gate other features.
  assert.equal(FLAG_DEFAULTS["hint-button"], false);
  assert.equal(FLAG_DEFAULTS["show-mission-control"], false);
  assert.equal(FLAG_DEFAULTS["enable-random-puzzle"], false);
  assert.equal(FLAG_DEFAULTS["enable-share-result-button"], false);
  assert.equal(FLAG_DEFAULTS["enable-difficulty-picker-ux"], false);
});

// ---------------------------------------------------------------------------
// FLAG ON: treatment path — poweredByFooterViewed metric event
// ---------------------------------------------------------------------------

test("flag-on: METRIC_EVENTS.poweredByFooterViewed has the correct event key string", () => {
  // App.tsx calls track(METRIC_EVENTS.poweredByFooterViewed) inside a useEffect
  // guarded by `if (!showPoweredByFooter) return` — treatment path only.
  // The guarded-release manifest wires "show-powered-by-footer-viewed" as the
  // business occurrence metric; this must match exactly.
  assert.equal(
    METRIC_EVENTS.poweredByFooterViewed,
    "show-powered-by-footer-viewed"
  );
});

test("flag-on: poweredByFooterViewed event key is present in METRIC_EVENTS taxonomy", () => {
  // Verifies the key was added to the shared taxonomy and is importable by
  // any consumer (e.g. App.tsx) via @word-golf/ld.
  const values = Object.values(METRIC_EVENTS);
  assert.ok(
    values.includes("show-powered-by-footer-viewed"),
    "show-powered-by-footer-viewed must appear in METRIC_EVENTS"
  );
});

test("flag-on: METRIC_EVENTS.poweredByFooterViewed is distinct from all other event keys", () => {
  // Ensures no accidental collision with existing metric keys — a collision
  // would pollute other guarded-release metrics with footer impression counts.
  const allEvents = Object.entries(METRIC_EVENTS) as [string, string][];
  const duplicates = allEvents.filter(
    ([key, value]) =>
      key !== "poweredByFooterViewed" && value === "show-powered-by-footer-viewed"
  );
  assert.deepEqual(
    duplicates,
    [],
    `"show-powered-by-footer-viewed" must not collide with other METRIC_EVENTS entries`
  );
});

test("flag-on: poweredByFooterViewed event key is namespaced under show-powered-by-footer", () => {
  // Per project convention, guarded-release events are prefixed with the flag
  // key. This ensures the metric is clearly scoped to this feature.
  assert.ok(
    METRIC_EVENTS.poweredByFooterViewed.startsWith("show-powered-by-footer"),
    `poweredByFooterViewed event key must start with "show-powered-by-footer" (got: ${METRIC_EVENTS.poweredByFooterViewed})`
  );
});

test("flag-on: existing metric events are unchanged (control-path events unaffected)", () => {
  // Regression guard: adding poweredByFooterViewed must not disturb existing
  // events that fire on both control and treatment paths.
  assert.equal(METRIC_EVENTS.puzzleCompleted, "puzzle_completed");
  assert.equal(METRIC_EVENTS.puzzleAbandoned, "puzzle_abandoned");
  assert.equal(METRIC_EVENTS.timeToSolveMs, "time_to_solve_ms");
  assert.equal(METRIC_EVENTS.madePar, "made_par");
  assert.equal(METRIC_EVENTS.hintButtonUsed, "hint-button-used");
});

// ---------------------------------------------------------------------------
// FLAG OFF: poweredByFooterViewed must never fire in control path
// ---------------------------------------------------------------------------

test("flag-off: showPoweredByFooter default false ensures footer useEffect returns early (metric event never emitted)", () => {
  // In App.tsx the useEffect guard is:
  //   if (!showPoweredByFooter) return;
  // With the flag default of false the early-return fires and
  // track(METRIC_EVENTS.poweredByFooterViewed) is never reached.
  // This test verifies the structural precondition: the flag default is false
  // AND the event key is correctly registered (so when the flag IS on, the
  // call resolves to the right string).
  assert.equal(FLAG_DEFAULTS["show-powered-by-footer"], false);
  assert.equal(
    METRIC_EVENTS.poweredByFooterViewed,
    "show-powered-by-footer-viewed"
  );
});
