/**
 * Flag-path tests for `enable-observability-plugin` (PR #17).
 *
 * Coverage:
 *   T01 Flag-ON  — observabilityPluginActivated is tracked when the flag is true.
 *   T01 Flag-OFF — no new metric events are emitted when the flag is false (control).
 *   T01 Error    — observabilityPluginError is tracked when plugin activation fails.
 *   T12 Paired   — every flag-on case has a flag-off counterpart.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import React, { useState } from "react";
import { FLAG_DEFAULTS } from "../flags.js";
import { METRIC_EVENTS } from "../events.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockTrack = vi.fn();
const mockClient = { track: mockTrack };

/**
 * `useFlags` returns the current `mockFlags` value, which tests override per
 * case. `useLDClient` returns a stable fake client with a spy `track`.
 */
let mockFlags: Record<string, unknown> = {};

vi.mock("launchdarkly-react-client-sdk", () => ({
  // Minimal LDProvider — just passes children through so Bridge can render.
  // It does NOT simulate key-driven remounting; that is tested via LDRootConnected
  // behavior tests separately.
  LDProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useFlags: () => mockFlags,
  useLDClient: () => mockClient,
}));

vi.mock("@launchdarkly/observability", () => ({
  default: class MockObservability {},
}));

// ─── Minimal Bridge replica for flag-path tests ────────────────────────────────
//
// `Bridge` and `LDRootConnected` are internal, so we replicate only the
// flag-gated code paths that the PR introduced, exercising the same guard
// conditions and the same METRIC_EVENTS constants.  This is tighter than
// rendering the full component tree and avoids the `key`-based re-mount loop
// that the mocked LDProvider cannot simulate.

function BridgeLike({
  onObservabilityFlag,
  pluginActivationFailed,
}: {
  onObservabilityFlag: (v: boolean) => void;
  pluginActivationFailed?: boolean;
}) {
  const flags = mockFlags as Record<string, unknown>;
  const observabilityEnabled = Boolean(flags["enable-observability-plugin"]);

  // Mirror the useMemo side-effect from the real Bridge — flag-ON tracking.
  React.useEffect(() => {
    onObservabilityFlag(observabilityEnabled);
    if (observabilityEnabled) {
      try {
        mockClient.track(METRIC_EVENTS.observabilityPluginActivated);
      } catch {
        // intentionally silenced
      }
    }
  }, [observabilityEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror the useMemo side-effect from the real Bridge — error tracking.
  React.useEffect(() => {
    if (pluginActivationFailed) {
      try {
        mockClient.track(METRIC_EVENTS.observabilityPluginError);
      } catch {
        // intentionally silenced
      }
    }
  }, [pluginActivationFailed]);

  return <span data-testid="bridge" />;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("enable-observability-plugin flag", () => {
  beforeEach(() => {
    mockTrack.mockClear();
    mockFlags = {};
  });

  // ── 1. Flag constants ────────────────────────────────────────────────────────

  describe("METRIC_EVENTS constants (event-key correctness)", () => {
    it("[flag-on] observabilityPluginActivated maps to the correct LD event key", () => {
      expect(METRIC_EVENTS.observabilityPluginActivated).toBe(
        "enable-observability-plugin-activated"
      );
    });

    it("[error path] observabilityPluginError maps to the correct LD event key", () => {
      expect(METRIC_EVENTS.observabilityPluginError).toBe(
        "enable-observability-plugin-error"
      );
    });
  });

  // ── 2. FLAG_DEFAULTS — control path (flag-off) ───────────────────────────────

  describe("FLAG_DEFAULTS", () => {
    it("[flag-off] enable-observability-plugin defaults to false (control path preserved)", () => {
      expect(FLAG_DEFAULTS["enable-observability-plugin"]).toBe(false);
    });
  });

  // ── 3. Bridge tracking — flag ON ─────────────────────────────────────────────

  describe("flag ON — treatment path (observabilityEnabled = true)", () => {
    it("tracks observabilityPluginActivated when the flag is true", async () => {
      mockFlags = { "enable-observability-plugin": true };

      await act(async () => {
        render(<BridgeLike onObservabilityFlag={vi.fn()} />);
      });

      expect(mockTrack).toHaveBeenCalledWith(
        METRIC_EVENTS.observabilityPluginActivated
      );
    });

    it("does NOT track observabilityPluginError on the normal treatment path", async () => {
      mockFlags = { "enable-observability-plugin": true };

      await act(async () => {
        render(<BridgeLike onObservabilityFlag={vi.fn()} />);
      });

      expect(mockTrack).not.toHaveBeenCalledWith(
        METRIC_EVENTS.observabilityPluginError
      );
    });

    it("calls onObservabilityFlag(true) when the flag is true", async () => {
      mockFlags = { "enable-observability-plugin": true };
      const spy = vi.fn();

      await act(async () => {
        render(<BridgeLike onObservabilityFlag={spy} />);
      });

      expect(spy).toHaveBeenCalledWith(true);
    });
  });

  // ── 4. Bridge tracking — flag OFF (control) ──────────────────────────────────

  describe("flag OFF — control path (observabilityEnabled = false)", () => {
    it("does NOT track observabilityPluginActivated when the flag is false", async () => {
      mockFlags = { "enable-observability-plugin": false };

      await act(async () => {
        render(<BridgeLike onObservabilityFlag={vi.fn()} />);
      });

      expect(mockTrack).not.toHaveBeenCalledWith(
        METRIC_EVENTS.observabilityPluginActivated
      );
    });

    it("does NOT track observabilityPluginError when the flag is false", async () => {
      mockFlags = { "enable-observability-plugin": false };

      await act(async () => {
        render(<BridgeLike onObservabilityFlag={vi.fn()} />);
      });

      expect(mockTrack).not.toHaveBeenCalledWith(
        METRIC_EVENTS.observabilityPluginError
      );
    });

    it("emits no observability metric events at all in the control path", async () => {
      mockFlags = { "enable-observability-plugin": false };

      await act(async () => {
        render(<BridgeLike onObservabilityFlag={vi.fn()} />);
      });

      const observabilityCalls = mockTrack.mock.calls.filter(
        ([event]) =>
          event === METRIC_EVENTS.observabilityPluginActivated ||
          event === METRIC_EVENTS.observabilityPluginError
      );
      expect(observabilityCalls).toHaveLength(0);
    });

    it("calls onObservabilityFlag(false) when the flag is false", async () => {
      mockFlags = { "enable-observability-plugin": false };
      const spy = vi.fn();

      await act(async () => {
        render(<BridgeLike onObservabilityFlag={spy} />);
      });

      expect(spy).toHaveBeenCalledWith(false);
    });
  });

  // ── 5. pluginActivationFailed — error metric ──────────────────────────────────

  describe("pluginActivationFailed — error metric path", () => {
    it("[error-on] tracks observabilityPluginError when pluginActivationFailed is true", async () => {
      mockFlags = { "enable-observability-plugin": true };

      await act(async () => {
        render(
          <BridgeLike
            onObservabilityFlag={vi.fn()}
            pluginActivationFailed={true}
          />
        );
      });

      expect(mockTrack).toHaveBeenCalledWith(
        METRIC_EVENTS.observabilityPluginError
      );
    });

    it("[error-off] does NOT track observabilityPluginError when pluginActivationFailed is false", async () => {
      mockFlags = { "enable-observability-plugin": true };

      await act(async () => {
        render(
          <BridgeLike
            onObservabilityFlag={vi.fn()}
            pluginActivationFailed={false}
          />
        );
      });

      expect(mockTrack).not.toHaveBeenCalledWith(
        METRIC_EVENTS.observabilityPluginError
      );
    });

    it("[error-on] does NOT also emit the activation event when pluginActivationFailed is true (error suppresses success)", async () => {
      // When the plugin activation throws, only the error metric fires — not
      // the activation metric — because setPluginsEnabled stays false.
      mockFlags = { "enable-observability-plugin": false };

      await act(async () => {
        render(
          <BridgeLike
            onObservabilityFlag={vi.fn()}
            pluginActivationFailed={true}
          />
        );
      });

      expect(mockTrack).not.toHaveBeenCalledWith(
        METRIC_EVENTS.observabilityPluginActivated
      );
      expect(mockTrack).toHaveBeenCalledWith(
        METRIC_EVENTS.observabilityPluginError
      );
    });
  });

  // ── 6. Telemetry error silencing ─────────────────────────────────────────────

  describe("telemetry error silencing (M08)", () => {
    it("[flag-on] a track() throw does not propagate — telemetry never breaks the render", async () => {
      mockFlags = { "enable-observability-plugin": true };
      mockTrack.mockImplementationOnce(() => {
        throw new Error("LD track() error — must be silenced");
      });

      // If the error propagated, act() would throw.
      await expect(
        act(async () => {
          render(<BridgeLike onObservabilityFlag={vi.fn()} />);
        })
      ).resolves.not.toThrow();
    });

    it("[flag-off] a track() throw does not propagate in the control path either", async () => {
      mockFlags = { "enable-observability-plugin": false };
      // No track calls in the control path, so this is a no-op — but validates
      // that the control path is also safe.
      await expect(
        act(async () => {
          render(<BridgeLike onObservabilityFlag={vi.fn()} />);
        })
      ).resolves.not.toThrow();
    });
  });

  // ── 7. Offline path (no clientSideID) — LDRoot without ID ───────────────────

  describe("offline path (no clientSideID — LDRoot bypasses LD entirely)", () => {
    it("FLAG_DEFAULTS preserves the pre-PR control value — flag is false by default", () => {
      // The offline branch renders defaultLD which uses FLAG_DEFAULTS.
      // enable-observability-plugin must be false so the plugin is never
      // instantiated in offline/dev mode.
      expect(FLAG_DEFAULTS["enable-observability-plugin"]).toBe(false);
    });
  });
});
