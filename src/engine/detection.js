// src/engine/detection.js — 새 파일, 1~226행

export const DETECTION_STAGES = Object.freeze({
  HIDDEN: 0,
  CONTACT: 1,
  DETECTED: 2,
  IDENTIFIED: 3,
});

const ACTION_OBSERVE = "observe";
const ACTION_RECON = "recon";

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

function isInsideObservationArc(
  observer,
  target,
  arcRadians = Math.PI / 2,
) {
  const actionDirection =
    observer.action?.direction;

  if (
    observer.action?.type !==
      ACTION_OBSERVE ||
    !Number.isFinite(
      actionDirection,
    )
  ) {
    return false;
  }

  const targetDirection =
    getDirectionBetween(
      observer,
      target,
    );

  const difference =
    Math.abs(
      normalizeAngle(
        targetDirection -
          actionDirection,
      ),
    );

  return (
    difference <=
    arcRadians / 2
  );
}

function getObserverRange(
  observer,
  enemy,
) {
  const sensorRange =
    (
      observer.sensors
        ?.surroundingRecon ??
      70
    ) / 10;

  let range =
    observer.detectionRange ??
    sensorRange;

  if (
    observer.action?.type ===
    ACTION_RECON
  ) {
    range += Math.max(
      2,
      (
        observer.sensors
          ?.surroundingRecon ??
        50
      ) / 25,
    );
  }

  if (
    isInsideObservationArc(
      observer,
      enemy,
    )
  ) {
    range += Math.max(
      3,
      (
        observer.sensors
          ?.directionalObservation ??
        54
      ) / 18,
    );
  }

  return range;
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
  const baseRange =
    getObserverRange(
      observer,
      enemy,
    );

  const concealmentPenalty =
    getEffectiveConcealment(
      enemy,
      turn,
    ) / 25;

  const effectiveRange =
    Math.max(
      2,
      baseRange -
        concealmentPenalty,
    );

  if (
    distance <=
    Math.max(
      1,
      effectiveRange * 0.45,
    )
  ) {
    return DETECTION_STAGES.IDENTIFIED;
  }

  if (
    distance <=
    Math.max(
      2,
      effectiveRange * 0.75,
    )
  ) {
    return DETECTION_STAGES.DETECTED;
  }

  if (
    distance <= effectiveRange
  ) {
    return DETECTION_STAGES.CONTACT;
  }

  return DETECTION_STAGES.HIDDEN;
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

    friendlies.forEach(
      (observer) => {
        const distance =
          getHexDistance(
            observer,
            enemy,
          );

        const stage =
          calculateDetectionStage(
            observer,
            enemy,
            distance,
            turn,
          );

        if (
          stage > bestStage ||
          (
            stage === bestStage &&
            distance < bestDistance
          )
        ) {
          bestStage = stage;
          bestDistance = distance;
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
