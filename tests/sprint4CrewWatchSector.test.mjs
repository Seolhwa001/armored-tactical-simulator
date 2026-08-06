import assert from "node:assert/strict";
import {
  assignCrewWatchSector,
  advanceCrewWatchSectors,
  cancelCrewWatchSector,
} from "../src/engine/runtime/crewWatchSectorRuntime.js";
import { CREW_ROLES, CREW_TASK_STATES } from "../src/engine/contracts/index.js";

const observer = {
  enabled: true,
  observing: true,
  direction: 0,
  targetDirection: 0,
  observationMean: "commander-visual",
  crewTask: CREW_TASK_STATES.OBSERVING,
};
const unit = {
  destroyed: false,
  crewObservation: { observers: { [CREW_ROLES.COMMANDER]: observer } },
  crewHatchActions: { [CREW_ROLES.COMMANDER]: null },
  crewWatchSectors: {},
};

const assigned = assignCrewWatchSector(unit, CREW_ROLES.COMMANDER, {
  centerDirection: 0,
  halfWidthDegrees: 30,
  rotationDegreesPerSecond: 30,
  dwellSeconds: 1,
});
assert.equal(assigned.success, true);
assert.equal(Object.keys(unit.crewWatchSectors).length, 1);

advanceCrewWatchSectors(unit, 1, 1);
assert.ok(observer.direction < 0 || observer.direction > Math.PI);

observer.crewTask = CREW_TASK_STATES.AIMING;
advanceCrewWatchSectors(unit, 1, 2);
assert.equal(unit.crewWatchSectors.commander.state, "paused");

observer.crewTask = CREW_TASK_STATES.OBSERVING;
advanceCrewWatchSectors(unit, 1, 3);
assert.equal(unit.crewWatchSectors.commander.state, "active");

assert.equal(cancelCrewWatchSector(unit, CREW_ROLES.COMMANDER).success, true);
assert.equal(Object.keys(unit.crewWatchSectors).length, 0);
console.log("Sprint 4 crew watch-sector tests passed.");
