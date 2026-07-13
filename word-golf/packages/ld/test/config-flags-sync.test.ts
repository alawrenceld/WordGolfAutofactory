/**
 * Guard against config/flags.json drifting from packages/ld/src/flags.ts.
 * AUTOFACTORY-SETUP.md describes flags.json as the declarative source of truth;
 * this test fails CI if a flag is wired in code but not documented in config.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { FLAG_KEYS } from "../src/flags.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configFlags = JSON.parse(
  readFileSync(join(__dirname, "../../../config/flags.json"), "utf8")
) as { flags: { key: string }[] };

test("config/flags.json keys match FLAG_KEYS values exactly", () => {
  const fromTs = [...Object.values(FLAG_KEYS)].sort();
  const fromJson = configFlags.flags.map((f) => f.key).sort();
  assert.deepEqual(
    fromJson,
    fromTs,
    "config/flags.json and FLAG_KEYS must list the same flag keys"
  );
});
