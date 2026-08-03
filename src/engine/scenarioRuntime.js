import { createScenario, getDefaultScenario } from "./scenario.js";

export const DETECTION_STAGES = Object.freeze({
  HIDDEN: 0,
  CONTACT: 1,
  DETECTED: 2,
  IDENTIFIED: 3,
});

function createRuntimeUnit(unitData) {
  const friendly = unitData.side === "friendly";
  const isTank = unitData.type === "tank";

  return {
    ...unitData,
    condition: "정상",
    command: "대기",
    destroyed: false,
    destination: null,
    plannedPath: [],
    movementHistory: [],
    hullDirection: unitData.hullDirection ?? 0,
    turretDirection:
      unitData.turretDirection ??
      unitData.hullDirection ??
      0,
    direction: unitData.hullDirection ?? 0,
    detectionStage: friendly
      ? DETECTION_STAGES.IDENTIFIED
      : DETECTION_STAGES.HIDDEN,
    visible: friendly,
    detected: friendly,
    identified: friendly,
    lastKnownPosition: null,
    detectionConfidence: friendly ? 100 : 0,
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

export function loadScenario(scenarioId = null) {
  const source = scenarioId
    ? createScenario(scenarioId)
    : getDefaultScenario();

  return {
    id: source.id,
    name: source.name,
    description: source.description,
    objectives: [...source.objectives],
    units: [
      ...source.playerUnits,
      ...source.enemyUnits,
    ].map(createRuntimeUnit),
    events: (source.events ?? []).map(
      createRuntimeEvent,
    ),
    victoryConditions: structuredClone(
      source.victoryConditions ?? [],
    ),
    failureConditions: structuredClone(
      source.failureConditions ?? [],
    ),
    status: "running",
    startedTurn: 1,
    completedTurn: null,
  };
}

export function getPlayerUnit(runtimeScenario) {
  return runtimeScenario.units.find(
    (unit) =>
      unit.side === "friendly" &&
      unit.role === "player",
  );
}

export function getFriendlyUnits(runtimeScenario) {
  return runtimeScenario.units.filter(
    (unit) => unit.side === "friendly",
  );
}

export function getEnemyUnits(runtimeScenario) {
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

export function getHexDistance(a, b) {
  const axialA = offsetToAxial(
    a.column,
    a.row,
  );

  const axialB = offsetToAxial(
    b.column,
    b.row,
  );

  const dq = axialA.q - axialB.q;
  const dr = axialA.r - axialB.r;

  return (
    Math.abs(dq) +
    Math.abs(dr) +
    Math.abs(dq + dr)
  ) / 2;
}

function offsetToAxial(column, row) {
  return {
    q:
      column -
      (row - (row & 1)) / 2,
    r: row,
  };
}

function stageForDistance(
  observer,
  enemy,
  distance,
) {
  const baseRange =
    observer.detectionRange ??
    observer.sensors?.surroundingRecon / 10 ??
    7;

  const concealmentPenalty = Math.max(
    0,
    (enemy.concealment ?? 0) / 25,
  );

  const effectiveRange = Math.max(
    2,
    baseRange - concealmentPenalty,
  );

  if (
    distance <=
    Math.max(1, effectiveRange * 0.45)
  ) {
    return DETECTION_STAGES.IDENTIFIED;
  }

  if (
    distance <=
    Math.max(2, effectiveRange * 0.75)
  ) {
    return DETECTION_STAGES.DETECTED;
  }

  if (distance <= effectiveRange) {
    return DETECTION_STAGES.CONTACT;
  }

  return DETECTION_STAGES.HIDDEN;
}

export function updateDetection(
  runtimeScenario,
) {
  const friendlies = getFriendlyUnits(
    runtimeScenario,
  ).filter((unit) => !unit.destroyed);

  const enemies = getEnemyUnits(
    runtimeScenario,
  ).filter((unit) => !unit.destroyed);

  enemies.forEach((enemy) => {
    let bestStage =
      DETECTION_STAGES.HIDDEN;

    let bestDistance = Infinity;

    friendlies.forEach((observer) => {
      const distance = getHexDistance(
        observer,
        enemy,
      );

      const stage = stageForDistance(
        observer,
        enemy,
        distance,
      );

      if (
        stage > bestStage ||
        (stage === bestStage &&
          distance < bestDistance)
      ) {
        bestStage = stage;
        bestDistance = distance;
      }
    });

    enemy.detectionStage = bestStage;
    enemy.visible =
      bestStage >=
      DETECTION_STAGES.CONTACT;
    enemy.detected =
      bestStage >=
      DETECTION_STAGES.DETECTED;
    enemy.identified =
      bestStage >=
      DETECTION_STAGES.IDENTIFIED;
    enemy.detectionConfidence = [
      0,
      35,
      70,
      100,
    ][bestStage];

    enemy.lastKnownPosition =
      bestStage ===
      DETECTION_STAGES.HIDDEN
        ? enemy.lastKnownPosition
        : {
            column: enemy.column,
            row: enemy.row,
          };
  });

  return enemies;
}

export function isUnitVisible(
  unit,
  developerMode = false,
) {
  return (
    unit.side === "friendly" ||
    developerMode ||
    unit.visible
  );
}
