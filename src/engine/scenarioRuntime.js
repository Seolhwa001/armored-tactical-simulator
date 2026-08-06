// src/engine/scenarioRuntime.js — 전체 교체, 예상 1~112행

import {
  createScenario,
  getDefaultScenario,
} from "./scenario.js";

import {
  CREW_ROLES,
  HUNTER_KILLER_STATES,
} from "./runtime/runtimeConstants.js";

import {
  createRuntimeUnit,
} from "./runtime/unitFactory.js";

export {
  CREW_ROLES,
  HUNTER_KILLER_STATES,
};

function createRuntimeEvent(eventData) {
  return {
    ...eventData,
    active: false,
    completed: false,
    triggeredTurn: null,
  };
}

function getScenarioSource(scenarioId) {
  return scenarioId
    ? createScenario(scenarioId)
    : getDefaultScenario();
}

export function loadScenario(
  scenarioId = null,
) {
  const source =
    getScenarioSource(scenarioId);

  return {
    id: source.id,
    name: source.name,
    description: source.description,

    objectives: [
      ...source.objectives,
    ],

    units: [
      ...source.playerUnits,
      ...source.enemyUnits,
    ].map(createRuntimeUnit),

    events: (
      source.events ?? []
    ).map(createRuntimeEvent),

    victoryConditions:
      structuredClone(
        source.victoryConditions ?? [],
      ),

    failureConditions:
      structuredClone(
        source.failureConditions ?? [],
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
