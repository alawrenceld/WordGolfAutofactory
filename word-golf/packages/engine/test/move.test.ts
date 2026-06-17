import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWordGraph } from "../src/graph.js";
import { validateMove, letterDiff } from "../src/move.js";

const g = buildWordGraph(["match", "march", "patch", "marsh"]);

test("letterDiff counts differing positions", () => {
  assert.equal(letterDiff("match", "match"), 0);
  assert.equal(letterDiff("match", "march"), 1);
  assert.equal(letterDiff("match", "marsh"), 2);
});

test("accepts a one-letter change to a valid word", () => {
  assert.deepEqual(validateMove("match", "march", g), {
    ok: true,
    word: "march",
  });
});

test("normalizes case and whitespace", () => {
  assert.deepEqual(validateMove("match", "  MARCH ", g), {
    ok: true,
    word: "march",
  });
});

test("rejects wrong length", () => {
  assert.deepEqual(validateMove("match", "marches", g), {
    ok: false,
    reason: "wrong-length",
  });
});

test("rejects an unchanged word", () => {
  assert.deepEqual(validateMove("match", "match", g), {
    ok: false,
    reason: "no-change",
  });
});

test("rejects more than one changed letter", () => {
  assert.deepEqual(validateMove("match", "marsh", g), {
    ok: false,
    reason: "too-many-changes",
  });
});

test("rejects a non-word", () => {
  assert.deepEqual(validateMove("match", "matzh", g), {
    ok: false,
    reason: "not-a-word",
  });
});
