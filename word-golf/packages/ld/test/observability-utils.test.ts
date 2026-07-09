/**
 * Flag-path tests for the `enable-observability-plugin` feature flag.
 *
 * Covers both flag-OFF (control) and flag-ON (treatment) paths for:
 *   1. buildLDOptions   — returns undefined vs { plugins: [...] }
 *   2. resolveObservabilityFlag — reads from live SDK flags or falls back to defaults
 *   3. emitObservabilityMetrics — no-op on control; emits latency + activated on
 *                                 treatment; emits error metric when plugin throws
 *
 * Uses Node's built-in test runner (node:test) and mock.module to stub out
 * the @launchdarkly/observability package so no real browser SDK is needed.
 */
import { test, mock, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";

// ── Observability stub ──────────────────────────────────────────────────────
// We provide a mock constructor that is controllable per-test via the
// `mockObservabilityBehaviour` helper.
let observabilityConstructorShouldThrow = false;

class MockObservability {
  constructor() {
    if (observabilityConstructorShouldThrow) {
      throw new Error("Simulated plugin init failure");
    }
  }
}

// Stub @launchdarkly/observability before importing the module under test.
// mock.module is available in Node 20+ with --experimental-test-module-mocks.
await mock.module("@launchdarkly/observability", {
  exports: { default: MockObservability },
});

// Now import the module under test — the stub above will be used.
const {
  buildLDOptions,
  resolveObservabilityFlag,
  emitObservabilityMetrics,
  _resetObservabilityPlugin,
} = await import("../src/observability-utils.js");

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTrackClient() {
  const calls: Array<{ key: string; data?: unknown; value?: number }> = [];
  return {
    calls,
    track(key: string, data?: unknown, value?: number) {
      calls.push({ key, data, value });
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("buildLDOptions — flag-off (control) path", () => {
  beforeEach(() => {
    observabilityConstructorShouldThrow = false;
    _resetObservabilityPlugin();
  });

  test("returns undefined when flag is false", () => {
    const result = buildLDOptions(false);
    assert.equal(result, undefined);
  });

  test("does not allocate the plugin singleton when flag is false", () => {
    // Call multiple times — still no plugin allocated
    buildLDOptions(false);
    buildLDOptions(false);
    // Indirectly verify: if plugin were constructed it would be in the module
    // singleton; the only observable side-effect would be a constructor call.
    // Since MockObservability records nothing, just assert result is undefined.
    assert.equal(buildLDOptions(false), undefined);
  });
});

describe("buildLDOptions — flag-on (treatment) path", () => {
  beforeEach(() => {
    observabilityConstructorShouldThrow = false;
    _resetObservabilityPlugin();
  });

  test("returns options object with plugins array when flag is true", () => {
    const result = buildLDOptions(true);
    assert.ok(result, "expected a non-undefined options object");
    assert.ok(Array.isArray(result.plugins), "plugins must be an array");
    assert.equal(result.plugins.length, 1);
  });

  test("the plugin in the options array is an Observability instance", () => {
    const result = buildLDOptions(true);
    assert.ok(result?.plugins[0] instanceof MockObservability);
  });

  test("returns the same singleton instance on repeated calls (lazy once)", () => {
    const r1 = buildLDOptions(true);
    const r2 = buildLDOptions(true);
    assert.ok(r1 && r2);
    // Same reference — singleton never re-allocated
    assert.equal(r1.plugins[0], r2.plugins[0]);
  });
});

// ── resolveObservabilityFlag ─────────────────────────────────────────────────

describe("resolveObservabilityFlag — flag-off (control) path", () => {
  test("returns false when key is absent (SDK not yet connected)", () => {
    const result = resolveObservabilityFlag({});
    assert.equal(result, false);
  });

  test("returns false when flag key is explicitly false", () => {
    const result = resolveObservabilityFlag({
      "enable-observability-plugin": false,
    });
    assert.equal(result, false);
  });
});

describe("resolveObservabilityFlag — flag-on (treatment) path", () => {
  test("returns true when flag key is true", () => {
    const result = resolveObservabilityFlag({
      "enable-observability-plugin": true,
    });
    assert.equal(result, true);
  });

  test("other flag keys in the map do not affect the result", () => {
    const result = resolveObservabilityFlag({
      "some-other-flag": true,
      "enable-observability-plugin": false,
    });
    assert.equal(result, false);
  });
});

// ── emitObservabilityMetrics ─────────────────────────────────────────────────

describe("emitObservabilityMetrics — flag-off (control) path", () => {
  beforeEach(() => {
    observabilityConstructorShouldThrow = false;
    _resetObservabilityPlugin();
  });

  test("does not call track when flag is false", () => {
    const client = makeTrackClient();
    emitObservabilityMetrics(false, client);
    assert.equal(client.calls.length, 0, "no track calls should fire on control path");
  });

  test("does not call track when flag is false even with a real client present", () => {
    const client = makeTrackClient();
    emitObservabilityMetrics(false, client);
    assert.deepEqual(client.calls, []);
  });

  test("is a no-op when client is undefined and flag is false", () => {
    // Must not throw
    assert.doesNotThrow(() => {
      emitObservabilityMetrics(false, undefined);
    });
  });
});

describe("emitObservabilityMetrics — flag-on (treatment) path", () => {
  beforeEach(() => {
    observabilityConstructorShouldThrow = false;
    _resetObservabilityPlugin();
  });

  test("calls track for latency and activated events when flag is true", () => {
    const client = makeTrackClient();
    emitObservabilityMetrics(true, client);

    const keys = client.calls.map((c) => c.key);
    assert.ok(
      keys.includes("enable-observability-plugin-latency"),
      "must track latency"
    );
    assert.ok(
      keys.includes("enable-observability-plugin-activated"),
      "must track activation"
    );
  });

  test("latency track call includes a numeric value", () => {
    const client = makeTrackClient();
    emitObservabilityMetrics(true, client);

    const latencyCall = client.calls.find(
      (c) => c.key === "enable-observability-plugin-latency"
    );
    assert.ok(latencyCall, "latency call must exist");
    assert.equal(typeof latencyCall.value, "number", "latency value must be a number");
    assert.ok(latencyCall.value >= 0, "latency value must be non-negative");
  });

  test("does not call track for error event on successful init", () => {
    const client = makeTrackClient();
    emitObservabilityMetrics(true, client);

    const errorCall = client.calls.find(
      (c) => c.key === "enable-observability-plugin-error"
    );
    assert.equal(errorCall, undefined, "error event must NOT fire on success");
  });

  test("is safe when client is undefined — does not throw", () => {
    assert.doesNotThrow(() => {
      emitObservabilityMetrics(true, undefined);
    });
  });
});

describe("emitObservabilityMetrics — flag-on, plugin throws (error path)", () => {
  beforeEach(() => {
    observabilityConstructorShouldThrow = true;
    _resetObservabilityPlugin();
  });

  test("calls track for error event when plugin constructor throws", () => {
    const client = makeTrackClient();
    emitObservabilityMetrics(true, client);

    const errorCall = client.calls.find(
      (c) => c.key === "enable-observability-plugin-error"
    );
    assert.ok(errorCall, "error metric must fire when plugin throws");
  });

  test("does NOT call latency or activated track events when plugin throws", () => {
    const client = makeTrackClient();
    emitObservabilityMetrics(true, client);

    const keys = client.calls.map((c) => c.key);
    assert.ok(
      !keys.includes("enable-observability-plugin-latency"),
      "latency must NOT be tracked when plugin throws"
    );
    assert.ok(
      !keys.includes("enable-observability-plugin-activated"),
      "activated must NOT be tracked when plugin throws"
    );
  });

  test("does not propagate the plugin constructor error to the caller", () => {
    const client = makeTrackClient();
    // emitObservabilityMetrics must swallow the error — never re-throw
    assert.doesNotThrow(() => {
      emitObservabilityMetrics(true, client);
    });
  });

  test("still safe when client is undefined and plugin throws", () => {
    assert.doesNotThrow(() => {
      emitObservabilityMetrics(true, undefined);
    });
  });
});

describe("emitObservabilityMetrics — telemetry track() throws (resilience)", () => {
  beforeEach(() => {
    observabilityConstructorShouldThrow = false;
    _resetObservabilityPlugin();
  });

  test("does not propagate when client.track throws", () => {
    const throwingClient = {
      track(_key: string, _data?: unknown, _value?: number): void {
        throw new Error("simulated track failure");
      },
    };
    assert.doesNotThrow(() => {
      emitObservabilityMetrics(true, throwingClient);
    });
  });
});

describe("FLAG_DEFAULTS baseline — enable-observability-plugin defaults to false", () => {
  test("FLAG_DEFAULTS['enable-observability-plugin'] is false (control path)", async () => {
    const { FLAG_DEFAULTS } = await import("../src/flags.js");
    assert.equal(FLAG_DEFAULTS["enable-observability-plugin"], false);
  });
});
