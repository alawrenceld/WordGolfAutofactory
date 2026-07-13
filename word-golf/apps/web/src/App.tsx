import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  makeDailyPuzzle,
  makeRandomPuzzle,
  neighbors,
  scoreLabel,
  utcDateString,
  validateMove,
  WORD_LENGTH,
  type MoveRejection,
  type Puzzle,
  type WordGraph,
} from "@word-golf/engine";
import { FLAG_KEYS, METRIC_EVENTS, useFlag, useTrack } from "@word-golf/ld";
import { graph, startPool, targetPool } from "./words.js";

const REJECTION_COPY: Record<MoveRejection, string> = {
  "wrong-length": `Use exactly ${WORD_LENGTH} letters.`,
  "no-change": "Change exactly one letter.",
  "too-many-changes": "Only one letter may change per move.",
  "not-a-word": "Not a valid word — reverting to the last good word.",
};

interface Feedback {
  kind: "info" | "error";
  text: string;
}

export function App() {
  const today = utcDateString();
  const track = useTrack();
  const showMissionControl = useFlag(FLAG_KEYS.showMissionControl);
  const enableRandomPuzzle = useFlag(FLAG_KEYS.enableRandomPuzzle);
  const showHintButton = useFlag(FLAG_KEYS.hintButton);

  // The active puzzle is stateful so players can switch between the shared
  // daily and one-off random "practice" puzzles.
  // When the flag is off this always stays on the daily puzzle (control path).
  const [puzzle, setPuzzle] = useState<Puzzle>(() =>
    makeDailyPuzzle({ dateUtc: today, startPool, graph, steps: 6, targetPool })
  );
  // isDaily is only meaningful when enableRandomPuzzle is on; defaults true.
  const [isDaily, setIsDaily] = useState(true);

  const [path, setPath] = useState<string[]>([puzzle.start]);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const current = path[path.length - 1];
  const moves = path.length - 1;
  const won = current === puzzle.target;
  const par = puzzle.par ?? moves;

  // Timing + once-only guards for metric events.
  const startTimeRef = useRef(Date.now());
  const lastMoveRef = useRef(Date.now());
  const completedRef = useRef(false);

  // Business + latency: fire once when the puzzle is solved.
  useEffect(() => {
    if (!won || completedRef.current) return;
    completedRef.current = true;
    track(METRIC_EVENTS.puzzleCompleted, { data: { moves, par } });
    track(METRIC_EVENTS.timeToSolveMs, {
      value: Date.now() - startTimeRef.current,
    });
    if (moves <= par) track(METRIC_EVENTS.madePar, { data: { moves, par } });
  }, [won, moves, par, track]);

  // Error: count an abandon if the player leaves mid-puzzle after moving.
  const wonRef = useRef(won);
  const movesRef = useRef(moves);
  wonRef.current = won;
  movesRef.current = moves;
  useEffect(() => {
    const onLeave = () => {
      if (!wonRef.current && movesRef.current > 0) {
        track(METRIC_EVENTS.puzzleAbandoned, {
          data: { moves: movesRef.current },
        });
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [track]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (won) return;
    const result = validateMove(current, input, graph);
    if (!result.ok) {
      track(METRIC_EVENTS.invalidMove, { data: { reason: result.reason } });
      setFeedback({ kind: "error", text: REJECTION_COPY[result.reason] });
      setInput("");
      return;
    }
    const now = Date.now();
    track(METRIC_EVENTS.moveLatencyMs, { value: now - lastMoveRef.current });
    lastMoveRef.current = now;
    const nextPath = [...path, result.word];
    setPath(nextPath);
    setInput("");
    if (result.word === puzzle.target) {
      setFeedback({ kind: "info", text: "Solved!" });
    } else {
      setFeedback(null);
    }
  }

  function undo() {
    if (path.length <= 1) return;
    setPath(path.slice(0, -1));
    setFeedback({ kind: "info", text: "Reverted to the previous word." });
  }

  function hint() {
    if (won) return;
    // Track hint usage for the guarded-release metric (occurrence only).
    // Wrapped in try/catch so a tracking failure can never break the button.
    try {
      track(METRIC_EVENTS.hintButtonUsed);
    } catch {
      // intentionally swallowed — telemetry must not affect gameplay
    }
    const step = firstStepToward(current, puzzle.target, graph);
    if (!step) {
      setFeedback({ kind: "info", text: "No hint available from here." });
      return;
    }
    setFeedback({ kind: "info", text: `Try a word like "${step}".` });
  }

  function reset() {
    setPath([puzzle.start]);
    setInput("");
    setFeedback(null);
    startTimeRef.current = Date.now();
    lastMoveRef.current = Date.now();
    completedRef.current = false;
  }

  // Swap in a fresh puzzle and reset all per-puzzle state (board + metric guards).
  function startPuzzle(next: Puzzle, daily: boolean) {
    setPuzzle(next);
    setIsDaily(daily);
    setPath([next.start]);
    setInput("");
    setFeedback(null);
    startTimeRef.current = Date.now();
    lastMoveRef.current = Date.now();
    completedRef.current = false;
  }

  function newRandomPuzzle() {
    startPuzzle(
      makeRandomPuzzle({ startPool, graph, steps: 6, targetPool }),
      false
    );
  }

  function backToDaily() {
    startPuzzle(
      makeDailyPuzzle({ dateUtc: today, startPool, graph, steps: 6, targetPool }),
      true
    );
  }

  return (
    <main className="app">
      <header className="header">
        <h1>Word Golf</h1>
        <p className="tagline">
          Turn the starting word into the target word, one letter at a time.
          Every step must be a real word — anything else reverts to the last
          good word.
        </p>
      </header>

      <section className="goal">
        <WordChip label="Start" word={puzzle.start} />
        <span className="arrow" aria-hidden>
          →
        </span>
        <WordChip label="Target" word={puzzle.target} tone="target" />
      </section>

      <section className="scoreboard">
        <Stat label="Moves" value={String(moves)} />
        <Stat label="Par" value={puzzle.par === null ? "\u2014" : String(puzzle.par)} />
        <Stat
          label={enableRandomPuzzle && !isDaily ? "Practice" : "Daily"}
          value={enableRandomPuzzle && !isDaily ? "Random" : today}
        />
      </section>

      {enableRandomPuzzle && (
        <section className="puzzle-actions">
          <button type="button" onClick={newRandomPuzzle}>
            Random puzzle
          </button>
          {!isDaily && (
            <button type="button" className="link" onClick={backToDaily}>
              Back to today's daily
            </button>
          )}
        </section>
      )}

      <ol className="track" aria-label="Move history">
        {path.map((word, i) => (
          <li
            key={`${word}-${i}`}
            className={`row ${word === puzzle.target ? "row-target" : ""}`}
          >
            {word.split("").map((ch, j) => (
              <span
                key={j}
                className={`tile ${ch !== puzzle.target[j] ? "tile-off" : "tile-on"}`}
              >
                {ch}
              </span>
            ))}
          </li>
        ))}
      </ol>

      {won ? (
        <section className="win">
          <h2>
            {scoreLabel(moves, par)} — solved in {moves}
            {puzzle.par !== null ? ` (par ${puzzle.par})` : ""}
          </h2>
          <button type="button" onClick={reset}>
            Play again
          </button>
        </section>
      ) : (
        <form className="controls" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) =>
              setInput(
                e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, WORD_LENGTH)
              )
            }
            placeholder={`${WORD_LENGTH}-letter word`}
            aria-label="Your next word"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">Play</button>
          <button type="button" onClick={undo} disabled={path.length <= 1}>
            Undo
          </button>
          {showHintButton && (
            <button type="button" onClick={hint}>
              Hint
            </button>
          )}
        </form>
      )}

      {feedback && (
        <p
          className={`feedback feedback-${feedback.kind}`}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.text}
        </p>
      )}

      {/* Flag-evaluation seam: gated by the `show-mission-control` flag. The
          AutoFactory can flip this in LaunchDarkly; the real panel arrives in a
          later phase. */}
      {showMissionControl && (
        <footer className="mission-control-stub">
          Mission Control — coming soon
        </footer>
      )}
    </main>
  );
}

/**
 * First word along a shortest path from `from` to `target` (the move a player
 * should make next), or null when the target is unreachable. Breadth-first so
 * the suggested step always lies on an optimal route.
 */
function firstStepToward(
  from: string,
  target: string,
  graph: WordGraph
): string | null {
  if (from === target) return null;
  const parent = new Map<string, string>();
  const visited = new Set<string>([from]);
  let frontier: string[] = [from];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const word of frontier) {
      for (const w of neighbors(word, graph)) {
        if (visited.has(w)) continue;
        visited.add(w);
        parent.set(w, word);
        if (w === target) {
          let step = w;
          for (let prev = parent.get(step); prev && prev !== from; prev = parent.get(step)) {
            step = prev;
          }
          return step;
        }
        next.push(w);
      }
    }
    frontier = next;
  }
  return null;
}

function WordChip({
  label,
  word,
  tone,
}: {
  label: string;
  word: string;
  tone?: "target";
}) {
  return (
    <div className={`chip ${tone === "target" ? "chip-target" : ""}`}>
      <span className="chip-label">{label}</span>
      <span className="chip-word">{word}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
