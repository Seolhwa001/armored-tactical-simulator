import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here =
  path.dirname(
    fileURLToPath(import.meta.url),
  );

const source =
  fs.readFileSync(
    path.resolve(
      here,
      "../src/ui/firePanel.js",
    ),
    "utf8",
  );

assert.equal(
  source.includes(
    "function createFireUiSnapshot",
  ),
  true,
  "Fire Panel must derive one UI snapshot per render",
);

assert.equal(
  source.includes(
    "const readyToExecute =\n      fireUi.readyToExecute;",
  ),
  true,
  "READY display and action controls must share one readiness value",
);

const directReadyComparisons =
  (
    source.match(
      /procedureState\s*!==\s*FIRE_PROCEDURE_STATES\s*\.READY_TO_FIRE/g,
    ) ?? []
  ).length;

assert.equal(
  directReadyComparisons,
  0,
  "Execution buttons should not independently re-evaluate READY state",
);

console.log("Sprint 4 READY/UI consistency test passed.");
