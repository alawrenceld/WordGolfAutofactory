/**
 * Flag-path tests for the `enable-difficulty-picker-ux` feature flag (#23).
 *
 * Covers flag-off (control) and flag-on (treatment) paths as they relate to
 * the @word-golf/ld package — flag default, key constants, and the shared
 * practice-puzzle metric events reused by this UX flag.
 *
 * Control (false): difficulty seeded from word-pool-difficulty; Random works
 * immediately. Treatment (true): difficulty starts unset; Random requires an
 * explicit Easy/Medium/Hard pick (React rendering has no harness here).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { FLAG_DEFAULTS, FLAG_KEYS } from "../src/flags.js";
import { METRIC_EVENTS } from "../src/events.js";

// ---------------------------------------------------------------------------
// FLAG OFF: control path
// ---------------------------------------------------------------------------

test("flag-off: FLAG_DEFAULTS[enable-difficulty-picker-ux] is false — original seeded UX", () => {
  assert.equal(FLAG_DEFAULTS["enable-difficulty-picker-ux"], false);
});

test("flag-off: FLAG_KEYS.enableDifficultyPickerUx resolves to the kebab-case LD key", () => {
  assert.equal(FLAG_KEYS.enableDifficultyPickerUx, "enable-difficulty-picker-ux");
});

test("flag-off: FLAG_DEFAULTS has an explicit entry for enable-difficulty-picker-ux", () => {
  assert.ok(
    Object.prototype.hasOwnProperty.call(FLAG_DEFAULTS, "enable-difficulty-picker-ux"),
    "enable-difficulty-picker-ux must be an explicit entry in FLAG_DEFAULTS"
  );
});

// ---------------------------------------------------------------------------
// FLAG ON: treatment path — reused practice metrics
// ---------------------------------------------------------------------------

test("flag-on: practicePuzzleStarted event key matches guarded-release business metric", () => {
  assert.equal(
    METRIC_EVENTS.practicePuzzleStarted,
    "word-pool-difficulty-practice-started"
  );
});

test("flag-on: practice metrics remain mutually distinct", () => {
  assert.notEqual(
    METRIC_EVENTS.practicePuzzleStarted,
    METRIC_EVENTS.practicePuzzleGenerationMs
  );
  assert.notEqual(
    METRIC_EVENTS.practicePuzzleStarted,
    METRIC_EVENTS.practicePuzzleError
  );
  assert.notEqual(
    METRIC_EVENTS.practicePuzzleGenerationMs,
    METRIC_EVENTS.practicePuzzleError
  );
});

test("flag-on: FLAG_KEYS.enableDifficultyPickerUx is distinct from wordPoolDifficulty", () => {
  assert.notEqual(
    FLAG_KEYS.enableDifficultyPickerUx,
    FLAG_KEYS.wordPoolDifficulty
  );
});
