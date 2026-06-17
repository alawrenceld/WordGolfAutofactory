# Future work — candidates for the AutoFactory

Phase 0 ships only the playable Daily mode. The ideas below are intentionally
deferred. They are good candidates for the **LaunchDarkly AutoFactory** to ship
as guarded releases later, rather than work we do by hand now.

Per the project rule (`plan.md`): every feature must map to a flag and a metric,
or it gets cut. Each item lists its intended flag and watched metric so it can
land as a clean, single-hypothesis PR.

## Game modes

| Idea | Flag (proposed) | Watched metric | Notes |
|------|-----------------|----------------|-------|
| **Esoteric / Hard mode** — target drawn from `difficult_words.txt` | `word-pool-difficulty` (`easy`/`medium`/`hard`) | business + error (completion vs. abandon) | Generation inverts the default: pick target first, BFS outward, choose a start at distance >= minPar (the random walk is too sparse to hit 127 hard words). Engine already supports `targetPool` + `minPar`. Open choice: keep full validity set for moves vs. restrict to common words. |
| **Endless / Practice mode** — infinite random puzzles | (mode is core, not flagged) | business: volume of plays; latency | "Beat par" loop; drives metric volume for guarded releases. |
| **Speedrun mode** — timed solve | feature flag per `plan.md` | latency: `time_to_solve_ms` | Competitive replay; later phase. |

## Game changes / tuning

| Idea | Flag (proposed) | Watched metric |
|------|-----------------|----------------|
| **Hint button** | `hint-button` (bool) | business: `made_par` (a hint may raise completion but cheapen the win) |
| **Par algorithm swap** (`shortest` / `no-reuse` / `heuristic`) | `par-algorithm` (string) | business: `puzzle_completed` |
| **Daily theme** (cosmetic) | `daily-theme` (string) | business: `daily_returned` (null-hypothesis "no impact -> promote" demo) |
| **Mission Control panel toggle** | `show-mission-control` (bool) | n/a (kill switch) |

## Replayability / data (Phase 1 per plan)

- Streaks, stats, shareable spoiler-free result text.
- Local metric event stubs: `puzzle_completed`, `time_to_solve_ms`, `invalid_move`,
  `puzzle_abandoned`, `made_par`, `result_shared`, `daily_returned`.

These are tracked in detail in the top-level `plan.md` (Phases 1-5).
