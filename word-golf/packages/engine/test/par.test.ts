import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWordGraph } from "../src/graph.js";
import { bfsPar } from "../src/par.js";

test("par is 0 when start equals target", () => {
  const g = buildWordGraph(["abcde"]);
  assert.equal(bfsPar("abcde", "abcde", g), 0);
});

test("par counts single-letter-change moves on a known chain", () => {
  // match -> march -> marsh : two moves.
  const g = buildWordGraph(["match", "march", "marsh", "patch"]);
  assert.equal(bfsPar("match", "marsh", g), 2);
  assert.equal(bfsPar("match", "march", g), 1);
});

test("par finds the shortest of multiple paths", () => {
  // Direct one-move edge exists alongside a longer detour.
  const g = buildWordGraph(["stare", "store", "stork", "stark", "scare"]);
  assert.equal(bfsPar("stare", "store", g), 1);
});

test("unreachable target returns null", () => {
  const g = buildWordGraph(["aaaaa", "bbbbb"]);
  assert.equal(bfsPar("aaaaa", "bbbbb", g), null);
});

test("missing endpoints return null", () => {
  const g = buildWordGraph(["aaaaa"]);
  assert.equal(bfsPar("aaaaa", "zzzzz", g), null);
  assert.equal(bfsPar("zzzzz", "aaaaa", g), null);
});
