import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROCEDURE_CORE_STATES,
  createProcedureCore,
  beginProcedureCore,
  prepareProcedureCore,
  updateProcedureCoreProgress,
} from "../src/engine/procedureCore.js";

const core = createProcedureCore({ turn: 1 });
assert.equal(beginProcedureCore(core, { turn: 1 }), true);
assert.equal(
  prepareProcedureCore(core, {
    turn: 1,
    pendingAction: "generic-prepare",
    actionProgress: 0.4,
  }),
  true,
);
assert.equal(core.state, PROCEDURE_CORE_STATES.PREPARE);
assert.equal(core.actionProgress, 0.4);

assert.equal(
  updateProcedureCoreProgress(core, {
    turn: 2,
    actionProgress: 0.65,
  }),
  true,
);
assert.equal(core.actionProgress, 0.65);

const here = path.dirname(fileURLToPath(import.meta.url));
const firePanelPath = path.resolve(here, "../src/ui/firePanel.js");
const firePanelSource = fs.readFileSync(firePanelPath, "utf8");

assert.equal(
  firePanelSource.includes("fireControl.procedure?.core"),
  true,
  "Fire Panel must read the Runtime-owned Procedure Core",
);

assert.equal(
  firePanelSource.includes("const procedureCore = {"),
  false,
  "Fire Panel must not create its own Procedure Core state",
);

assert.equal(
  firePanelSource.includes("Core 단계"),
  true,
  "Fire Panel should expose the generic Core phase",
);

assert.equal(
  firePanelSource.includes("Core 진행도"),
  true,
  "Fire Panel should expose generic Core progress",
);

console.log("Sprint 4 Procedure Core Stage 2B tests passed.");
