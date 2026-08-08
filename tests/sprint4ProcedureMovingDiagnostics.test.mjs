import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const actions = fs.readFileSync(
  path.resolve(here, "../src/engine/actions.js"),
  "utf8",
);

const fireControl = fs.readFileSync(
  path.resolve(here, "../src/engine/fireControl.js"),
  "utf8",
);

const firePanel = fs.readFileSync(
  path.resolve(here, "../src/ui/firePanel.js"),
  "utf8",
);

assert.equal(
  actions.includes("updateFireProcedure?.(\n            unit,\n            turn,\n            {\n              moving,"),
  true,
  "Movement context must reach the procedure updater",
);

assert.equal(
  fireControl.includes("procedureDiagnostics"),
  true,
  "Runtime should expose transient procedure diagnostics",
);

assert.equal(
  firePanel.includes("진단 · 이동"),
  true,
);

assert.equal(
  firePanel.includes("진단 · 포탑정렬"),
  true,
);

console.log("Sprint 4 moving-procedure diagnostics test passed.");
