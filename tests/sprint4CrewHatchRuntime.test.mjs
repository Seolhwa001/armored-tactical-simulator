import assert from "node:assert/strict";

import { createRuntimeUnit } from "../src/engine/runtime/unitFactory.js";
import {
  beginCrewHatchTransition,
  advanceCrewHatchTransitions,
} from "../src/engine/runtime/crewHatchRuntime.js";
import {
  CREW_ROLES,
  HATCH_STATES,
  OBSERVATION_MEANS,
  TACTICAL_DISTANCE_HEXES,
} from "../src/engine/contracts/index.js";

const unit = createRuntimeUnit({
  id: "friendly-tank-hatch",
  side: "friendly",
  type: "tank",
  hullDirection: 0,
  turretDirection: 0,
});

let result = beginCrewHatchTransition(unit, CREW_ROLES.COMMANDER, HATCH_STATES.CLOSED, { turn: 1 });
assert.equal(result.success, true);
assert.equal(result.completed, false);
assert.equal(unit.crewHatches[CREW_ROLES.COMMANDER], HATCH_STATES.CLOSING);
assert.equal(unit.crewObservation.observers[CREW_ROLES.COMMANDER].observing, false);

result = advanceCrewHatchTransitions(unit, 1, 1);
assert.equal(result.completed.length, 1);
assert.equal(unit.crewHatches[CREW_ROLES.COMMANDER], HATCH_STATES.CLOSED);
assert.equal(unit.crewObservation.observers[CREW_ROLES.COMMANDER].observing, true);
assert.equal(unit.crewObservation.observers[CREW_ROLES.COMMANDER].observationMean, OBSERVATION_MEANS.COMMANDER_CLOSED_HATCH);
assert.equal(unit.crewObservation.observers[CREW_ROLES.COMMANDER].range, TACTICAL_DISTANCE_HEXES.CLOSED_HATCH_VISUAL);

unit.fireControl.loading = true;
result = beginCrewHatchTransition(unit, CREW_ROLES.LOADER, HATCH_STATES.OPEN, { turn: 2 });
assert.equal(result.success, false);

unit.fireControl.loading = false;
unit.crewHatches[CREW_ROLES.LOADER] = HATCH_STATES.CLOSED;
result = beginCrewHatchTransition(unit, CREW_ROLES.LOADER, HATCH_STATES.OPEN, { turn: 2 });
assert.equal(result.success, true);
advanceCrewHatchTransitions(unit, 1, 2);
assert.equal(unit.crewHatches[CREW_ROLES.LOADER], HATCH_STATES.OPEN);
assert.equal(unit.hatchState, HATCH_STATES.OPEN);

console.log("Sprint 4 crew hatch runtime tests passed.");
