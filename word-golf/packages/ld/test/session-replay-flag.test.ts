/**
 * Flag-path tests for enable-session-replay — observability session replay gate.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { FLAG_DEFAULTS, FLAG_KEYS } from "../src/flags.js";

test("flag-off: enable-session-replay defaults to false", () => {
  assert.equal(FLAG_DEFAULTS["enable-session-replay"], false);
});

test("flag key: enableSessionReplay maps to kebab-case LD key", () => {
  assert.equal(FLAG_KEYS.enableSessionReplay, "enable-session-replay");
});
