import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const renderer = fs.readFileSync(
  path.resolve(here, "../src/render/unitRenderer.js"),
  "utf8",
);
const scenario = fs.readFileSync(
  path.resolve(here, "../src/engine/scenario.js"),
  "utf8",
);

assert.equal(
  renderer.includes(
    "getObservationVisualRange(unit, { role }) *"
  ),
  false,
  "View renderer must not multiply absolute observer hex range.",
);

assert.ok(
  renderer.includes("rgba(128, 194, 255, 0.11)"),
  "Gunner View fill should be visible during Stage 3 testing.",
);

for (let index = 1; index <= 6; index += 1) {
  const id = `E-VIEW-TEST-${String(index).padStart(2, "0")}`;
  assert.ok(
    scenario.includes(id),
    `Missing temporary observation target ${id}`,
  );
}

console.log("Sprint 4 Observation Stage 3B test-support checks passed.");
