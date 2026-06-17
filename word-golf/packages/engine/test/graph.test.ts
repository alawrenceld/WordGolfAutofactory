import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWordGraph, neighbors, isValidWord } from "../src/graph.js";

test("neighbors share exactly one differing position", () => {
  const g = buildWordGraph([
    "match",
    "patch",
    "march",
    "marsh",
    "mulch",
    "lunch",
  ]);
  const n = neighbors("match", g).sort();
  assert.deepEqual(n, ["march", "patch"]);
});

test("a word is not its own neighbor", () => {
  const g = buildWordGraph(["abcde", "abcdf"]);
  assert.deepEqual(neighbors("abcde", g), ["abcdf"]);
});

test("isValidWord reflects membership", () => {
  const g = buildWordGraph(["apple", "amble"]);
  assert.equal(isValidWord("apple", g), true);
  assert.equal(isValidWord("zzzzz", g), false);
});

test("isolated word has no neighbors", () => {
  const g = buildWordGraph(["aaaaa", "bbbbb"]);
  assert.deepEqual(neighbors("aaaaa", g), []);
});
