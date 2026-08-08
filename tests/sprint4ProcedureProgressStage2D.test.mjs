import assert from "node:assert/strict";

import {
  AMMUNITION_TYPES,
  FIRE_PROCEDURE_STATES,
  createFireControl,
  issueFireCommand,
  setFireTarget,
} from "../src/engine/fireControl.js";

import {
  createTurretControl,
} from "../src/engine/turretControl.js";

function createTestUnit() {
  const unit = {
    id: "friendly-test",
    side: "friendly",
    destroyed: false,
    column: 0,
    row: 0,
    hullDirection: 0,
    turretDirection: 0,
    command: "대기",
  };

  unit.turretControl =
    createTurretControl(unit);

  unit.fireControl =
    createFireControl();

  return unit;
}

const unit = createTestUnit();

assert.equal(
  setFireTarget(
    unit,
    {
      column: 1,
      row: 0,
      unitId: "mock-target",
    },
    AMMUNITION_TYPES.APFSDS,
    1,
  ),
  true,
);

unit.fireControl.loaded = true;
unit.fireControl.loadedAmmunition =
  AMMUNITION_TYPES.APFSDS;

const result =
  issueFireCommand(
    unit,
    1,
  );

assert.equal(result.success, true);

assert.equal(
  unit.fireControl.procedureState,
  FIRE_PROCEDURE_STATES.READY_TO_FIRE,
  "Aligned, already prepared procedure must not wait for turn > aimStartedTurn",
);

assert.equal(
  unit.fireControl.procedure.core.actionProgress,
  1,
  "Generic Procedure Core progress should reach completion",
);

assert.equal(
  unit.command,
  "발사 준비",
);

console.log("Sprint 4 Procedure Progress Stage 2D tests passed.");
