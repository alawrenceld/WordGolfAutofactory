import { test } from "node:test";
import assert from "node:assert/strict";
import { makePracticePuzzle } from "../src/daily.js";
import { practicePoolsForDifficulty } from "../src/pools.js";
import { loadList, realGraph } from "./helpers.js";

const graph = realGraph();
const answers = loadList("shuffled_real_wordles.txt");
const common = loadList("common_words.txt");
const difficult = loadList("difficult_words.txt");

test("practicePoolsForDifficulty: easy matches daily-friendly pools", () => {
  const easy = practicePoolsForDifficulty("easy", answers, common, difficult);
  assert.equal(easy.minPar, 3);
  assert.ok(easy.startPool.length > 0);
  assert.ok(easy.targetPool.length > common.length / 2);
});

test("practicePoolsForDifficulty: medium widens starts and raises minPar", () => {
  const medium = practicePoolsForDifficulty("medium", answers, common, difficult);
  assert.equal(medium.minPar, 4);
  assert.equal(medium.startPool.length, answers.length);
});

test("practice puzzles are solvable for each difficulty", () => {
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    const pools = practicePoolsForDifficulty(difficulty, answers, common, difficult);
    const puzzle = makePracticePuzzle({
      difficulty,
      graph,
      steps: 6,
      seed: `practice-${difficulty}-smoke`,
      ...pools,
    });
    assert.notEqual(puzzle.start, puzzle.target, `${difficulty}: start==target`);
    assert.ok(
      typeof puzzle.par === "number" && puzzle.par >= 1,
      `${difficulty}: unsolvable ${puzzle.start} -> ${puzzle.target}`
    );
  }
});

test("hard practice targets are drawn from the difficult pool when possible", () => {
  const difficultSet = new Set(difficult);
  const pools = practicePoolsForDifficulty("hard", answers, common, difficult);
  let sawHardTarget = false;
  for (let i = 0; i < 20; i++) {
    const puzzle = makePracticePuzzle({
      difficulty: "hard",
      graph,
      steps: 6,
      seed: `practice-hard-${i}`,
      ...pools,
    });
    if (difficultSet.has(puzzle.target)) sawHardTarget = true;
    assert.ok(puzzle.par !== null && puzzle.par >= pools.minPar);
  }
  assert.ok(sawHardTarget, "expected at least one hard target from difficult_words");
});
