import assert from "node:assert/strict";

import {
  createProcedureCore,
  beginProcedureCore,
  prepareProcedureCore,
  updateProcedureCoreProgress,
} from "../src/engine/procedureCore.js";

import {
  createProcedureViewModel,
} from "../src/engine/procedureViewModel.js";

const core = createProcedureCore({ turn: 1 });

assert.equal(
  beginProcedureCore(core, { turn: 1 }),
  true,
);

assert.equal(
  prepareProcedureCore(core, {
    turn: 1,
    pendingAction: "generic-prepare",
    actionProgress: 0.4,
  }),
  true,
);

assert.equal(
  updateProcedureCoreProgress(core, {
    turn: 2,
    actionProgress: 0.65,
  }),
  true,
);

const fireControl = {
  procedure: {
    state: "aiming",
    active: true,
    startedTurn: 1,
    updatedTurn: 2,
    core,
  },
};

const view =
  createProcedureViewModel(
    fireControl,
  );

assert.equal(
  view.coreLabel,
  "준비",
);

assert.equal(
  view.coreProgressPercent,
  65,
);

assert.equal(
  view.active,
  true,
);

console.log("Sprint 4 Procedure Core Stage 2B behavior tests passed.");
