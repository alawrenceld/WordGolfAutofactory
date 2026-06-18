# Build Log — Word Golf × LaunchDarkly AutoFactory

A record of everything we built and wired up to get from an empty repo to a
**green, agent-approved pull request**, plus the prerequisites that had to be in
place for the work to execute. Read this as the "how we got here" companion to
[AUTOFACTORY-SETUP.md](AUTOFACTORY-SETUP.md) (the clean setup guide) and
[AUTOFACTORY-ARCHITECTURE.md](AUTOFACTORY-ARCHITECTURE.md) (the design rationale).

---

## 1. What we ended up with

- A playable **Word Golf** game (engine + web app) in an npm-workspaces monorepo.
- A full **LaunchDarkly AutoFactory** integration: every PR triggers a chain of
  AI agents that flag the change, instrument metrics, write tests, and gate on a
  code review.
- A proven end-to-end run: PR
  [#1](https://github.com/alawrenceld/WordGolfAutofactory/pull/1) (`feat/hint-button`)
  went **red → red → green** as the agents and the guardrail did their jobs, ending
  in an automatic **APPROVE**.

Two LaunchDarkly projects underpin it:

| Project | Role | Holds |
|---------|------|-------|
| `word-golf-factory` | Control plane | 5 agent AI Configs + the `gha-auto-factory` graph |
| `word-golf` | Data plane | Feature flags + guarded-release metrics the app uses |

---

## 2. Prerequisites — what had to be set up

These are the things that had to exist (mostly provided by the account owner)
before the automation could run. Several were learned the hard way; see §6.

### 2.1 LaunchDarkly

- **An account with AI Configs / AgentControl enabled.** The factory's agents are
  LaunchDarkly AI Configs; without the entitlement the provisioning API rejects
  writes.
- **Two projects:** `word-golf-factory` (control plane) and `word-golf` (data
  plane). Both were created via the LaunchDarkly MCP server.
- **An Admin API token.** A custom token scoped to "all actions on both projects"
  was **not** sufficient — creating AI Configs returned `403 forbidden`. The token
  had to be rescoped to **Admin** (see §6.1).
- **A server SDK key** (`sdk-...`) for the factory project's environment.
- **The app project's client-side ID** for the browser SDK (optional for the
  pipeline; needed for live flag eval in the app).

### 2.2 Anthropic

- **An Anthropic API key** — the default execution backend for the agents. The
  agents run locally in the GitHub Action and use each AI Config's instructions as
  the system prompt.

### 2.3 GitHub

- The repo `alawrenceld/WordGolfAutofactory` (where PRs run) and a copy of the
  action repo `alawrenceld/launchdarkly-auto-factory` (referenced as
  `...@main` by the workflow).
- **`gh` CLI authenticated** with `repo` + `workflow` scopes so secrets/variables
  could be set from the terminal. The stored token had gone stale and needed
  `gh auth refresh -h github.com -s repo`.

### 2.4 Where each credential lives

| Value | Location | Used for |
|-------|----------|----------|
| App client-side ID | `word-golf/.env` → `VITE_LD_CLIENT_ID` | Browser flag eval |
| Factory server SDK key | `word-golf/.env` + GitHub secret `LD_SDK_KEY` | Read agents + graph |
| LD Admin API token | `word-golf/.env` + GitHub secret `LD_API_KEY` | Create flags/metrics, provision agents |
| Anthropic API key | `word-golf/.env` + GitHub secret `ANTHROPIC_API_KEY` | Agent backend |
| App project key | GitHub variable `LD_APP_PROJECT_KEY` = `word-golf` | Target data-plane project |

`.env` files are gitignored. `GITHUB_TOKEN` is provided automatically in Actions.

---

## 3. What we built (the app)

A monorepo (`word-golf/`) using npm workspaces:

- **`packages/engine`** — pure-TypeScript game engine: word-graph (wildcard
  buckets), BFS par calculation, move validation, scoring, and deterministic daily
  puzzle generation (seeded RNG + random walk with a minimum-par preference).
  25 unit tests.
- **`apps/web`** — Vite + React UI. Instrumented with typed metric events
  (`puzzle_completed`, `made_par`, `time_to_solve_ms`, `move_latency_ms`,
  `invalid_move`, `puzzle_abandoned`).
- **`packages/ld`** — LaunchDarkly integration: `LDRoot` provider, typed flag keys,
  typed `track()` helper, React hooks. **Runs fully offline with safe defaults** if
  no client ID is configured.
- **`config/`** — declarative flag + metric definitions (source of truth).
- **`.github/workflows/auto-factory.yml`** (repo root) — the Phase 1 hook, with
  `sandbox_root: word-golf` because the app lives in a subdirectory.

---

## 4. Wiring the AutoFactory (control plane)

### 4.1 Provisioning the agents

From a local clone of `launchdarkly-auto-factory`:

```bash
# .env created from the values above, with LD_PROJECT_KEY=word-golf-factory
npm install
npm run bootstrap
```

`bootstrap` ran preflight checks, then provisioned from the committed canonical
definitions in `config/agentcontrol/`:

```
Configs:    5 created   (research-planner, flag-implementer, metrics-author,
                         flag-testing, code-reviewer)
Variations: 5 created
Graphs:     1 created   (gha-auto-factory)
```

### 4.2 The agent graph

`gha-auto-factory` is a linear/conditional chain. Edges carry **capabilities**
(which write tools a node gets) and **routing conditions** (tags that gate the
next hop):

```
research-planner ─▶ flag-implementer ─▶ metrics-author ─▶ flag-testing ─▶ code-reviewer
                    [create_flag,         [create_metric,    [edit_files]
                     edit_files]           edit_files]
                    skip_if skip_flagging  require flag_created  require needs_tests
```

### 4.3 GitHub secrets/variables

Set via `gh` (after re-auth):

```bash
gh secret set LD_SDK_KEY --body "…"
gh secret set LD_API_KEY --body "…"
gh secret set ANTHROPIC_API_KEY --body "…"
gh variable set LD_APP_PROJECT_KEY --body "word-golf"
```

---

## 5. Proving it end-to-end (PR #1, `feat/hint-button`)

We opened a deliberately plain, un-flagged feature — a **Hint button** that
suggests the next word on a shortest path to the target — and let the factory act
on it. It took three runs.

| Run | Result | What happened |
|-----|--------|---------------|
| [27775495988](https://github.com/alawrenceld/WordGolfAutofactory/actions/runs/27775495988) | ❌ REJECT | Flag created + wired, but `metrics-author` and `flag-testing` produced nothing → reviewer blocked on missing metrics + tests |
| [27776916630](https://github.com/alawrenceld/WordGolfAutofactory/actions/runs/27776916630) | ❌ REJECT | All agents completed real work; reviewer blocked on two real code-quality issues (incl. a bug in the author's code) |
| [27777705157](https://github.com/alawrenceld/WordGolfAutofactory/actions/runs/27777705157) | ✅ APPROVE | Both blockers fixed → `review_approved: true`, risk `low`, changes applied |

### Artifacts the agents created in `word-golf`

- **Flag:** `hint-button` (boolean, targeting off).
- **Metrics:** `hint-button-error-rate`, `hint-button-usage-rate`,
  `hint-button-completion-rate`.
- **Events instrumented:** `hint_used`, `hint_error`, `hint_unavailable`.
- **Release manifest:** `word-golf/.release-flags/pr-1.json` (for Phase 2).
- **Tests:** `apps/web/src/App.hint-button.test.tsx` (12 flag-on/off tests).

---

## 6. Problems hit and how we fixed them

### 6.1 `403 forbidden` provisioning AI Configs

**Symptom:** preflight passed and reads returned `404` (endpoint reachable), but
creating AI Configs/graph returned `403`. **Cause:** the API token could read but
not write the AI Configs resource — a project-scoped "all actions" custom role
doesn't cover it. **Fix:** rescope the token to **Admin**, re-sync, re-run
`bootstrap` → 5 configs + 1 graph created.

### 6.2 `metrics-author` and `flag-testing` "stopped" mid-task

**Symptom:** both agents ended marked `[stopped]` having done no work; the reviewer
blocked on missing metrics + tests. **Cause:** the runner marks a node `stopped`
only when it **hits its turn cap** while still working — their edges allowed
`max_turns: 20`, and `flag-testing` was burning its whole budget trying to
*bootstrap a test harness* (`apps/web` had none). **Fixes:**

1. Added a real test harness to `apps/web` (vitest + jsdom + Testing Library, a
   smoke test) and wired the root `npm test` to run engine + web. The agent now
   writes a test instead of building infrastructure.
2. Raised `max_turns` 20 → 40 for the `metrics-author` and `flag-testing` edges in
   the graph, and updated the **live** graph in `word-golf-factory` (delete +
   re-provision — the only project touched).

### 6.3 Reviewer blocked on real code quality (the guardrail working)

After the agents completed, the reviewer caught two legitimate blockers:

- An **unsafe non-null assertion** in the author's BFS helper (`firstStepToward`).
- The agent's test querying **non-existent `data-testid`s**, making its assertions
  vacuous.

**Fix:** guarded the parent-chain walk (removed the `!`) and added
`start-word`/`target-word` test IDs to `WordChip`. Next run → APPROVE.

### 6.4 Environment quirks worth knowing

- **Sandbox + macOS keychain:** `gh` reported its token as "invalid" inside the
  sandbox because keychain access was blocked; the same command succeeded when run
  unsandboxed. `gh` commands need to run outside the sandbox.
- **Credential-handling approvals:** writing keys into `.env`, setting GitHub
  secrets, and deleting/recreating the live graph each required an explicit
  approval prompt (they touch credentials or shared state).

---

## 7. Reproduce from scratch (condensed)

1. Create LD projects `word-golf-factory` + `word-golf`; ensure AI Configs is
   enabled; mint an **Admin** API token + factory server SDK key.
2. Put `VITE_LD_CLIENT_ID`, `LD_SDK_KEY`, `LD_API_KEY`, `ANTHROPIC_API_KEY` in
   `word-golf/.env`.
3. In a clone of `launchdarkly-auto-factory`: fill `.env`
   (`LD_PROJECT_KEY=word-golf-factory`, `LD_APP_PROJECT_KEY=word-golf`),
   `npm install`, `npm run bootstrap`.
4. `gh auth refresh -h github.com -s repo`, then set the three secrets +
   `LD_APP_PROJECT_KEY` variable on the app repo.
5. Open a feature PR. Phase 1 runs automatically; iterate on any reviewer blockers
   until APPROVE.

---

## 8. Current state and next steps

**Done:** Phase 1 is live and proven. Flags + metrics exist in `word-golf`; agents
+ graph exist in `word-golf-factory`; PR #1 is green and mergeable.

**Next candidates:**

- **Merge PR #1**, then exercise **Phase 2** (Beacon guarded rollout +
  metric-driven auto-rollback) using the `hint-button` flag and its live metrics.
- Open a deliberately risky PR to demonstrate the reviewer blocking (and, with
  Phase 2, an automatic rollback) in action.
- See [FUTURE-WORK.md](FUTURE-WORK.md) for deferred game features that make good
  future factory candidates.
