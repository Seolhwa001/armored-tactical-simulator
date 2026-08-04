// src/engine/scenarioRuntime.js — 전체 교체, 1~286행

import {
  createScenario,
  getDefaultScenario,
} from "./scenario.js";

import {
  DETECTION_STAGES,
} from "./detection.js";

import {
  UNIT_ACTIONS,
} from "./actions.js";

import {
  createFireControl,
} from "./fireControl.js";

import {
  createTurretControl,
} from "./turretControl.js";

export const CREW_ROLES = Object.freeze({
  COMMANDER: "commander",
  GUNNER: "gunner",
  DRIVER: "driver",
  LOADER: "loader",
});

export const HUNTER_KILLER_STATES = Object.freeze({
  SEARCHING: "searching",
  TARGET_FOUND: "target-found",
  DESIGNATING: "designating",
  HANDOFF: "handoff",
  TRACKING: "tracking",
});

function createRuntimeAction() {
  return {
    type: UNIT_ACTIONS.IDLE,
    targetHex: null,
    targetUnitId: null,
    direction: null,
    startedTurn: 1,
    persistent: true,
  };
}

function createCrewObservation(
  hullDirection,
) {
  return {
    activeCrewRole:
      CREW_ROLES.COMMANDER,

    observers: {
      [CREW_ROLES.COMMANDER]: {
        enabled: true,
        direction: hullDirection,
        fieldOfView: Math.PI / 2,
        rangeFactor: 1,
        identificationFactor: 1,
      },

      [CREW_ROLES.GUNNER]: {
        enabled: true,
        direction: hullDirection,
        fieldOfView: Math.PI / 3,
        rangeFactor: 0.85,
        identificationFactor: 0.9,
      },

      [CREW_ROLES.DRIVER]: {
        enabled: true,
        direction: hullDirection,
        fieldOfView: Math.PI / 2.5,
        rangeFactor: 0.55,
        identificationFactor: 0.45,
      },

      [CREW_ROLES.LOADER]: {
        enabled: true,
        direction: hullDirection,
        fieldOfView: Math.PI / 2.2,
        rangeFactor: 0.6,
        identificationFactor: 0.5,
      },
    },

    commanderIndependentSight: {
      operational: true,
      direction: hullDirection,
      targetUnitId: null,
      locked: false,
      tracking: false,
    },

    hunterKiller: {
      enabled: true,

      state:
        HUNTER_KILLER_STATES.SEARCHING,

      detectedTargetUnitId: null,
      designatedTargetUnitId: null,
      handedOffTargetUnitId: null,
    },
  };
}

function createRuntimeSensors(
  unitData,
  isTank,
) {
  if (isTank) {
    return {
      surroundingRecon:
        unitData.surroundingRecon ??
        75,

      directionalObservation:
        unitData.directionalObservation ??
        55,
    };
  }

  const observation =
    unitData.observation ??
    50;

  return {
    surroundingRecon: observation,
    directionalObservation: observation,
  };
}

function createRuntimeProtection(
  isTank,
) {
  return isTank
    ? {
        explosionResistance: 25,
        opticsCondition: "정상",
      }
    : {
        explosionResistance: 5,
        opticsCondition: null,
      };
}

function createRuntimeHealth(
  unitData,
  isTank,
) {
  const maximum =
    unitData.maximumHealth ??
    (isTank ? 100 : 1);

  return {
    current:
      unitData.health ??
      maximum,

    maximum,

    lastDamage: 0,
    lastHitTurn: null,
  };
}

function createRuntimeUnit(
  unitData,
) {
  const friendly =
    unitData.side ===
    "friendly";

  const isTank =
    unitData.type ===
    "tank";

  const hullDirection =
    unitData.hullDirection ??
    0;

  const turretDirection =
    unitData.turretDirection ??
    hullDirection;

  const baseConcealment =
    unitData.concealment ??
    0;

  return {
    ...unitData,

    condition: "정상",
    command: "대기",
    destroyed: false,

    destination: null,
    plannedPath: [],
    movementHistory: [],

    hullDirection,
    turretDirection,
    direction: hullDirection,

    detectionStage:
      friendly
        ? DETECTION_STAGES.IDENTIFIED
        : DETECTION_STAGES.HIDDEN,

    visible: friendly,
    detected: friendly,
    identified: friendly,

    lastKnownPosition: null,

    detectionConfidence:
      friendly
        ? 100
        : 0,

    baseConcealment,
    concealment:
      baseConcealment,

    temporaryExposure: 0,
    exposedUntilTurn: null,

    hatchState:
      isTank
        ? "open"
        : null,

    sensors:
      createRuntimeSensors(
        unitData,
        isTank,
      ),

    crewObservation:
      isTank
        ? createCrewObservation(
            hullDirection,
          )
        : null,

    action:
      createRuntimeAction(),

    fireControl:
      isTank
        ? createFireControl()
        : null,

    turretControl:
      isTank
        ? createTurretControl(
            unitData,
          )
        : null,

    protection:
      createRuntimeProtection(
        isTank,
      ),

    health:
      createRuntimeHealth(
        unitData,
        isTank,
      ),
  };
}

function createRuntimeEvent(
  eventData,
) {
  return {
    ...eventData,
    active: false,
    completed: false,
    triggeredTurn: null,
  };
}

function getScenarioSource(
  scenarioId,
) {
  return scenarioId
    ? createScenario(scenarioId)
    : getDefaultScenario();
}

export function loadScenario(
  scenarioId = null,
) {
  const source =
    getScenarioSource(
      scenarioId,
    );

  return {
    id: source.id,
    name: source.name,
    description:
      source.description,

    objectives: [
      ...source.objectives,
    ],

    units: [
      ...source.playerUnits,
      ...source.enemyUnits,
    ].map(
      createRuntimeUnit,
    ),

    events: (
      source.events ??
      []
    ).map(
      createRuntimeEvent,
    ),

    victoryConditions:
      structuredClone(
        source.victoryConditions ??
        [],
      ),

    failureConditions:
      structuredClone(
        source.failureConditions ??
        [],
      ),

    status: "running",
    turn: 1,
    startedTurn: 1,
    completedTurn: null,
  };
}

export function restartScenario(
  runtimeScenario,
) {
  return loadScenario(
    runtimeScenario.id,
  );
}

export function getPlayerUnit(
  runtimeScenario,
) {
  return runtimeScenario.units.find(
    (unit) =>
      unit.side === "friendly" &&
      unit.role === "player",
  );
}

export function getFriendlyUnits(
  runtimeScenario,
) {
  return runtimeScenario.units.filter(
    (unit) =>
      unit.side === "friendly",
  );
}

export function getEnemyUnits(
  runtimeScenario,
) {
  return runtimeScenario.units.filter(
    (unit) =>
      unit.side === "enemy",
  );
}

export function getUnitById(
  runtimeScenario,
  unitId,
) {
  return runtimeScenario.units.find(
    (unit) =>
      unit.id === unitId,
  );
}
