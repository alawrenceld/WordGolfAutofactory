# AutoFactory architecture

How Word Golf is wired to the
[LaunchDarkly AutoFactory](https://github.com/alawrenceld/launchdarkly-auto-factory),
and the reasoning behind the project topology. For step-by-step setup, see
[AUTOFACTORY-SETUP.md](AUTOFACTORY-SETUP.md).

## The pipeline at a glance

```
PR opened ─▶ .github/workflows/auto-factory.yml ─▶ phase1-resource-factory action
                                                       │
              reads agent configs + graph  ◀───────────┤   Factory project
              creates flag (off) + metrics ◀───────────┤   App project
              commits wiring + tests to PR branch ◀─────┘
App (packages/ld) ─▶ evaluates flags + track() events ─▶ App project
(later) deploy ─▶ Beacon ─▶ guarded release / auto-rollback ─▶ App project
```

- **Phase 1 (per PR):** a chain of five LaunchDarkly AI-config agents classifies
  the PR and, when flag-worthy, creates a boolean flag (off), wires it into the
  code, instruments error/latency/business metrics, writes flag-on/flag-off
  tests, and posts a verdict. It records a release manifest in
  `.release-flags/pr-N.json`.
- **Phase 2 (post-deploy, later milestone):** Beacon turns the flag on as a
  guarded release and monitors it to a terminal state (completed or
  guardrail-reverted). Needs hosting + a deploy target; not wired yet.

## Two projects: control plane vs data plane

The AutoFactory uses **two LaunchDarkly projects**, separated by what kind of
thing they hold.

| | Factory project (control plane) | App project (data plane) |
|---|---|---|
| Holds | Agent AI configs, the `gha-auto-factory` graph, operational flags (`auto-factory-ai-provider`, approval mode) | The feature flags + guarded-release metrics the agents create; what the app evaluates |
| Describes | *How* releases get made | *What* gets released |
| Pipeline access | Read-only at runtime | Read + write (creates flags/metrics) |
| App access | none | Evaluates flags, sends `track()` events |
| Credential | Server SDK key (`sdk-...`) -> `LD_SDK_KEY` | Client-side ID -> `VITE_LD_CLIENT_ID`; project key -> `LD_APP_PROJECT_KEY` |

## Topology: one factory, many apps

The relationship is **1:many by design**. The agent configs and graph are
app-agnostic, so a single factory project can drive many app projects. The only
thing that changes per app is the GitHub variable `LD_APP_PROJECT_KEY`; the
factory SDK key and graph stay the same.

```
                ┌──────────────────────┐
                │  Factory project     │  agents + graph (maintained once)
                └──────────┬───────────┘
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
       App: word-golf  App: foo       App: bar
       (flags/metrics) (flags/metrics)(flags/metrics)
```

You *can* run it 1:1 for maximum isolation, but you are not forced to.

## Why not a single combined project?

Even in the 1:1 case, keeping them separate is the better default:

1. **Blast-radius isolation.** The agents hold an API token that creates and
   mutates flags. They should not be able to touch the configs that *define the
   agents themselves*. Separation keeps the control plane out of reach of its own
   automation.
2. **Clean surfaces.** The app project's flag/metric list stays purely product
   flags, not polluted with agent configs and operational toggles -- important
   when a workshop audience is reading the flag list.
3. **Governance / ownership.** A platform team can own the factory; product teams
   own their app projects, with different access policies.
4. **Reuse economics.** The first time a second app appears, a combined project
   forces a painful split. Starting separated costs one extra project now and
   nothing later.
5. **Entitlements.** AI Configs / AgentControl can be enabled where the agents
   live (factory) without entangling every product project.

The tradeoff is minor: one extra project and one extra key, in exchange for real
isolation and reuse.

> Note: this reflects the AutoFactory's documented design plus general
> LaunchDarkly project/environment conventions. An internal LaunchDarkly
> platform best-practice guide, if one exists, supersedes this.
