// src/engine/runtime/crewFactory.js — 새 파일, 전체 코드

import {
  CREW_ROLES,
  HUNTER_KILLER_STATES,
} from "./runtimeConstants.js";

function createCrewObserver({
  direction,
  fieldOfView,
  rangeFactor,
  identificationFactor,
}) {
  return {
    enabled: true,
    direction,
    targetDirection: direction,
    fieldOfView,
    rangeFactor,
    identificationFactor,
    observing: false,
    lastUpdatedTurn: null,
  };
}

export function createCrewObservation({
  hullDirection = 0,
} = {}) {
  return {
    activeCrewRole: CREW_ROLES.COMMANDER,

    observers: {
      [CREW_ROLES.COMMANDER]:
        createCrewObserver({
          direction: hullDirection,
          fieldOfView: Math.PI / 2,
          rangeFactor: 1,
          identificationFactor: 1,
        }),

      [CREW_ROLES.GUNNER]:
        createCrewObserver({
          direction: hullDirection,
          fieldOfView: Math.PI / 3,
          rangeFactor: 0.85,
          identificationFactor: 0.9,
        }),

      [CREW_ROLES.DRIVER]:
        createCrewObserver({
          direction: hullDirection,
          fieldOfView: Math.PI / 2.5,
          rangeFactor: 0.55,
          identificationFactor: 0.45,
        }),

      [CREW_ROLES.LOADER]:
        createCrewObserver({
          direction: hullDirection,
          fieldOfView: Math.PI / 2.2,
          rangeFactor: 0.6,
          identificationFactor: 0.5,
        }),
    },

    commanderIndependentSight: {
      operational: true,
      direction: hullDirection,
      targetDirection: hullDirection,
      targetUnitId: null,
      locked: false,
      tracking: false,
      lastUpdatedTurn: null,
    },

    hunterKiller: {
      enabled: true,
      state: HUNTER_KILLER_STATES.SEARCHING,
      detectedTargetUnitId: null,
      designatedTargetUnitId: null,
      handedOffTargetUnitId: null,
      lastDetectedTurn: null,
    },
  };
}
