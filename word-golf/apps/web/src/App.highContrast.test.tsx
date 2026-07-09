/**
 * Flag-path tests for `enable-high-contrast-mode` (PR #11).
 *
 * Covers the four key invariants identified by the Flag Implementer:
 *   T01-off : flag off  -> button absent, <main> has no high-contrast class
 *   T01-on0 : flag on + toggle off -> button present (aria-pressed=false)
 *   T01-on1 : flag on + toggle on  -> button (aria-pressed=true) + class applied
 *   T01-flip: flag flipped off mid-session -> class removed regardless of local state
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App.js";

// ---------------------------------------------------------------------------
// Hoisted mocks -- must be set up before any imports are evaluated.
// ---------------------------------------------------------------------------

const mockUseFlag = vi.hoisted(() =>
  vi.fn((_key: string): boolean => false)
);

/** Fully mock @word-golf/ld to avoid pulling in launchdarkly-react-client-sdk. */
vi.mock("@word-golf/ld", () => ({
  useFlag: mockUseFlag,
  useTrack: () => () => {},
  FLAG_KEYS: {
    highContrastMode: "enable-high-contrast-mode",
    showMissionControl: "show-mission-control",
  },
  METRIC_EVENTS: {
    puzzleCompleted: "puzzle_completed",
    puzzleAbandoned: "puzzle_abandoned",
    invalidMove: "invalid_move",
    moveLatencyMs: "move_latency_ms",
    timeToSolveMs: "time_to_solve_ms",
    madePar: "made_par",
    dailyReturned: "daily_returned",
    resultShared: "result_shared",
  },
}));

/** Mock words.js to bypass the heavy ?raw Vite imports at module load time. */
vi.mock("./words.js", () => ({
  graph: new Map(),
  startPool: ["match"],
  targetPool: ["march"],
}));

/** Stub engine to return a deterministic puzzle; pass other exports through. */
vi.mock("@word-golf/engine", () => ({
  makeDailyPuzzle: () => ({ start: "match", target: "march", par: 3 }),
  validateMove: () => ({ ok: false, reason: "not-a-word" }),
  scoreLabel: () => "Par",
  utcDateString: () => "2026-07-09",
  WORD_LENGTH: 5,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Configure the flag mock by key. Unmentioned keys default to false. */
function setFlags(overrides: Record<string, boolean> = {}) {
  mockUseFlag.mockImplementation((key: string) => overrides[key] ?? false);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("enable-high-contrast-mode flag-path tests", () => {
  beforeEach(() => {
    mockUseFlag.mockReset();
    mockUseFlag.mockReturnValue(false);
  });

  // -------------------------------------------------------------------------
  // T01-off: flag = false
  // -------------------------------------------------------------------------
  describe("flag OFF (enable-high-contrast-mode = false)", () => {
    it("does not render the contrast-toggle button", () => {
      render(<App />);
      expect(
        screen.queryByRole("button", { name: /high contrast/i })
      ).toBeNull();
    });

    it("<main> does not carry the high-contrast class", () => {
      render(<App />);
      expect(screen.getByRole("main")).not.toHaveClass("high-contrast");
    });
  });

  // -------------------------------------------------------------------------
  // T01-on0: flag = true, toggle not yet clicked
  // -------------------------------------------------------------------------
  describe("flag ON, toggle OFF (initial render after flag enabled)", () => {
    beforeEach(() => {
      setFlags({ "enable-high-contrast-mode": true });
    });

    it("renders the contrast-toggle button", () => {
      render(<App />);
      expect(
        screen.getByRole("button", { name: "High contrast" })
      ).toBeInTheDocument();
    });

    it("button has aria-pressed=false", () => {
      render(<App />);
      expect(
        screen.getByRole("button", { name: "High contrast" })
      ).toHaveAttribute("aria-pressed", "false");
    });

    it("<main> does NOT have the high-contrast class before toggle", () => {
      render(<App />);
      expect(screen.getByRole("main")).not.toHaveClass("high-contrast");
    });
  });

  // -------------------------------------------------------------------------
  // T01-on1: flag = true, toggle clicked ON
  // -------------------------------------------------------------------------
  describe("flag ON, toggle ON (user clicks the button)", () => {
    beforeEach(() => {
      setFlags({ "enable-high-contrast-mode": true });
    });

    it("button switches to aria-pressed=true after click", () => {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "High contrast" }));
      expect(
        screen.getByRole("button", { name: "Standard colors" })
      ).toHaveAttribute("aria-pressed", "true");
    });

    it('button label changes to "Standard colors"', () => {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "High contrast" }));
      expect(
        screen.getByRole("button", { name: "Standard colors" })
      ).toBeInTheDocument();
    });

    it("<main> gains the high-contrast class after toggle", () => {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "High contrast" }));
      expect(screen.getByRole("main")).toHaveClass("high-contrast");
    });

    it("clicking the button again removes the high-contrast class", () => {
      render(<App />);
      const btn = screen.getByRole("button", { name: "High contrast" });
      fireEvent.click(btn);
      fireEvent.click(screen.getByRole("button", { name: "Standard colors" }));
      expect(screen.getByRole("main")).not.toHaveClass("high-contrast");
    });
  });

  // -------------------------------------------------------------------------
  // T01-flip: flag flipped OFF mid-session while local toggle state is ON
  // -------------------------------------------------------------------------
  describe("flag flipped OFF mid-session (effectiveHighContrast regression)", () => {
    it("removes high-contrast class even when local highContrast state is true", () => {
      setFlags({ "enable-high-contrast-mode": true });
      const { rerender } = render(<App />);

      fireEvent.click(screen.getByRole("button", { name: "High contrast" }));
      expect(screen.getByRole("main")).toHaveClass("high-contrast");

      // LaunchDarkly delivers a flag update: enable-high-contrast-mode -> false.
      mockUseFlag.mockReturnValue(false);
      rerender(<App />);

      // effectiveHighContrast = false && true = false -> class must be absent.
      expect(screen.getByRole("main")).not.toHaveClass("high-contrast");
    });

    it("hides the toggle button when flag turns off mid-session", () => {
      setFlags({ "enable-high-contrast-mode": true });
      const { rerender } = render(<App />);

      expect(
        screen.getByRole("button", { name: "High contrast" })
      ).toBeInTheDocument();

      mockUseFlag.mockReturnValue(false);
      rerender(<App />);

      expect(
        screen.queryByRole("button", { name: /high contrast|standard colors/i })
      ).toBeNull();
    });
  });
});
