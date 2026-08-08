import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createProcedureCore,
  beginProcedureCore,
  prepareProcedureCore,
} from "../src/engine/procedureCore.js";

import {
  createProcedureViewModel,
} from "../src/engine/procedureViewModel.js";

const core = createProcedureCore({ turn: 1 });
beginProcedureCore(core, { turn: 1 });
prepareProcedureCore(core, {
  turn: 1,
  pendingAction: "generic-prepare",
  actionProgress: 0.33,
});

const fireControl = {
  procedure: {
    state: "aiming",
    active: true,
    startedTurn: 1,
    updatedTurn: 1,
    core,
  },
};

const view =
  createProcedureViewModel(
    fireControl,
  );

assert.equal(
  Object.isFrozen(view),
  true,
);

assert.equal(
  view.coreLabel,
  "준비",
);

assert.equal(
  view.coreProgressPercent,
  33,
);

const here =
  path.dirname(
    fileURLToPath(import.meta.url),
  );

const firePanelSource =
  fs.readFileSync(
    path.resolve(
      here,
      "../src/ui/firePanel.js",
    ),
    "utf8",
  );

assert.equal(
  firePanelSource.includes(
    "createProcedureViewModel",
  ),
  true,
);

assert.equal(
  firePanelSource.includes(
    "const commandDraft =",
  ),
  true,
);

assert.equal(
  firePanelSource.includes(
    "const procedure = {",
  ),
  false,
);

console.log("Sprint 4 Procedure Core Stage 2C tests passed.");
