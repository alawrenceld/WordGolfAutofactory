import { test } from "node:test";
import assert from "node:assert/strict";
import { relativeToPar, scoreLabel } from "../src/score.js";

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
