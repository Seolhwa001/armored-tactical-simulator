import assert from "node:assert/strict";

import {
  FIRE_PROCEDURE_STATES,
  advanceFireProcedureTurn,
  createCrewState,
  createFireProcedure,
  createMockTargetReference,
  createWeaponState,
  setFireProcedureState,
  setFireProcedureTarget,
} from "../src/engine/fireProcedure.js";

import {
  createFireControl,
} from "../src/engine/fireControl.js";

const procedure = createFireProcedure({ turn: 3 });
const mockTarget = createMockTargetReference({
  id: "mock-enemy-1",
  position: { column: 5, row: 2 },
  direction: 0.5,
  distance: 7,
  estimatedType: "tank",
});

assert.equal(
  setFireProcedureTarget(procedure, mockTarget, 3),
  true,
);
assert.equal(
  procedure.state,
  FIRE_PROCEDURE_STATES.TARGET_DESIGNATED,
);
assert.equal(procedure.target.id, "mock-enemy-1");

procedure.weapon = createWeaponState({
  ammunition: "apfsds",
  loadedAmmunition: "apfsds",
  loaded: true,
});
procedure.crew = createCrewState({
  assignedCrewRole: "gunner",
  currentTask: "target-confirmation",
});
procedure.time.actionProgress = 0.4;

setFireProcedureState(
  procedure,
  FIRE_PROCEDURE_STATES.AIMING,
  3,
);
for (let turn = 4; turn <= 13; turn += 1) {
  advanceFireProcedureTurn(procedure, turn);
}

assert.equal(
  procedure.state,
  FIRE_PROCEDURE_STATES.AIMING,
  "turn change must not reset Fire Procedure state",
);
assert.equal(
  procedure.target.id,
  "mock-enemy-1",
  "turn change must preserve target",
);
assert.equal(
  procedure.weapon.loadedAmmunition,
  "apfsds",
  "turn change must preserve weapon state",
);
assert.equal(
  procedure.time.actionProgress,
  0.4,
  "turn change must preserve work progress",
);
assert.equal(procedure.time.currentTurn, 13);

const fireControl = createFireControl();
assert.equal(
  fireControl.procedureState,
  FIRE_PROCEDURE_STATES.STOPPED,
);
fireControl.procedureState = FIRE_PROCEDURE_STATES.LOADING;
assert.equal(
  fireControl.procedure.state,
  FIRE_PROCEDURE_STATES.LOADING,
  "legacy procedureState must reference the new procedure Source of Truth",
);
fireControl.procedureTurn = 8;
assert.equal(fireControl.procedure.time.currentTurn, 8);

console.log("Sprint 4 Fire Procedure Stage 1 tests passed.");
