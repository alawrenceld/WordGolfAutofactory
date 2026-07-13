/**
 * Guard against config/metrics.json drifting from METRIC_EVENTS in code.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { METRIC_EVENTS } from "../src/events.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configMetrics = JSON.parse(
  readFileSync(join(__dirname, "../../../config/metrics.json"), "utf8")
) as { metrics: { key: string }[] };

test("config/metrics.json includes every METRIC_EVENTS value", () => {
  const fromTs = [...new Set(Object.values(METRIC_EVENTS))].sort();
  const fromJson = configMetrics.metrics.map((m) => m.key).sort();
  for (const key of fromTs) {
    assert.ok(
      fromJson.includes(key),
      `config/metrics.json is missing METRIC_EVENTS key: ${key}`
    );
  }
});
