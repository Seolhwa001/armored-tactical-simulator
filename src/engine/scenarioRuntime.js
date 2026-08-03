import {
  createScenario,
  getDefaultScenario,
} from "./scenario.js";

function createRuntimeUnit(unitData) {
  const isTank = unitData.type === "tank";

  return {
    ...unitData,

    condition: "정상",
    command: "대기",
    destroyed: false,

    destination: null,
    plannedPath: [],
    movementHistory: [],

    hullDirection:
      unitData.hullDirection ?? 0,

    turretDirection:
      unitData.turretDirection ??
      unitData.hullDirection ??
      0,

    direction:
      unitData.hullDirection ?? 0,

    visible: unitData.side === "friendly",
    detected: unitData.side === "friendly",
    identified: unitData.side === "friendly",

    lastKnownPosition: null,
    detectionConfidence:
      unitData.side === "friendly" ? 100 : 0,

    hatchState: isTank ? "open" : null,

    sensors: isTank
      ? {
          surroundingRecon: 75,
          directionalObservation: 55,
        }
      : {
          surroundingRecon:
            unitData.observation ?? 50,
          directionalObservation:
            unitData.observation ?? 50,
        },

    protection: isTank
      ? {
          explosionResistance: 25,
          opticsCondition: "정상",
        }
      : {
          explosionResistance: 5,
          opticsCondition: null,
        },
  };
}

function createRuntimeEvent(eventData) {
  return {
    ...eventData,
    active: false,
    completed: false,
    triggeredTurn: null,
  };
}

export function loadScenario(
  scenarioId = null,
) {
  const sourceScenario = scenarioId
    ? createScenario(scenarioId)
    : getDefaultScenario();

  const friendlyUnits =
    sourceScenario.playerUnits.map(
      createRuntimeUnit,
    );

  const enemyUnits =
    sourceScenario.enemyUnits.map(
      createRuntimeUnit,
    );

  return {
    id: sourceScenario.id,
    name: sourceScenario.name,
    description:
      sourceScenario.description,

    objectives: [
      ...sourceScenario.objectives,
    ],

    units: [
      ...friendlyUnits,
      ...enemyUnits,
    ],

    events: sourceScenario.events
      ? sourceScenario.events.map(
          createRuntimeEvent,
        )
      : [],

    victoryConditions:
      structuredClone(
        sourceScenario.victoryConditions ??
          [],
      ),

    failureConditions:
      structuredClone(
        sourceScenario.failureConditions ??
          [],
      ),

    status: "running",
    startedTurn: 1,
    completedTurn: null,
  };
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
    (unit) => unit.side === "friendly",
  );
}

export function getEnemyUnits(
  runtimeScenario,
) {
  return runtimeScenario.units.filter(
    (unit) => unit.side === "enemy",
  );
}

export function getUnitById(
  runtimeScenario,
  unitId,
) {
  return runtimeScenario.units.find(
    (unit) => unit.id === unitId,
  );
}
