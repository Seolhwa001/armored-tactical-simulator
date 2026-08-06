import assert from "node:assert/strict";

import { createRuntimeUnit } from "../src/engine/runtime/unitFactory.js";
import { synchronizeCrewVision } from "../src/engine/runtime/crewVisionRuntime.js";
import {
  CREW_ROLES,
  HATCH_STATES,
  OBSERVATION_MEANS,
  TACTICAL_DISTANCE_HEXES,
  VISION_ANGLES_DEGREES,
} from "../src/engine/contracts/index.js";

const unit = createRuntimeUnit({
  id: "friendly-tank-1",
  side: "friendly",
  type: "tank",
  hullDirection: 0,
  turretDirection: Math.PI / 4,
});

synchronizeCrewVision(unit);

const observers = unit.crewObservation.observers;
assert.equal(observers[CREW_ROLES.COMMANDER].range, TACTICAL_DISTANCE_HEXES.OPEN_HATCH_VISUAL);
assert.equal(observers[CREW_ROLES.GUNNER].range, TACTICAL_DISTANCE_HEXES.GUNNER_MAIN_SIGHT);
assert.equal(observers[CREW_ROLES.DRIVER].range, TACTICAL_DISTANCE_HEXES.DRIVER_FORWARD_VISUAL);
assert.equal(observers[CREW_ROLES.LOADER].range, TACTICAL_DISTANCE_HEXES.OPEN_HATCH_VISUAL);
assert.equal(observers[CREW_ROLES.GUNNER].observationMean, OBSERVATION_MEANS.GUNNER_MAIN_SIGHT);
assert.ok(Math.abs(observers[CREW_ROLES.GUNNER].fieldOfView * 180 / Math.PI - VISION_ANGLES_DEGREES.GUNNER_MAIN_SIGHT) < 1e-9);
assert.equal(unit.crewObservation.commanderIndependentSight.range, TACTICAL_DISTANCE_HEXES.COMMANDER_CPS);

unit.crewHatches[CREW_ROLES.COMMANDER] = HATCH_STATES.CLOSED;
unit.crewHatches[CREW_ROLES.LOADER] = HATCH_STATES.CLOSED;
synchronizeCrewVision(unit);
assert.equal(observers[CREW_ROLES.COMMANDER].range, TACTICAL_DISTANCE_HEXES.CLOSED_HATCH_VISUAL);
assert.equal(observers[CREW_ROLES.COMMANDER].observationMean, OBSERVATION_MEANS.COMMANDER_CLOSED_HATCH);
assert.equal(observers[CREW_ROLES.LOADER].range, TACTICAL_DISTANCE_HEXES.CLOSED_HATCH_VISUAL);
assert.equal(observers[CREW_ROLES.LOADER].observationMean, OBSERVATION_MEANS.LOADER_CLOSED_HATCH);
assert.equal(observers[CREW_ROLES.GUNNER].direction, unit.turretDirection);
assert.equal(observers[CREW_ROLES.DRIVER].direction, unit.hullDirection);

console.log("Sprint 4 crew vision tests passed.");
