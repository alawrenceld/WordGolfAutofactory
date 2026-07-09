import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDailyPuzzle, makeRandomPuzzle } from "../src/daily.js";
import { bfsPar } from "../src/par.js";
import { loadList, realGraph } from "./helpers.js";

const graph = realGraph();
const answers = loadList("shuffled_real_wordles.txt");
const common = loadList("common_words.txt");

test("real word lists parse to expected sizes", () => {
  // Header comment lines are stripped; counts should match the published lists.
  assert.equal(graph.words.length, 12972);
  assert.equal(answers.length, 2315);
});

test("daily puzzle is deterministic for a given date", () => {
  const a = makeDailyPuzzle({
    dateUtc: "2026-06-17",
    startPool: answers,
    graph,
    steps: 6,
  });
  const b = makeDailyPuzzle({
    dateUtc: "2026-06-17",
    startPool: answers,
    graph,
    steps: 6,
  });
  assert.deepEqual(a, b);
});

test("different dates generally yield different puzzles", () => {
  const a = makeDailyPuzzle({
    dateUtc: "2026-06-17",
    startPool: answers,
    graph,
    steps: 6,
  });
  const b = makeDailyPuzzle({
    dateUtc: "2026-06-18",
    startPool: answers,
    graph,
    steps: 6,
  });
  assert.notDeepEqual(a, b);
});

test("generated puzzles are always solvable with a finite par", () => {
  for (let day = 1; day <= 60; day++) {
    const date = `2026-06-${String(day).padStart(2, "0")}`;
    const puzzle = makeDailyPuzzle({
      dateUtc: date,
      startPool: answers,
      graph,
      steps: 6,
    });
    assert.notEqual(puzzle.start, puzzle.target, `start==target on ${date}`);
    assert.ok(
      typeof puzzle.par === "number" && puzzle.par >= 1,
      `unsolvable puzzle on ${date}: ${puzzle.start} -> ${puzzle.target}`
    );
  }
});

test("targetPool constrains the target to common words", () => {
  const commonSet = new Set(common);
  for (let day = 1; day <= 60; day++) {
    const date = `2026-07-${String(day).padStart(2, "0")}`;
    const puzzle = makeDailyPuzzle({
      dateUtc: date,
      startPool: answers,
      graph,
      steps: 6,
      targetPool: common,
    });
    assert.ok(
      commonSet.has(puzzle.target),
      `target "${puzzle.target}" not in common pool on ${date}`
    );
    assert.notEqual(puzzle.start, puzzle.target);
    assert.ok(typeof puzzle.par === "number" && puzzle.par >= 1);
  }
});

test("random puzzle with an explicit seed matches the daily generator", () => {
  const seed = "practice-abc123";
  const random = makeRandomPuzzle({ seed, startPool: answers, graph, steps: 6, targetPool: common });
  const daily = makeDailyPuzzle({ dateUtc: seed, startPool: answers, graph, steps: 6, targetPool: common });
  assert.deepEqual(random, daily);
});

test("random puzzles are solvable and respect the target pool", () => {
  const commonSet = new Set(common);
  for (let i = 0; i < 40; i++) {
    const puzzle = makeRandomPuzzle({
      seed: `practice-seed-${i}`,
      startPool: answers,
      graph,
      steps: 6,
      targetPool: common,
    });
    assert.notEqual(puzzle.start, puzzle.target, `start==target on seed ${i}`);
    assert.ok(commonSet.has(puzzle.target), `target "${puzzle.target}" not in common pool on seed ${i}`);
    assert.ok(typeof puzzle.par === "number" && puzzle.par >= 1, `unsolvable on seed ${i}`);
  }
});

test("different random seeds generally yield different puzzles", () => {
  const a = makeRandomPuzzle({ seed: "practice-A", startPool: answers, graph, steps: 6 });
  const b = makeRandomPuzzle({ seed: "practice-B", startPool: answers, graph, steps: 6 });
  assert.notDeepEqual(a, b);
});

test("stress: BFS resolves par for difficult-word pairs without hanging", () => {
  const hard = loadList("difficult_words.txt").filter((w) => graph.valid.has(w));
  assert.ok(hard.length > 0, "no difficult words found in the graph");
  // Pair consecutive hard words; par is either a finite number or null
  // (disconnected), but the search must always terminate quickly.
  for (let i = 0; i + 1 < Math.min(hard.length, 40); i++) {
    const par = bfsPar(hard[i], hard[i + 1], graph);
    assert.ok(par === null || par >= 0);
  }
});
