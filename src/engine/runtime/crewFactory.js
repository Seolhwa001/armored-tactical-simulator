// ============================================================
// ATS PROJECT
// File      : src/engine/runtime/crewFactory.js
// Sprint    : 3.9.1
// Revision  : R2
// Build     : 2026-08-05
// Type      : FULL REPLACEMENT
// Purpose   : Crew observation, CPS, and Hunter Killer state
// ============================================================

import {
  CREW_ROLES,
  HUNTER_KILLER_STATES,
} from "./runtimeConstants.js";

const DEFAULT_IDENTIFICATION_FACTOR = 1;
const COMMANDER_SIGHT_ROTATION_RATE = Math.PI / 4;
const LOADER_SIDE_OFFSET = Math.PI / 2;

function finiteOrDefault(value, fallback) {
  return Number.isFinite(value)
    ? value
    : fallback;
}

function nonNegativeOrDefault(value, fallback) {
  return Math.max(
    0,
    finiteOrDefault(value, fallback),
  );
}

function positiveOrDefault(value, fallback) {
  return Math.max(
    0.01,
    finiteOrDefault(value, fallback),
  );
}

function normalizeAngle(angle) {
  let normalized =
    finiteOrDefault(angle, 0) %
    (Math.PI * 2);

  if (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }

  if (normalized < -Math.PI) {
    normalized += Math.PI * 2;
  }

  return normalized;
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

    direction: safeDirection,
    targetDirection: safeDirection,
    assignedDirection: null,

    fieldOfView: safeFieldOfView,
    baseFieldOfView: safeFieldOfView,

    range: safeRange,
    baseRange: safeRange,

    identificationFactor:
      safeIdentificationFactor,

    baseIdentificationFactor:
      safeIdentificationFactor,

    observationMode,
    lastUpdatedTurn: null,
  };
}

function createCommanderSight(
  hullDirection,
) {
  const safeDirection =
    normalizeAngle(hullDirection);

  const fieldOfView =
    Math.PI / 3;

  const range = 1.18;
  const identificationFactor = 1.2;

  return {
    operational: true,
    active: false,

    direction: safeDirection,
    targetDirection: safeDirection,

    rotationRate:
      COMMANDER_SIGHT_ROTATION_RATE,

    fieldOfView,
    baseFieldOfView:
      fieldOfView,

    range,
    baseRange: range,

    identificationFactor,

    baseIdentificationFactor:
      identificationFactor,

    targetUnitId: null,

    locked: false,
    tracking: false,

    lastUpdatedTurn: null,
  };
}

function createHunterKillerState() {
  return {
    enabled: true,

    state:
      HUNTER_KILLER_STATES.SEARCHING,

    detectedTargetUnitId: null,
    designatedTargetUnitId: null,
    handedOffTargetUnitId: null,

    lastDetectedTurn: null,
  };
}

export function createCrewObservation({
  hullDirection = 0,
} = {}) {
  const safeHullDirection =
    normalizeAngle(hullDirection);

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
            Math.PI / 2,

          range: 1,

          identificationFactor: 1,

          observing: true,

          observationMode:
            "visual",
        }),

      [CREW_ROLES.GUNNER]:
        createCrewObserver({
          direction:
            safeHullDirection,

          fieldOfView:
            Math.PI / 3,

          range: 0.85,

          identificationFactor: 0.9,

          observing: true,

          observationMode:
            "turret-coupled",
        }),

      [CREW_ROLES.DRIVER]:
        createCrewObserver({
          direction:
            safeHullDirection,

          fieldOfView:
            Math.PI / 2.5,

          range: 0.55,

          identificationFactor: 0.45,

          observing: true,

          observationMode:
            "hull-forward",
        }),

      [CREW_ROLES.LOADER]:
        createCrewObserver({
          direction:
            loaderInitialDirection,

          fieldOfView:
            Math.PI / 2.2,

          range: 0.6,

          identificationFactor: 0.5,

          observing: true,

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
