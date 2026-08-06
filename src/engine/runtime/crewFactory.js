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

import {
  OBSERVATION_MEANS,
  CREW_VISION_PROFILES,
  degreesToRadians,
} from "../contracts/index.js";

const DEFAULT_IDENTIFICATION_FACTOR =
  1;

const COMMANDER_SIGHT_ROTATION_RATE =
  Math.PI / 4;

const LOADER_SIDE_OFFSET =
  Math.PI / 2;

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
  observationMean = null,
  rangeMode = "legacy-multiplier",
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
    observationMean,
    rangeMode,

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

  const profile =
    CREW_VISION_PROFILES[
      OBSERVATION_MEANS.COMMANDER_CPS
    ];

  const fieldOfView =
    degreesToRadians(
      profile.fieldOfViewDegrees,
    );

  const range =
    profile.rangeHexes;

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

    observationMean:
      OBSERVATION_MEANS.COMMANDER_CPS,

    rangeMode:
      profile.rangeMode,

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
            degreesToRadians(
              CREW_VISION_PROFILES[
                OBSERVATION_MEANS.COMMANDER_VISUAL
              ].fieldOfViewDegrees,
            ),

          range:
            CREW_VISION_PROFILES[
              OBSERVATION_MEANS.COMMANDER_VISUAL
            ].rangeHexes,

          identificationFactor:
            1,

          observing:
            true,

          observationMode:
            "visual",

          observationMean:
            OBSERVATION_MEANS.COMMANDER_VISUAL,

          rangeMode:
            CREW_VISION_PROFILES[
              OBSERVATION_MEANS.COMMANDER_VISUAL
            ].rangeMode,
        }),

      [CREW_ROLES.GUNNER]:
        createCrewObserver({
          direction:
            safeHullDirection,

          fieldOfView:
            degreesToRadians(
              CREW_VISION_PROFILES[
                OBSERVATION_MEANS.GUNNER_MAIN_SIGHT
              ].fieldOfViewDegrees,
            ),

          range:
            CREW_VISION_PROFILES[
              OBSERVATION_MEANS.GUNNER_MAIN_SIGHT
            ].rangeHexes,

          identificationFactor:
            0.9,

          observing:
            true,

          observationMode:
            "turret-coupled",

          observationMean:
            OBSERVATION_MEANS.GUNNER_MAIN_SIGHT,

          rangeMode:
            CREW_VISION_PROFILES[
              OBSERVATION_MEANS.GUNNER_MAIN_SIGHT
            ].rangeMode,
        }),

      [CREW_ROLES.DRIVER]:
        createCrewObserver({
          direction:
            safeHullDirection,

          fieldOfView:
            degreesToRadians(
              CREW_VISION_PROFILES[
                OBSERVATION_MEANS.DRIVER_FORWARD
              ].fieldOfViewDegrees,
            ),

          range:
            CREW_VISION_PROFILES[
              OBSERVATION_MEANS.DRIVER_FORWARD
            ].rangeHexes,

          identificationFactor:
            0.45,

          observing:
            true,

          observationMode:
            "hull-forward",

          observationMean:
            OBSERVATION_MEANS.DRIVER_FORWARD,

          rangeMode:
            CREW_VISION_PROFILES[
              OBSERVATION_MEANS.DRIVER_FORWARD
            ].rangeMode,
        }),

      [CREW_ROLES.LOADER]:
        createCrewObserver({
          direction:
            loaderInitialDirection,

          fieldOfView:
            degreesToRadians(
              CREW_VISION_PROFILES[
                OBSERVATION_MEANS.LOADER_VISUAL
              ].fieldOfViewDegrees,
            ),

          range:
            CREW_VISION_PROFILES[
              OBSERVATION_MEANS.LOADER_VISUAL
            ].rangeHexes,

          identificationFactor:
            0.5,

          observing:
            true,

          observationMode:
            "visual",

          observationMean:
            OBSERVATION_MEANS.LOADER_VISUAL,

          rangeMode:
            CREW_VISION_PROFILES[
              OBSERVATION_MEANS.LOADER_VISUAL
            ].rangeMode,
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
