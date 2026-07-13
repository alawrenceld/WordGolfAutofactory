/**
 * Flag-path tests for the `show-powered-by-footer` feature flag (#25).
 *
 * Covers the flag-off (control) and flag-on (treatment) paths as they relate
 * to the @word-golf/ld package — i.e. the flag default and flag key constants.
 *
 * Control path (flag off): no "Powered by LaunchDarkly" footer is rendered —
 * existing behavior is preserved exactly.
 * Treatment path (flag on): the footer with CodeControl, AgentControl, and
 * Software Factory Reference Design links is rendered.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { FLAG_DEFAULTS, FLAG_KEYS } from "../src/flags.js";

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
