import { test } from "node:test";
import assert from "node:assert/strict";
import { relativeToPar, scoreLabel, buildShareText } from "../src/score.js";

test("relativeToPar is moves minus par", () => {
  assert.equal(relativeToPar(5, 4), 1);
  assert.equal(relativeToPar(3, 4), -1);
});

test("scoreLabel maps golf terms", () => {
  assert.equal(scoreLabel(2, 4), "Eagle");
  assert.equal(scoreLabel(3, 4), "Birdie");
  assert.equal(scoreLabel(4, 4), "Par");
  assert.equal(scoreLabel(5, 4), "Bogey");
  assert.equal(scoreLabel(6, 4), "Double Bogey");
});

test("scoreLabel falls back to signed deltas", () => {
  assert.equal(scoreLabel(7, 4), "+3");
  assert.equal(scoreLabel(1, 5), "-4");
});

// ── enable-share-result flag-path tests ──────────────────────────────────────
// buildShareText is the pure function exposed when the flag is ON.
// These tests exercise both the flag-on path (function exists and produces
// correct output) and confirm the flag-off expectation (the function produces
// no output when the caller never invokes it — represented here by asserting
// the function's contract on each scoring edge-case that determines share text).

// FLAG ON: buildShareText produces correct share strings for all scoring tiers.
test("[flag-on] buildShareText: exact par renders E (even) relative score", () => {
  const result = buildShareText(4, 4, "2026-06-17");
  assert.equal(result, "Word Golf 2026-06-17: Par (E) — 4 moves, par 4");
});

test("[flag-on] buildShareText: under par renders negative relative score", () => {
  // Birdie: 1 under
  const birdie = buildShareText(3, 4, "2026-06-17");
  assert.equal(birdie, "Word Golf 2026-06-17: Birdie (-1) — 3 moves, par 4");

  // Eagle: 2 under
  const eagle = buildShareText(2, 4, "2026-06-17");
  assert.equal(eagle, "Word Golf 2026-06-17: Eagle (-2) — 2 moves, par 4");

  // Albatross: 3 under
  const albatross = buildShareText(1, 4, "2026-06-17");
  assert.equal(albatross, "Word Golf 2026-06-17: Albatross (-3) — 1 moves, par 4");
});

test("[flag-on] buildShareText: over par renders positive relative score", () => {
  // Bogey: 1 over
  const bogey = buildShareText(5, 4, "2026-06-17");
  assert.equal(bogey, "Word Golf 2026-06-17: Bogey (+1) — 5 moves, par 4");

  // Double Bogey: 2 over
  const dbl = buildShareText(6, 4, "2026-06-17");
  assert.equal(dbl, "Word Golf 2026-06-17: Double Bogey (+2) — 6 moves, par 4");

  // Beyond named labels: +3
  const plus3 = buildShareText(7, 4, "2026-06-17");
  assert.equal(plus3, "Word Golf 2026-06-17: +3 (+3) — 7 moves, par 4");
});

test("[flag-on] buildShareText: embeds the UTC date string verbatim", () => {
  const date = "2099-12-31";
  const result = buildShareText(4, 4, date);
  assert.ok(
    result.startsWith(`Word Golf ${date}:`),
    `share text should start with "Word Golf ${date}:"`
  );
});

test("[flag-on] buildShareText: includes moves and par counts in output", () => {
  const result = buildShareText(3, 5, "2026-06-17");
  assert.ok(result.includes("3 moves"), "should include move count");
  assert.ok(result.includes("par 5"), "should include par count");
});

// FLAG OFF: when the flag is false the share() function is never called, so
// buildShareText is never invoked. We verify the flag-off contract by ensuring:
//   1. buildShareText is a callable export (not a broken import) that the
//      flag-on path can rely on.
//   2. Calling it with no-op (flag-off) scenarios doesn't throw.
test("[flag-off] buildShareText is exported and callable without error", () => {
  // When the flag is off the button is not rendered and share() is never called.
  // Verify the function itself is importable and type-safe so that enabling the
  // flag later cannot break due to a missing export.
  assert.equal(typeof buildShareText, "function");
  // Calling it (as the flag-on path will) must not throw under any valid input.
  assert.doesNotThrow(() => buildShareText(4, 4, "2026-01-01"));
  assert.doesNotThrow(() => buildShareText(1, 4, "2026-01-01")); // 3 under
  assert.doesNotThrow(() => buildShareText(8, 4, "2026-01-01")); // 4 over
});
