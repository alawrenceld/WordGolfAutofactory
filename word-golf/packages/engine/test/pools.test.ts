import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePracticeDifficulty,
  practicePoolsForDifficulty,
} from "../src/pools.js";

test("normalizePracticeDifficulty falls back to medium for invalid values", () => {
  assert.equal(normalizePracticeDifficulty("easy"), "easy");
  assert.equal(normalizePracticeDifficulty("bogus"), "medium");
  assert.equal(normalizePracticeDifficulty(true), "medium");
  assert.equal(normalizePracticeDifficulty(undefined), "medium");
  assert.equal(normalizePracticeDifficulty(null), "medium");
});

test("practicePoolsForDifficulty never returns undefined for invalid difficulty", () => {
  const answers = ["aaaaa"];
  const common = ["bbbbb"];
  const difficult = ["ccccc"];
  const pools = practicePoolsForDifficulty(
    true as unknown as "easy",
    answers,
    common,
    difficult
  );
  assert.ok(pools);
  assert.equal(pools.startPool.length, 1);
  assert.equal(pools.minPar, 4);
});
