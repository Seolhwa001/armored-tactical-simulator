import assert from "node:assert/strict";

import {
  PROCEDURE_CORE_STATES,
  advanceProcedureCoreTurn,
  beginProcedureCore,
  cancelProcedureCore,
  createProcedureCore,
  executeProcedureCore,
  markProcedureCoreReady,
  prepareProcedureCore,
  resetProcedureCore,
  reviseProcedureCore,
  updateProcedureCoreProgress,
} from "../src/engine/procedureCore.js";

import {
  FIRE_PROCEDURE_STATES,
  createFireProcedure,
  setFireProcedureState,
} from "../src/engine/fireProcedure.js";

const core = createProcedureCore({ turn: 1 });

assert.equal(core.state, PROCEDURE_CORE_STATES.IDLE);
assert.equal(beginProcedureCore(core, { turn: 1 }), true);
assert.equal(core.state, PROCEDURE_CORE_STATES.COMMAND);

assert.equal(
  prepareProcedureCore(core, {
    turn: 1,
    pendingAction: "generic-prepare",
    actionProgress: 0.25,
  }),
  true,
);
assert.equal(core.state, PROCEDURE_CORE_STATES.PREPARE);
assert.equal(core.actionProgress, 0.25);

for (let turn = 2; turn <= 11; turn += 1) {
  assert.equal(advanceProcedureCoreTurn(core, turn), true);
  assert.equal(core.state, PROCEDURE_CORE_STATES.PREPARE);
  assert.equal(core.actionProgress, 0.25);
  assert.equal(core.pendingAction, "generic-prepare");
}

assert.equal(
  updateProcedureCoreProgress(core, {
    turn: 11,
    actionProgress: 0.8,
  }),
  true,
);
assert.equal(core.actionProgress, 0.8);

assert.equal(markProcedureCoreReady(core, { turn: 11 }), true);
assert.equal(core.state, PROCEDURE_CORE_STATES.READY);

assert.equal(
  reviseProcedureCore(core, {
    turn: 12,
    pendingAction: "revised-command",
  }),
  true,
);
assert.equal(core.state, PROCEDURE_CORE_STATES.COMMAND);
assert.equal(core.actionProgress, 0);

assert.equal(prepareProcedureCore(core, { turn: 12 }), true);
assert.equal(markProcedureCoreReady(core, { turn: 12 }), true);
assert.equal(executeProcedureCore(core, { turn: 12 }), true);
assert.equal(core.state, PROCEDURE_CORE_STATES.EXECUTE);

assert.equal(
  cancelProcedureCore(core, {
    turn: 13,
    reason: "test-cancel",
  }),
  true,
);
assert.equal(core.state, PROCEDURE_CORE_STATES.END);
assert.equal(core.lastEndReason, "test-cancel");

assert.equal(resetProcedureCore(core, { turn: 14 }), true);
assert.equal(core.state, PROCEDURE_CORE_STATES.IDLE);

const fireProcedure = createFireProcedure({ turn: 20 });

setFireProcedureState(
  fireProcedure,
  FIRE_PROCEDURE_STATES.TARGET_DESIGNATED,
  20,
);
assert.equal(
  fireProcedure.core.state,
  PROCEDURE_CORE_STATES.COMMAND,
);

setFireProcedureState(
  fireProcedure,
  FIRE_PROCEDURE_STATES.AIMING,
  21,
);
assert.equal(
  fireProcedure.core.state,
  PROCEDURE_CORE_STATES.PREPARE,
);

setFireProcedureState(
  fireProcedure,
  FIRE_PROCEDURE_STATES.READY_TO_FIRE,
  22,
);
assert.equal(
  fireProcedure.core.state,
  PROCEDURE_CORE_STATES.READY,
);

console.log("Sprint 4 generic Procedure Core Stage 2A tests passed.");
