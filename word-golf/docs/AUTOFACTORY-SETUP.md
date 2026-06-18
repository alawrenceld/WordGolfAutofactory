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
| **Anthropic API key** | GitHub secret `ANTHROPIC_API_KEY` | agent backend |
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

### Current deltas (fork vs template)

- **`skip_flagging` no-op fix** — a skipped-flagging PR (infra/docs) was falsely
  reported as "code review REJECTED". Fixed in our fork and submitted upstream as
  [launchdarkly-labs PR #10](https://github.com/launchdarkly-labs/launchdarkly-auto-factory/pull/10).
- **`max_turns` 20 → 40** on the `metrics-author` and `flag-testing` edges
  (`config/agentcontrol/graphs/auto-factory.json`) — local tuning so those agents
  stop hitting the turn cap mid-task. Lives in our fork; **not** yet upstreamed.

### TODO — reconcile once upstream PR #10 is reviewed/merged

- [ ] **Sync fork → upstream.** When [PR #10](https://github.com/launchdarkly-labs/launchdarkly-auto-factory/pull/10)
      is reviewed/merged, sync `alawrenceld/launchdarkly-auto-factory` `main` to
      `upstream/main`. Note our fork currently carries the same fix at the *old*
      file location (`phase1-resource-factory/src/approval.ts`), so expect to
      drop that duplicate in favor of upstream's `packages/shared/` version.
- [ ] **Re-provision the template → prod.** Re-run `npm run bootstrap` from the
      synced fork to push the updated agent configs + graph into the
      `word-golf-factory` project.
- [ ] **Diff template vs prod and reconcile.** Compare what `bootstrap` would
      write against what's live in `word-golf-factory` (including our `max_turns
      40` tuning). Keep our intentional deltas, adopt upstream improvements, and
      drop anything now redundant.
- [ ] **Decide on `max_turns`.** Either upstream the 20 → 40 change too, or keep
      it as a documented local override.
