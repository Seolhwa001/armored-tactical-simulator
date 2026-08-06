// ============================================================
// ATS PROJECT
// File      : src/engine/runtime/crewVisionRuntime.js
// Sprint    : 4
// Purpose   : Synchronize crew vision with hatch, hull and turret state
// ============================================================

import { normalizeAngle } from "../mathUtils.js";
import {
  CREW_ROLES,
  HATCH_STATES,
  OBSERVATION_MEANS,
  CREW_VISION_PROFILES,
  VISION_DIRECTION_OFFSETS_DEGREES,
  degreesToRadians,
} from "../contracts/index.js";

function applyProfile(observer, observationMean) {
  const profile = CREW_VISION_PROFILES[observationMean];
  if (!observer || !profile) return;

  observer.observationMean = observationMean;
  observer.range = profile.rangeHexes;
  observer.baseRange = profile.rangeHexes;
  observer.rangeMode = profile.rangeMode;
  observer.fieldOfView = degreesToRadians(profile.fieldOfViewDegrees);
  observer.baseFieldOfView = observer.fieldOfView;
}

function directionWithOffset(direction, offsetDegrees) {
  return normalizeAngle(direction + degreesToRadians(offsetDegrees));
}

export function synchronizeCrewVision(unit) {
  const crewObservation = unit?.crewObservation;
  if (!crewObservation) return crewObservation ?? null;

  const hullDirection = Number.isFinite(unit.hullDirection) ? unit.hullDirection : 0;
  const turretDirection = Number.isFinite(unit.turretDirection)
    ? unit.turretDirection
    : hullDirection;

  const commanderHatch =
    unit.crewHatches?.[CREW_ROLES.COMMANDER] ??
    unit.hatchState ??
    HATCH_STATES.OPEN;
  const loaderHatch =
    unit.crewHatches?.[CREW_ROLES.LOADER] ??
    unit.hatchState ??
    HATCH_STATES.OPEN;

  const commander = crewObservation.observers?.[CREW_ROLES.COMMANDER];
  if (commander) {
    const open = commanderHatch === HATCH_STATES.OPEN;
    applyProfile(
      commander,
      open
        ? OBSERVATION_MEANS.COMMANDER_VISUAL
        : OBSERVATION_MEANS.COMMANDER_CLOSED_HATCH,
    );
    if (!open) {
      commander.direction = directionWithOffset(
        turretDirection,
        VISION_DIRECTION_OFFSETS_DEGREES.COMMANDER_CLOSED_FROM_TURRET,
      );
    }
  }

  const gunner = crewObservation.observers?.[CREW_ROLES.GUNNER];
  if (gunner) {
    applyProfile(gunner, OBSERVATION_MEANS.GUNNER_MAIN_SIGHT);
    gunner.direction = turretDirection;
    gunner.targetDirection = turretDirection;
  }

  const loader = crewObservation.observers?.[CREW_ROLES.LOADER];
  if (loader) {
    const open = loaderHatch === HATCH_STATES.OPEN;
    applyProfile(
      loader,
      open
        ? OBSERVATION_MEANS.LOADER_VISUAL
        : OBSERVATION_MEANS.LOADER_CLOSED_HATCH,
    );
    if (!open) {
      loader.direction = directionWithOffset(
        turretDirection,
        VISION_DIRECTION_OFFSETS_DEGREES.LOADER_FROM_TURRET,
      );
    }
  }

  const driver = crewObservation.observers?.[CREW_ROLES.DRIVER];
  if (driver) {
    applyProfile(driver, OBSERVATION_MEANS.DRIVER_FORWARD);
    driver.direction = hullDirection;
    driver.targetDirection = hullDirection;
  }

  return crewObservation;
}
