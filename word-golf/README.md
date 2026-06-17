# Word Golf

A tiny, replayable word puzzle: turn one word into another, one letter at a time. Each move must change exactly one letter and form a valid word. An invalid move bounces back to the last good word -- the rollback metaphor at the heart of the LaunchDarkly AutoFactory showcase.

> **Built to run on the [LaunchDarkly AutoFactory](https://github.com/alawrenceld/launchdarkly-auto-factory).**
> The AutoFactory is the autonomous, metric-guarded release pipeline this game is a showcase for: a chain of AI agents flags a PR, instruments metrics, writes tests, and runs guarded releases that auto-roll-back on regression. Word Golf is the demo payload it operates on. Eventually the factory components will be merged into this repo so Word Golf works as a self-contained AutoFactory; for now, see the upstream repo to set up the pipeline.

This repo is built in phases (see the project `plan.md`). **Phase 0** is the playable core: a tested game engine plus a minimal Daily-mode UI. No LaunchDarkly integration yet.

## Layout

```
word-golf/
  packages/engine/   # pure TS: word graph, BFS par, move validation, scoring, daily generation
  apps/web/          # Vite + React + TS game UI
  data/              # bundled word lists (see below)
```

## Word data

`data/` holds four lists. Every file has a leading `#` comment line that loaders skip.

| File | Count | Role |
|------|-------|------|
| `combined_wordlist.txt` | ~12,972 | validity set + graph nodes (backs `isValidWord` and adjacency) |
| `shuffled_real_wordles.txt` | ~2,315 | answers pool (daily start/target source) |
| `common_words.txt` | ~7,592 | frequency-ordered; biases selection toward common words |
| `difficult_words.txt` | ~127 | hard pool / engine stress-test fixture |

## Develop

```bash
npm install      # from this directory
npm test         # engine unit tests
npm run dev      # play locally
npm run build    # production build of the web app
```

Node 20+ required.
