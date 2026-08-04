// src/engine/detection.js — 전체 교체, 1~298행

export const DETECTION_STAGES = Object.freeze({
  HIDDEN: 0,
  CONTACT: 1,
  DETECTED: 2,
  IDENTIFIED: 3,
});

const ACTION_RECON = "recon";

const ASPECT_FACTORS = Object.freeze({
  FRONT: {
    range: 1,
    identification: 1,
  },

  SIDE: {
    range: 0.72,
    identification: 0.7,
  },

  REAR: {
    range: 0.48,
    identification: 0.45,
  },
});

function normalizeAngle(angle) {
  let normalized =
    angle % (Math.PI * 2);

  if (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }

  if (normalized < -Math.PI) {
    normalized += Math.PI * 2;
  }

  return normalized;
}

function getAbsoluteAngleDifference(
  first,
  second,
) {
  return Math.abs(
    normalizeAngle(
      first - second,
    ),
  );
}

function getDirectionBetween(
  observer,
  target,
) {
  return Math.atan2(
    target.row - observer.row,
    target.column - observer.column,
  );
}

function offsetToAxial(
  column,
  row,
) {
  return {
    q:
      column -
      (
        row -
        (row & 1)
      ) /
        2,

    r: row,
  };
}

export function getHexDistance(
  first,
  second,
) {
  const firstAxial =
    offsetToAxial(
      first.column,
      first.row,
    );

  const secondAxial =
    offsetToAxial(
      second.column,
      second.row,
    );

  const deltaQ =
    firstAxial.q -
    secondAxial.q;

  const deltaR =
    firstAxial.r -
    secondAxial.r;

  return (
    Math.abs(deltaQ) +
    Math.abs(deltaR) +
    Math.abs(
      deltaQ + deltaR,
    )
  ) / 2;
}

function getAspectFactors(
  observer,
  targetDirection,
) {
  const hullDirection =
    observer.hullDirection ??
    observer.direction ??
    0;

  const difference =
    getAbsoluteAngleDifference(
      targetDirection,
      hullDirection,
    );

  if (
    difference <=
    Math.PI / 4
  ) {
    return ASPECT_FACTORS.FRONT;
  }

  if (
    difference <=
    Math.PI * 0.75
  ) {
    return ASPECT_FACTORS.SIDE;
  }

  return ASPECT_FACTORS.REAR;
}

function getEnabledCrewObservers(
  observer,
) {
  const crewObservers =
    observer.crewObservation
      ?.observers;

  if (!crewObservers) {
    return [];
  }

  return Object.entries(
    crewObservers,
  )
    .filter(
      ([, crew]) =>
        crew.enabled !== false,
    )
    .map(
      ([role, crew]) => ({
        role,
        ...crew,
      }),
    );
}

function evaluateCrewObserver(
  unit,
  crew,
  targetDirection,
) {
  const direction =
    crew.direction ??
    unit.hullDirection ??
    0;

  const fieldOfView =
    crew.fieldOfView ??
    Math.PI / 2;

  const difference =
    getAbsoluteAngleDifference(
      targetDirection,
      direction,
    );

  if (
    difference >
    fieldOfView / 2
  ) {
    return null;
  }

  const aspect =
    getAspectFactors(
      unit,
      targetDirection,
    );

  return {
    role: crew.role,

    rangeFactor:
      (
        crew.rangeFactor ??
        1
      ) *
      aspect.range,

    identificationFactor:
      (
        crew.identificationFactor ??
        1
      ) *
      aspect.identification,
  };
}

function evaluateCommanderSight(
  unit,
  targetDirection,
) {
  const sight =
    unit.crewObservation
      ?.commanderIndependentSight;

  if (
    !sight?.operational
  ) {
    return null;
  }

  const difference =
    getAbsoluteAngleDifference(
      targetDirection,
      sight.direction ??
        unit.hullDirection ??
        0,
    );

  if (
    difference >
    Math.PI / 3
  ) {
    return null;
  }

  return {
    role: "commander-cps",
    rangeFactor: 1.18,
    identificationFactor: 1.2,
  };
}

function getBestObservation(
  observer,
  enemy,
) {
  const targetDirection =
    getDirectionBetween(
      observer,
      enemy,
    );

  const candidates =
    getEnabledCrewObservers(
      observer,
    )
      .map((crew) =>
        evaluateCrewObserver(
          observer,
          crew,
          targetDirection,
        ),
      )
      .filter(Boolean);

  const commanderSight =
    evaluateCommanderSight(
      observer,
      targetDirection,
    );

  if (commanderSight) {
    candidates.push(
      commanderSight,
    );
  }

  if (
    candidates.length === 0
  ) {
    const aspect =
      getAspectFactors(
        observer,
        targetDirection,
      );

    return {
      role: null,
      rangeFactor:
        aspect.range * 0.45,

      identificationFactor:
        aspect.identification *
        0.4,
    };
  }

  return candidates.reduce(
    (best, candidate) => {
      const bestScore =
        best.rangeFactor +
        best.identificationFactor;

      const candidateScore =
        candidate.rangeFactor +
        candidate.identificationFactor;

      return candidateScore >
        bestScore
        ? candidate
        : best;
    },
  );
}

function getEffectiveConcealment(
  enemy,
  turn,
) {
  const exposureActive =
    enemy.exposedUntilTurn !==
      null &&
    enemy.exposedUntilTurn >=
      turn;

  const exposure =
    exposureActive
      ? enemy.temporaryExposure ??
        0
      : 0;

  return Math.max(
    0,
    (
      enemy.concealment ??
      0
    ) - exposure,
  );
}

function calculateDetectionStage(
  observer,
  enemy,
  distance,
  turn,
) {
  const observation =
    getBestObservation(
      observer,
      enemy,
    );

  const sensorRange =
    (
      observer.sensors
        ?.surroundingRecon ??
      70
    ) / 10;

  let baseRange =
    observer.detectionRange ??
    sensorRange;

  if (
    observer.action?.type ===
    ACTION_RECON
  ) {
    baseRange += Math.max(
      2,
      sensorRange * 0.3,
    );
  }

  const concealmentPenalty =
    getEffectiveConcealment(
      enemy,
      turn,
    ) / 25;

  const effectiveRange =
    Math.max(
      1,
      baseRange *
        observation.rangeFactor -
        concealmentPenalty,
    );

  const identificationRange =
    effectiveRange *
    0.48 *
    observation
      .identificationFactor;

  let stage =
    DETECTION_STAGES.HIDDEN;

  if (
    distance <=
    identificationRange
  ) {
    stage =
      DETECTION_STAGES.IDENTIFIED;
  } else if (
    distance <=
    effectiveRange * 0.75
  ) {
    stage =
      DETECTION_STAGES.DETECTED;
  } else if (
    distance <= effectiveRange
  ) {
    stage =
      DETECTION_STAGES.CONTACT;
  }

  return {
    stage,
    observerRole:
      observation.role,
  };
}

function clearExpiredExposure(
  enemy,
  turn,
) {
  if (
    enemy.exposedUntilTurn ===
      null ||
    enemy.exposedUntilTurn >=
      turn
  ) {
    return;
  }

  enemy.temporaryExposure = 0;
  enemy.exposedUntilTurn = null;
}

export function updateDetection(
  runtimeScenario,
  turn =
    runtimeScenario.turn ??
    1,
) {
  const friendlies =
    runtimeScenario.units.filter(
      (unit) =>
        unit.side ===
          "friendly" &&
        !unit.destroyed,
    );

  const enemies =
    runtimeScenario.units.filter(
      (unit) =>
        unit.side ===
          "enemy" &&
        !unit.destroyed,
    );

  enemies.forEach((enemy) => {
    let bestStage =
      DETECTION_STAGES.HIDDEN;

    let bestDistance =
      Infinity;

    let bestObserverId =
      null;

    let bestObserverRole =
      null;

    friendlies.forEach(
      (observer) => {
        const distance =
          getHexDistance(
            observer,
            enemy,
          );

        const result =
          calculateDetectionStage(
            observer,
            enemy,
            distance,
            turn,
          );

        if (
          result.stage >
            bestStage ||
          (
            result.stage ===
              bestStage &&
            distance <
              bestDistance
          )
        ) {
          bestStage =
            result.stage;

          bestDistance =
            distance;

          bestObserverId =
            observer.id;

          bestObserverRole =
            result.observerRole;
        }
      },
    );

    enemy.detectionStage =
      bestStage;

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

    enemy.detectedByUnitId =
      bestObserverId;

    enemy.detectedByCrewRole =
      bestObserverRole;

    if (
      bestStage !==
      DETECTION_STAGES.HIDDEN
    ) {
      enemy.lastKnownPosition = {
        column: enemy.column,
        row: enemy.row,
      };
    }

    clearExpiredExposure(
      enemy,
      turn,
    );
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
