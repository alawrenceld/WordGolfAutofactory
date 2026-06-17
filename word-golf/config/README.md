# config — declarative flags & metrics (source of truth)

These files declare the LaunchDarkly flags and guarded-release metrics Word Golf
expects, in a single place. They serve two purposes:

1. **App contract.** `packages/ld` mirrors these keys/types so the app evaluates
   flags and fires metric events that line up with LaunchDarkly.
2. **Faithful demo-app.** The AutoFactory reuses the *same* definitions when it
   creates flags and metrics in the app project (plan.md success metric #5).

The AutoFactory creates new flags targeting **off**, so booleans here list the
control (off) value as the default.

- `flags.json` — flag keys, kinds, variations, defaults, and the metric each one
  is hypothesized to move.
- `metrics.json` — the three guarded-release metric categories (business,
  latency, error) and the event keys that feed them.

Event keys here must match `METRIC_EVENTS` in `packages/ld/src/events.ts`.
