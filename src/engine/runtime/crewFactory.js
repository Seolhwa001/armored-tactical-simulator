// ============================================================
// ATS PROJECT
// File      : src/engine/runtime/crewFactory.js
// Sprint    : 3.9.1
// Revision  : R4
// Build     : 2026-08-06
// Type      : PARTIAL PATCH
// Purpose   : Crew observation factory with role-specific observation sectors
// ============================================================

import {
  normalizeAngle,
} from "../mathUtils.js";

import {
  CREW_ROLES,
  HUNTER_KILLER_STATES,
} from "./runtimeConstants.js";

const DEFAULT_IDENTIFICATION_FACTOR =
  1;

const COMMANDER_SIGHT_ROTATION_RATE =
  Math.PI / 4;

const LOADER_SIDE_OFFSET =
  Math.PI / 2;

export const SPRINT4_OBSERVATION_RANGES_HEX =
  Object.freeze({
    COMMANDER_OPEN_VISUAL: 16,
    COMMANDER_CLOSED_VISUAL: 2,
    COMMANDER_CPS: 36,
    GUNNER_MAIN_SIGHT: 40,
    LOADER_OPEN_VISUAL: 16,
    LOADER_CLOSED_VISUAL: 2,
    DRIVER_FORWARD: 2,
  });

export const SPRINT4_OBSERVATION_FOV =
  Object.freeze({
    COMMANDER_VISUAL:
      Math.PI / 2,
    COMMANDER_CPS:
      10 * Math.PI / 180,
    GUNNER_MAIN_SIGHT:
      8 * Math.PI / 180,
    LOADER_VISUAL:
      Math.PI / 2.2,
    DRIVER_FORWARD:
      Math.PI / 2.5,
  });

function finiteOrDefault(
  value,
  fallback,
) {
  return Number.isFinite(value)
    ? value
    : fallback;
}

function nonNegativeOrDefault(
  value,
  fallback,
) {
  return Math.max(
    0,
    finiteOrDefault(
      value,
      fallback,
    ),
  );
}

function positiveOrDefault(
  value,
  fallback,
) {
  return Math.max(
    0.01,
    finiteOrDefault(
      value,
      fallback,
    ),
  );
}

function createCrewObserver({
  direction,
  fieldOfView,
  range,
  identificationFactor =
    DEFAULT_IDENTIFICATION_FACTOR,
  observing = true,
  observationMode = "normal",
}) {
  const safeDirection =
    normalizeAngle(direction);

  const safeFieldOfView =
    positiveOrDefault(
      fieldOfView,
      Math.PI / 2,
    );

  const safeRange =
    nonNegativeOrDefault(
      range,
      1,
    );

  const safeIdentificationFactor =
    nonNegativeOrDefault(
      identificationFactor,
      DEFAULT_IDENTIFICATION_FACTOR,
    );

  return {
    enabled: true,
    observing,

    direction:
      safeDirection,

    targetDirection:
      safeDirection,

    assignedDirection:
      null,

    fieldOfView:
      safeFieldOfView,

    baseFieldOfView:
      safeFieldOfView,

    range:
      safeRange,

    baseRange:
      safeRange,

    identificationFactor:
      safeIdentificationFactor,

    baseIdentificationFactor:
      safeIdentificationFactor,

    observationMode,

    lastUpdatedTurn:
      null,
  };
}

function createCommanderSight(
  hullDirection,
) {
  const safeDirection =
    normalizeAngle(
      hullDirection,
    );

  const fieldOfView =
    SPRINT4_OBSERVATION_FOV
      .COMMANDER_CPS;

  const range =
    SPRINT4_OBSERVATION_RANGES_HEX
      .COMMANDER_CPS;

  const identificationFactor =
    1.2;

  return {
    operational: true,
    active: false,

    direction:
      safeDirection,

    targetDirection:
      safeDirection,

    rotationRate:
      COMMANDER_SIGHT_ROTATION_RATE,

    fieldOfView,

    baseFieldOfView:
      fieldOfView,

    range,

    baseRange:
      range,

    identificationFactor,

    baseIdentificationFactor:
      identificationFactor,

    targetUnitId:
      null,

    locked: false,
    tracking: false,

    lastUpdatedTurn:
      null,
  };
}

function createHunterKillerState() {
  return {
    enabled: true,

    state:
      HUNTER_KILLER_STATES
        .SEARCHING,

    detectedTargetUnitId:
      null,

    designatedTargetUnitId:
      null,

    handedOffTargetUnitId:
      null,

    lastDetectedTurn:
      null,
  };
}

export function createCrewObservation({
  hullDirection = 0,
} = {}) {
  const safeHullDirection =
    normalizeAngle(
      hullDirection,
    );

  const loaderInitialDirection =
    normalizeAngle(
      safeHullDirection +
      LOADER_SIDE_OFFSET,
    );

  return {
    observers: {
      [CREW_ROLES.COMMANDER]:
        createCrewObserver({
          direction:
            safeHullDirection,

          fieldOfView:
            SPRINT4_OBSERVATION_FOV
              .COMMANDER_VISUAL,

          range:
            SPRINT4_OBSERVATION_RANGES_HEX
              .COMMANDER_OPEN_VISUAL,

          identificationFactor:
            1,

          observing:
            true,

          observationMode:
            "visual",
        }),

      [CREW_ROLES.GUNNER]:
        createCrewObserver({
          direction:
            safeHullDirection,

          fieldOfView:
            SPRINT4_OBSERVATION_FOV
              .GUNNER_MAIN_SIGHT,

          range:
            SPRINT4_OBSERVATION_RANGES_HEX
              .GUNNER_MAIN_SIGHT,

          identificationFactor:
            0.9,

          observing:
            true,

          observationMode:
            "turret-coupled",
        }),

      [CREW_ROLES.DRIVER]:
        createCrewObserver({
          direction:
            safeHullDirection,

          fieldOfView:
            SPRINT4_OBSERVATION_FOV
              .DRIVER_FORWARD,

          range:
            SPRINT4_OBSERVATION_RANGES_HEX
              .DRIVER_FORWARD,

          identificationFactor:
            0.45,

          observing:
            true,

          observationMode:
            "hull-forward",
        }),

      [CREW_ROLES.LOADER]:
        createCrewObserver({
          direction:
            loaderInitialDirection,

          fieldOfView:
            SPRINT4_OBSERVATION_FOV
              .LOADER_VISUAL,

          range:
            SPRINT4_OBSERVATION_RANGES_HEX
              .LOADER_OPEN_VISUAL,

          identificationFactor:
            0.5,

          observing:
            true,

          observationMode:
            "periscope",
        }),
    },

    commanderIndependentSight:
      createCommanderSight(
        safeHullDirection,
      ),

    hunterKiller:
      createHunterKillerState(),
  };
}
