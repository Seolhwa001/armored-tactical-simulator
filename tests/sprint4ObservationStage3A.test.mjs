import assert from "node:assert/strict";
import {
  createCrewObservation,
  SPRINT4_OBSERVATION_RANGES_HEX,
} from "../src/engine/runtime/crewFactory.js";
import { CREW_ROLES } from "../src/engine/runtime/runtimeConstants.js";

const observation = createCrewObservation({ hullDirection: 0 });
const observers = observation.observers;

assert.equal(SPRINT4_OBSERVATION_RANGES_HEX.COMMANDER_OPEN_VISUAL, 16);
assert.equal(SPRINT4_OBSERVATION_RANGES_HEX.COMMANDER_CLOSED_VISUAL, 2);
assert.equal(SPRINT4_OBSERVATION_RANGES_HEX.COMMANDER_CPS, 36);
assert.equal(SPRINT4_OBSERVATION_RANGES_HEX.GUNNER_MAIN_SIGHT, 40);
assert.equal(SPRINT4_OBSERVATION_RANGES_HEX.LOADER_OPEN_VISUAL, 16);
assert.equal(SPRINT4_OBSERVATION_RANGES_HEX.LOADER_CLOSED_VISUAL, 2);
assert.equal(SPRINT4_OBSERVATION_RANGES_HEX.DRIVER_FORWARD, 2);

assert.equal(observers[CREW_ROLES.COMMANDER].range, 16);
assert.equal(observers[CREW_ROLES.GUNNER].range, 40);
assert.equal(observers[CREW_ROLES.DRIVER].range, 2);
assert.equal(observers[CREW_ROLES.LOADER].range, 16);
assert.equal(observation.commanderIndependentSight.range, 36);

assert.ok(
  Math.abs(
    observers[CREW_ROLES.GUNNER].fieldOfView -
    (8 * Math.PI / 180)
  ) < 1e-10
);
assert.ok(
  Math.abs(
    observation.commanderIndependentSight.fieldOfView -
    (10 * Math.PI / 180)
  ) < 1e-10
);

console.log("Sprint 4 Observation Stage 3A contract tests passed.");
