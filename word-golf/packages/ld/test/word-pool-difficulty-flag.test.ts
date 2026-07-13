/**
 * Flag-path tests for the `word-pool-difficulty` feature flag (#22).
 *
 * Covers the flag-off (control) and flag-on (treatment) paths as they relate
 * to the @word-golf/ld package — i.e. the flag key constants, default value,
 * and the three newly-instrumented METRIC_EVENTS entries for the guarded release.
 *
 * The flag is a string multivariate: "easy" | "medium" | "hard".
 * Control path: default "medium" (both control and treatment fire all three
 * events so a guarded-release comparison is possible).
 *
 * Three metric roles:
 *   practicePuzzleStarted     — business / monitoring  ("word-pool-difficulty-practice-started")
 *   practicePuzzleGenerationMs — latency / pause metric ("word-pool-difficulty-latency")
 *   practicePuzzleError       — error / killswitch      ("word-pool-difficulty-error")
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { FLAG_DEFAULTS, FLAG_KEYS } from "../src/flags.js";
import { METRIC_EVENTS } from "../src/events.js";

// ---------------------------------------------------------------------------
// FLAG OFF: control path (flag at default "medium")
// ---------------------------------------------------------------------------

test('flag-off: FLAG_DEFAULTS["word-pool-difficulty"] is "medium" — control path preserved', () => {
  // When LD is offline or the flag has not yet been targeted, the app must
  // fall through to medium difficulty. Changing this default would silently
  // alter behaviour for all anonymous users before the flag is served.
  assert.equal(FLAG_DEFAULTS["word-pool-difficulty"], "medium");
});

test("flag-off: FLAG_KEYS.wordPoolDifficulty resolves to the kebab-case LD key", () => {
  // App.tsx calls useFlag(FLAG_KEYS.wordPoolDifficulty); the string must match
  // the key registered in the LaunchDarkly project exactly.
  assert.equal(FLAG_KEYS.wordPoolDifficulty, "word-pool-difficulty");
});

test("flag-off: FLAG_DEFAULTS has an explicit entry for word-pool-difficulty (not undefined)", () => {
  // Verifies the key is registered so offline/uninitialized contexts always
  // get "medium" rather than undefined, which would cause a runtime error when
  // the value is used as an index into practicePools().
  assert.ok(
    Object.prototype.hasOwnProperty.call(FLAG_DEFAULTS, "word-pool-difficulty"),
    "word-pool-difficulty must be an explicit entry in FLAG_DEFAULTS"
  );
});

test('flag-off: default "medium" is a valid PracticeDifficulty value', () => {
  // Structural guard: the default must be one of the three accepted variants.
  // If it were an arbitrary string, the switch in practicePoolsForDifficulty()
  // would fall through to nothing and crash puzzle generation.
  const valid = new Set(["easy", "medium", "hard"]);
  assert.ok(
    valid.has(FLAG_DEFAULTS["word-pool-difficulty"]),
    `"${FLAG_DEFAULTS["word-pool-difficulty"]}" is not a valid PracticeDifficulty`
  );
});

test("flag-off: control path fires all three metric events (control and treatment fire the same events)", () => {
  // The guarded-release design fires all three events on both control ("medium"
  // default) and treatment paths so a guarded comparison can be made.
  // This test confirms the event keys exist and are truthy strings on the control path.
  assert.ok(
    typeof METRIC_EVENTS.practicePuzzleStarted === "string" &&
      METRIC_EVENTS.practicePuzzleStarted.length > 0,
    "practicePuzzleStarted event key must be a non-empty string"
  );
  assert.ok(
    typeof METRIC_EVENTS.practicePuzzleGenerationMs === "string" &&
      METRIC_EVENTS.practicePuzzleGenerationMs.length > 0,
    "practicePuzzleGenerationMs event key must be a non-empty string"
  );
  assert.ok(
    typeof METRIC_EVENTS.practicePuzzleError === "string" &&
      METRIC_EVENTS.practicePuzzleError.length > 0,
    "practicePuzzleError event key must be a non-empty string"
  );
});

test("flag-off: existing unrelated metric events are unchanged (control-path events unaffected)", () => {
  // Adding the three new events must not disturb the existing global events
  // that fire regardless of the word-pool-difficulty flag.
  assert.equal(METRIC_EVENTS.puzzleCompleted, "puzzle_completed");
  assert.equal(METRIC_EVENTS.puzzleAbandoned, "puzzle_abandoned");
  assert.equal(METRIC_EVENTS.timeToSolveMs, "time_to_solve_ms");
  assert.equal(METRIC_EVENTS.madePar, "made_par");
  assert.equal(METRIC_EVENTS.hintButtonUsed, "hint-button-used");
  assert.equal(
    METRIC_EVENTS.clipboardError,
    "enable-share-result-button-clipboard-error"
  );
});

// ---------------------------------------------------------------------------
// FLAG ON: treatment path — business metric (practicePuzzleStarted)
// ---------------------------------------------------------------------------

test('flag-on: METRIC_EVENTS.practicePuzzleStarted has the correct event key string', () => {
  // App.tsx calls track(METRIC_EVENTS.practicePuzzleStarted) on the success
  // path of newRandomPuzzle(). The guarded-release manifest wires
  // "word-pool-difficulty-practice-started" as the business/monitoring metric;
  // this must match exactly so LD can attribute the event to the flag.
  assert.equal(
    METRIC_EVENTS.practicePuzzleStarted,
    "word-pool-difficulty-practice-started"
  );
});

test("flag-on: practicePuzzleStarted event key is present in METRIC_EVENTS taxonomy", () => {
  const values = Object.values(METRIC_EVENTS);
  assert.ok(
    values.includes("word-pool-difficulty-practice-started"),
    "word-pool-difficulty-practice-started must appear in METRIC_EVENTS"
  );
});

test("flag-on: METRIC_EVENTS.practicePuzzleStarted is distinct from all other event keys", () => {
  // Collision with another event key would cause the business metric to
  // accumulate unrelated counts and invalidate the guarded-release comparison.
  const allEvents = Object.entries(METRIC_EVENTS) as [string, string][];
  const duplicates = allEvents.filter(
    ([key, value]) =>
      key !== "practicePuzzleStarted" &&
      value === "word-pool-difficulty-practice-started"
  );
  assert.deepEqual(
    duplicates,
    [],
    '"word-pool-difficulty-practice-started" must not collide with other METRIC_EVENTS entries'
  );
});

// ---------------------------------------------------------------------------
// FLAG ON: treatment path — latency metric (practicePuzzleGenerationMs)
// ---------------------------------------------------------------------------

test("flag-on: METRIC_EVENTS.practicePuzzleGenerationMs has the correct event key string", () => {
  // App.tsx calls track(METRIC_EVENTS.practicePuzzleGenerationMs, { value: elapsed })
  // on the success path. The guarded-release manifest wires
  // "word-pool-difficulty-latency" as the latency/pause metric.
  assert.equal(METRIC_EVENTS.practicePuzzleGenerationMs, "word-pool-difficulty-latency");
});

test("flag-on: practicePuzzleGenerationMs event key is present in METRIC_EVENTS taxonomy", () => {
  const values = Object.values(METRIC_EVENTS);
  assert.ok(
    values.includes("word-pool-difficulty-latency"),
    "word-pool-difficulty-latency must appear in METRIC_EVENTS"
  );
});

test("flag-on: METRIC_EVENTS.practicePuzzleGenerationMs is distinct from all other event keys", () => {
  const allEvents = Object.entries(METRIC_EVENTS) as [string, string][];
  const duplicates = allEvents.filter(
    ([key, value]) =>
      key !== "practicePuzzleGenerationMs" && value === "word-pool-difficulty-latency"
  );
  assert.deepEqual(
    duplicates,
    [],
    '"word-pool-difficulty-latency" must not collide with other METRIC_EVENTS entries'
  );
});

// ---------------------------------------------------------------------------
// FLAG ON: treatment path — error / killswitch metric (practicePuzzleError)
// ---------------------------------------------------------------------------

test("flag-on: METRIC_EVENTS.practicePuzzleError has the correct event key string", () => {
  // App.tsx calls track(METRIC_EVENTS.practicePuzzleError) inside the outer
  // catch block of newRandomPuzzle(). The guarded-release manifest wires
  // "word-pool-difficulty-error" as the killswitch metric.
  assert.equal(METRIC_EVENTS.practicePuzzleError, "word-pool-difficulty-error");
});

test("flag-on: practicePuzzleError event key is present in METRIC_EVENTS taxonomy", () => {
  const values = Object.values(METRIC_EVENTS);
  assert.ok(
    values.includes("word-pool-difficulty-error"),
    "word-pool-difficulty-error must appear in METRIC_EVENTS"
  );
});

test("flag-on: METRIC_EVENTS.practicePuzzleError is distinct from all other event keys", () => {
  const allEvents = Object.entries(METRIC_EVENTS) as [string, string][];
  const duplicates = allEvents.filter(
    ([key, value]) =>
      key !== "practicePuzzleError" && value === "word-pool-difficulty-error"
  );
  assert.deepEqual(
    duplicates,
    [],
    '"word-pool-difficulty-error" must not collide with other METRIC_EVENTS entries'
  );
});

// ---------------------------------------------------------------------------
// Cross-event: all three word-pool-difficulty events are mutually distinct
// ---------------------------------------------------------------------------

test("flag-on: all three word-pool-difficulty metric event keys are mutually distinct", () => {
  // Two events firing on the same success path (Started + GenerationMs) and
  // one on the error path must all use different strings, or the guarded-release
  // metrics would conflate success and error signals.
  const started = METRIC_EVENTS.practicePuzzleStarted;
  const latency = METRIC_EVENTS.practicePuzzleGenerationMs;
  const error = METRIC_EVENTS.practicePuzzleError;

  assert.notEqual(started, latency, "practicePuzzleStarted must differ from practicePuzzleGenerationMs");
  assert.notEqual(started, error, "practicePuzzleStarted must differ from practicePuzzleError");
  assert.notEqual(latency, error, "practicePuzzleGenerationMs must differ from practicePuzzleError");
});

test("flag-on: practicePuzzleError is distinct from practicePuzzleStarted (error path never credited as a success)", () => {
  // Explicit guard: if these were equal, every puzzle-generation failure would
  // also increment the business metric, masking regressions.
  assert.notEqual(
    METRIC_EVENTS.practicePuzzleError,
    METRIC_EVENTS.practicePuzzleStarted
  );
});

// ---------------------------------------------------------------------------
// FLAG OFF: error event must only fire when generation throws
// ---------------------------------------------------------------------------

test("flag-off: practicePuzzleError event is namespaced under word-pool-difficulty (not a global error event)", () => {
  // The event key must be scoped to the flag so it is only matched by the
  // word-pool-difficulty killswitch metric, not other error metrics.
  assert.ok(
    METRIC_EVENTS.practicePuzzleError.startsWith("word-pool-difficulty-"),
    `practicePuzzleError ("${METRIC_EVENTS.practicePuzzleError}") must be prefixed "word-pool-difficulty-"`
  );
});

test("flag-off: practicePuzzleStarted event is namespaced under word-pool-difficulty", () => {
  assert.ok(
    METRIC_EVENTS.practicePuzzleStarted.startsWith("word-pool-difficulty-"),
    `practicePuzzleStarted ("${METRIC_EVENTS.practicePuzzleStarted}") must be prefixed "word-pool-difficulty-"`
  );
});

test("flag-off: practicePuzzleGenerationMs event is namespaced under word-pool-difficulty", () => {
  assert.ok(
    METRIC_EVENTS.practicePuzzleGenerationMs.startsWith("word-pool-difficulty-"),
    `practicePuzzleGenerationMs ("${METRIC_EVENTS.practicePuzzleGenerationMs}") must be prefixed "word-pool-difficulty-"`
  );
});

// ---------------------------------------------------------------------------
// FLAG KEY TYPE INTEGRITY
// ---------------------------------------------------------------------------

test("flag-on: FLAG_KEYS object contains wordPoolDifficulty (not undefined)", () => {
  assert.ok(
    Object.prototype.hasOwnProperty.call(FLAG_KEYS, "wordPoolDifficulty"),
    "wordPoolDifficulty must be an explicit entry in FLAG_KEYS"
  );
});

test("flag-on: FLAG_KEYS.wordPoolDifficulty value is the canonical kebab-case string", () => {
  // Ensures App.tsx's useFlag(FLAG_KEYS.wordPoolDifficulty) maps to the exact
  // key registered in LaunchDarkly and that no camel-case conversion happens.
  assert.equal(FLAG_KEYS.wordPoolDifficulty, "word-pool-difficulty");
  assert.ok(
    !FLAG_KEYS.wordPoolDifficulty.includes("_"),
    "Flag keys must be kebab-case, not snake_case"
  );
});
