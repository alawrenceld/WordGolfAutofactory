# Wiring Word Golf to the LaunchDarkly AutoFactory

This is the setup guide for connecting this repo to the
[LaunchDarkly AutoFactory](https://github.com/alawrenceld/launchdarkly-auto-factory)
so that, on every pull request, a chain of AI agents classifies the PR, creates
a feature flag (targeting off), instruments guarded-release metrics, writes
flag-on/flag-off tests, and posts a verdict.

Scope: **Phase 1** (per-PR agents) plus the app-side LaunchDarkly integration.
The Phase 2 guarded-release-on-deploy auto-rollback (Beacon) is a later
milestone and needs hosting + a deploy target.

For the design rationale (control plane vs data plane, why two projects, 1:many
topology), see [AUTOFACTORY-ARCHITECTURE.md](AUTOFACTORY-ARCHITECTURE.md).

## How it fits together

```
PR opened ──▶ .github/workflows/auto-factory.yml ──▶ phase1-resource-factory action
                                                          │
                  reads agents + graph  ◀────────────────┤  Factory LD project
                  creates flag (off) + metrics ◀─────────┤  App LD project
                  commits wiring + tests to PR branch ◀───┘
App (packages/ld) ──▶ evaluates flags + track() events ──▶ App LD project
```

Two LaunchDarkly projects are used:

- **Factory project** — holds the agent AI configs + graph (the pipeline reads it).
- **App project** — where agents create flags/metrics and the app evaluates them.

## What is already built in this repo

- `packages/ld/` — LD React provider (`LDRoot`), typed flag keys, typed `track()`
  metric helper. Runs offline with safe defaults when no client ID is set.
- `apps/web` — metric events instrumented (`puzzle_completed`, `made_par`,
  `time_to_solve_ms`, `move_latency_ms`, `invalid_move`, `puzzle_abandoned`); the
  `show-mission-control` flag gates a stub as the flag-evaluation seam.
- `config/` — declarative flag + metric definitions (source of truth; reused by
  the factory).
- `.env.example` — documents the one app runtime var plus the factory secrets.
- `.github/workflows/auto-factory.yml` (repo root) — the Phase 1 hook, with
  `sandbox_root: word-golf`.

## Setup steps (the gather list)

### 1. LaunchDarkly account

- Create (or pick) two projects: a **factory** project and an **app** project.
- Ensure **AI Configs / AgentControl** is enabled for the factory project.

### 2. Gather credentials

| Value | Where it goes | Notes |
|-------|---------------|-------|
| App project **client-side ID** | `word-golf/.env` -> `VITE_LD_CLIENT_ID` | browser SDK |
| Factory project **server SDK key** (`sdk-...`) | GitHub secret `LD_SDK_KEY` | reads agents + graph |
| LD **API token** (`api-...`, write to app project) | GitHub secret `LD_API_KEY` | creates flags/metrics |
| **Anthropic API key** | GitHub secret `ANTHROPIC_API_KEY` | agent backend (default provider) |
| **Cursor API key** (`crsr-...`) | GitHub secret `CURSOR_API_KEY` | agent backend when `auto-factory-ai-provider` serves `cursor` |
| App project **key** | GitHub variable `LD_APP_PROJECT_KEY` | e.g. `word-golf` |

`GITHUB_TOKEN` is provided automatically by GitHub Actions.

### 3. Provision the agent configs + graph

From a clone of the `launchdarkly-auto-factory` repo (not this one):

```bash
cp .env.example .env   # fill LD_SDK_KEY, LD_API_KEY, LD_PROJECT_KEY, LD_APP_PROJECT_KEY, ANTHROPIC_API_KEY
npm install
npm run bootstrap      # provisions the 5 agents + gha-auto-factory graph into the factory project
```

### 4. Set GitHub repo secrets/variables

In this repo's Settings:

- Secrets: `LD_SDK_KEY`, `LD_API_KEY`, `ANTHROPIC_API_KEY`
- Variable: `LD_APP_PROJECT_KEY`

### 5. (App runtime) Connect the client

Put the app project client-side ID in `word-golf/.env`:

```
VITE_LD_CLIENT_ID=<client-side-id>
```

`npm run dev` -> flags now evaluate live and metric events flow to LaunchDarkly.
Without this, the game still runs fully (offline defaults, no-op tracking).

## Prove it end-to-end

1. Open a plain feature PR (no flag) -- the canonical first one is a **hint
   button**.
2. The agent chain should: classify the PR, create the `hint-button` flag (off)
   in the app project, instrument `made_par`, write flag-on/off tests, commit
   them to the PR branch, and post a verdict comment.
3. Confirm the flag + metric appear in the app project, and that the app's client
   SDK reads the new flag.

## Notes / limitations

- The auto-rollback climax needs Phase 2 (Beacon + deploy). Until then, Mission
  Control can demonstrate the loop in Simulated mode (a later phase).
- `result_shared` and `daily_returned` depend on share/streak features that are
  deferred (see `FUTURE-WORK.md`).

## Maintenance — keeping the factory in sync

The factory lives in three layers that can drift apart:

1. **Template (upstream)** — [`launchdarkly-labs/launchdarkly-auto-factory`](https://github.com/launchdarkly-labs/launchdarkly-auto-factory)
   (Tom's repo): the canonical source.
2. **Our fork** — [`alawrenceld/launchdarkly-auto-factory`](https://github.com/alawrenceld/launchdarkly-auto-factory):
   what the GitHub Action actually runs (the workflow pins it `@main`).
3. **Prod (live LD)** — the agent AI configs + `gha-auto-factory` graph
   provisioned into the `word-golf-factory` project. This is what each PR run
   reads at runtime.

### Synced to upstream — 2026-07-09

Our fork `main` was hard-reset to `upstream/main` (`2d33e8d`, ADR 0008 approval
gates) and force-pushed, adopting ~58 upstream commits: the Cursor SDK provider
(ADR 0006), LLM-as-judge quality layer (ADR 0007), approval-policy-as-gates
(ADR 0008), LLM observability, and the routing-contract/robustness fixes.

- **`skip_flagging` no-op fix** — our original fix was **merged upstream**
  ([launchdarkly-labs PR #10](https://github.com/launchdarkly-labs/launchdarkly-auto-factory/pull/10))
  and refactored into `packages/shared/`, so the fork no longer carries a
  duplicate.
- **`max_turns` 40** on the `metrics-author→flag-testing` and
  `flag-implementer→metrics-author` edges — the **only** remaining local delta
  vs upstream, re-applied on top of the sync (`config/agentcontrol/graphs/auto-factory.json`).

The `word-golf-factory` project was wiped (5 agent configs + graph) and
re-provisioned clean via `npm run bootstrap`, because the provisioner is
additive and won't upgrade existing configs in place. It now holds 7 AI configs
(5 agents + 2 judges), the `gha-auto-factory` graph, and the 4 operational
flags below (all **off** → safe defaults, so behavior is unchanged until flipped):

| Flag | Off / default | Turn on to… |
|------|---------------|-------------|
| `auto-factory-ai-provider` | `anthropic` | A/B Anthropic vs `cursor` agents |
| `auto-factory-approval-mode` | `yolo` | `risk-threshold` / `always` gating |
| `auto-factory-risk-threshold` | `0.6` | tune gate sensitivity (0–1) |
| `auto-factory-approval-gates` | (which steps) | pick gated nodes |

The app-repo workflow now uses the checkout + `npm ci` form so it can run either
provider based on the flag (the bare `uses:` form can't load `@cursor/sdk`).

### Remaining follow-ups

- [ ] **Flip on gating** — set `auto-factory-approval-mode` → `risk-threshold`
      when we want the factory to pause risky PRs for label approval.
- [ ] **Provider A/B** — serve `cursor` (or a percentage rollout) from
      `auto-factory-ai-provider` to compare Anthropic vs Cursor agents.
- [ ] **Decide on `max_turns`** — keep the 40 override (current) or upstream it.
