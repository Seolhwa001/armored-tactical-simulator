import assert from "node:assert/strict";

import {
  PROCEDURE_CORE_STATES,
  beginProcedureCore,
  cancelProcedureCore,
  createProcedureCore,
  executeProcedureCore,
  markProcedureCoreReady,
  prepareProcedureCore,
  resetProcedureCore,
  reviseProcedureCore,
  updateProcedureCoreProgress,
  advanceProcedureCoreTurn,
} from "../src/engine/procedureCore.js";

for (let cycle = 1; cycle <= 10; cycle += 1) {
  const core = createProcedureCore({
    turn: cycle * 10,
  });

  assert.equal(
    beginProcedureCore(core, {
      turn: cycle * 10,
    }),
    true,
  );

  assert.equal(
    prepareProcedureCore(core, {
      turn: cycle * 10,
      pendingAction: "prepare",
      actionProgress: 0.25,
    }),
    true,
  );

  assert.equal(
    advanceProcedureCoreTurn(
      core,
      cycle * 10 + 1,
    ),
    true,
  );

  assert.equal(
    core.state,
    PROCEDURE_CORE_STATES.PREPARE,
  );

  assert.equal(
    core.actionProgress,
    0.25,
  );

  assert.equal(
    reviseProcedureCore(core, {
      turn: cycle * 10 + 1,
    }),
    true,
  );

  assert.equal(
    core.state,
    PROCEDURE_CORE_STATES.COMMAND,
  );

  assert.equal(
    prepareProcedureCore(core, {
      turn: cycle * 10 + 1,
      actionProgress: 0.5,
    }),
    true,
  );

  assert.equal(
    updateProcedureCoreProgress(core, {
      turn: cycle * 10 + 2,
      actionProgress: 1,
    }),
    true,
  );

  assert.equal(
    markProcedureCoreReady(core, {
      turn: cycle * 10 + 2,
    }),
    true,
  );

  assert.equal(
    executeProcedureCore(core, {
      turn: cycle * 10 + 2,
    }),
    true,
  );

  assert.equal(
    cancelProcedureCore(core, {
      turn: cycle * 10 + 3,
      reason: "cycle-complete",
    }),
    true,
  );

  assert.equal(
    core.state,
    PROCEDURE_CORE_STATES.END,
  );

  assert.equal(
    resetProcedureCore(core, {
      turn: cycle * 10 + 4,
    }),
    true,
  );

  assert.equal(
    core.state,
    PROCEDURE_CORE_STATES.IDLE,
  );
}

console.log(
  "Sprint 4 Procedure Core Stage 2E 10-cycle stability tests passed.",
);
