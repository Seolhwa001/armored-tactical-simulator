// ============================================================
// ATS PROJECT
// File      : src/engine/detection.js
// Sprint    : 3.9.1
// Revision  : R4
// Build     : 2026-08-05
// Type      : FULL REPLACEMENT
// Purpose   : Directional detection using shared hex geometry
// ============================================================

import {
  getHexDirection,
} from "./hexGeometry.js";

export const DETECTION_STAGES = Object.freeze({
  HIDDEN: 0,
  CONTACT: 1,
  DETECTED: 2,
  IDENTIFIED: 3,
});

const ACTION_RECON = "recon";

const DEFAULT_VISUAL_RANGE = 7;
const DEFAULT_IDENTIFICATION_RATIO = 0.48;
const DEFAULT_OBSERVER_RANGE = 1;
const DEFAULT_IDENTIFICATION_FACTOR = 1;

const RECON_RANGE_FACTOR = 1;
const RECON_IDENTIFICATION_FACTOR = 0.75;

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

function getAbsoluteAngleDifference(
  first,
  second,
) {
  return Math.abs(
    normalizeAngle(
      finiteOrDefault(first, 0) -
      finiteOrDefault(second, 0),
    ),
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
      ) / 2,

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
    Math.abs(deltaQ + deltaR)
  ) / 2;
}

function isReconActive(unit) {
  return (
    unit.action?.type ===
      ACTION_RECON ||
    unit.persistentAction?.type ===
      ACTION_RECON
  );
}

function getActiveCrewObservers(unit) {
  const observers =
    unit.crewObservation?.observers;

  if (!observers) {
    return [];
  }

  return Object.entries(observers)
    .filter(
      ([, observer]) =>
        observer?.enabled !== false &&
        observer?.observing === true,
    )
    .map(
      ([role, observer]) => ({
        role,
        ...observer,
      }),
    );
}

function evaluateCrewObserver(
  unit,
  observer,
  targetDirection,
) {
  const direction =
    finiteOrDefault(
      observer.direction ??
        unit.hullDirection,
      0,
    );

  const fieldOfView =
    positiveOrDefault(
      observer.fieldOfView,
      Math.PI / 2,
    );

  const directionDifference =
    getAbsoluteAngleDifference(
      targetDirection,
      direction,
    );

  if (
    directionDifference >
    fieldOfView / 2
  ) {
    return null;
  }

  return {
    role: observer.role,

    range:
      nonNegativeOrDefault(
        observer.range,
        DEFAULT_OBSERVER_RANGE,
      ),

    identificationFactor:
      nonNegativeOrDefault(
        observer.identificationFactor,
        DEFAULT_IDENTIFICATION_FACTOR,
      ),
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
    !sight?.operational ||
    sight.active !== true
  ) {
    return null;
  }

  const direction =
    finiteOrDefault(
      sight.direction ??
        unit.hullDirection,
      0,
    );

  const fieldOfView =
    positiveOrDefault(
      sight.fieldOfView,
      Math.PI / 3,
    );

  const directionDifference =
    getAbsoluteAngleDifference(
      targetDirection,
      direction,
    );

  if (
    directionDifference >
    fieldOfView / 2
  ) {
    return null;
  }

  return {
    role: "commander-cps",

    range:
      nonNegativeOrDefault(
        sight.range,
        1.18,
      ),

    identificationFactor:
      nonNegativeOrDefault(
        sight.identificationFactor,
        1.2,
      ),
  };
}

function createReconObservationCandidate(
  unit,
) {
  if (!isReconActive(unit)) {
    return null;
  }

  return {
    role: "crew-recon",
    range: RECON_RANGE_FACTOR,

    identificationFactor:
      RECON_IDENTIFICATION_FACTOR,
  };
}

function getObservationCandidates(
  observer,
  enemy,
) {
  const targetDirection =
    getHexDirection(
      observer,
      enemy,
    );

  const candidates =
    getActiveCrewObservers(observer)
      .map((crewObserver) =>
        evaluateCrewObserver(
          observer,
          crewObserver,
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

  const reconCandidate =
    createReconObservationCandidate(
      observer,
    );

  if (reconCandidate) {
    candidates.push(
      reconCandidate,
    );
  }

  return candidates;
}

function getSensorVisualRange(observer) {
  const sensorVisualRange =
    observer.sensors?.visualRange;

  if (
    Number.isFinite(sensorVisualRange) &&
    sensorVisualRange > 0
  ) {
    return sensorVisualRange;
  }

  if (
    Number.isFinite(
      observer.detectionRange,
    ) &&
    observer.detectionRange > 0
  ) {
    return observer.detectionRange;
  }

  const legacyDirectionalRange =
    observer.sensors
      ?.directionalObservation;

  if (
    Number.isFinite(
      legacyDirectionalRange,
    ) &&
    legacyDirectionalRange > 0
  ) {
    return (
      legacyDirectionalRange /
      10
    );
  }

  return DEFAULT_VISUAL_RANGE;
}

function getSensorIdentificationRange(
  observer,
  visualRange,
) {
  const configuredRange =
    observer.sensors
      ?.identificationRange;

  if (
    Number.isFinite(configuredRange) &&
    configuredRange >= 0
  ) {
    return configuredRange;
  }

  return (
    visualRange *
    DEFAULT_IDENTIFICATION_RATIO
  );
}

function isExposureActive(
  enemy,
  turn,
) {
  return (
    enemy.exposedUntilTurn !== null &&
    enemy.exposedUntilTurn !== undefined &&
    enemy.exposedUntilTurn >= turn &&
    nonNegativeOrDefault(
      enemy.temporaryExposure,
      0,
    ) > 0
  );
}

function getExposureMinimumStage(
  enemy,
  turn,
) {
  if (!isExposureActive(enemy, turn)) {
    return DETECTION_STAGES.HIDDEN;
  }

  const previousStage =
    nonNegativeOrDefault(
      enemy.detectionStage,
      DETECTION_STAGES.HIDDEN,
    );

  return previousStage >=
    DETECTION_STAGES.CONTACT
    ? DETECTION_STAGES.CONTACT
    : DETECTION_STAGES.HIDDEN;
}

function getEffectiveConcealment(
  enemy,
  turn,
) {
  const exposure =
    isExposureActive(enemy, turn)
      ? nonNegativeOrDefault(
          enemy.temporaryExposure,
          0,
        )
      : 0;

  return Math.max(
    0,
    nonNegativeOrDefault(
      enemy.concealment,
      0,
    ) - exposure,
  );
}

function evaluateDetectionCandidate(
  observer,
  enemy,
  distance,
  turn,
  observation,
) {
  const visualRange =
    getSensorVisualRange(observer);

  const identificationRange =
    getSensorIdentificationRange(
      observer,
      visualRange,
    );

  const observerRange =
    nonNegativeOrDefault(
      observation.range,
      DEFAULT_OBSERVER_RANGE,
    );

  const identificationFactor =
    nonNegativeOrDefault(
      observation.identificationFactor,
      DEFAULT_IDENTIFICATION_FACTOR,
    );

  const concealmentPenalty =
    getEffectiveConcealment(
      enemy,
      turn,
    ) / 25;

  const effectiveVisualRange =
    Math.max(
      0,
      visualRange *
        observerRange -
        concealmentPenalty,
    );

  const effectiveIdentificationRange =
    Math.max(
      0,
      identificationRange *
        observerRange *
        identificationFactor -
        concealmentPenalty,
    );

  let stage =
    DETECTION_STAGES.HIDDEN;

  if (
    distance <=
    effectiveIdentificationRange
  ) {
    stage =
      DETECTION_STAGES.IDENTIFIED;
  } else if (
    distance <=
    effectiveVisualRange * 0.75
  ) {
    stage =
      DETECTION_STAGES.DETECTED;
  } else if (
    distance <=
    effectiveVisualRange
  ) {
    stage =
      DETECTION_STAGES.CONTACT;
  }

  return {
    stage,
    role: observation.role,
    effectiveVisualRange,
    effectiveIdentificationRange,
  };
}

function calculateDetectionStage(
  observer,
  enemy,
  distance,
  turn,
) {
  const candidates =
    getObservationCandidates(
      observer,
      enemy,
    );

  if (candidates.length === 0) {
    return {
      stage:
        DETECTION_STAGES.HIDDEN,

      observerRole: null,
    };
  }

  const results =
    candidates.map(
      (candidate) =>
        evaluateDetectionCandidate(
          observer,
          enemy,
          distance,
          turn,
          candidate,
        ),
    );

  const best =
    results.reduce(
      (
        bestResult,
        candidateResult,
      ) => {
        if (
          candidateResult.stage >
          bestResult.stage
        ) {
          return candidateResult;
        }

        if (
          candidateResult.stage <
          bestResult.stage
        ) {
          return bestResult;
        }

        const candidateScore =
          candidateResult
            .effectiveVisualRange +
          candidateResult
            .effectiveIdentificationRange;

        const bestScore =
          bestResult
            .effectiveVisualRange +
          bestResult
            .effectiveIdentificationRange;

        return candidateScore >
          bestScore
          ? candidateResult
          : bestResult;
      },
    );

  return {
    stage: best.stage,
    observerRole: best.role,
  };
}

function clearExpiredExposure(
  enemy,
  turn,
) {
  if (
    enemy.exposedUntilTurn === null ||
    enemy.exposedUntilTurn === undefined ||
    enemy.exposedUntilTurn >= turn
  ) {
    return;
  }

  enemy.temporaryExposure = 0;
  enemy.exposedUntilTurn = null;
}

export function updateDetection(
  runtimeScenario,
  turn =
    runtimeScenario?.turn ??
    1,
) {
  const units =
    Array.isArray(
      runtimeScenario?.units,
    )
      ? runtimeScenario.units
      : [];

  const friendlies =
    units.filter(
      (unit) =>
        unit.side === "friendly" &&
        !unit.destroyed,
    );

  const enemies =
    units.filter(
      (unit) =>
        unit.side === "enemy" &&
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

    const exposureMinimumStage =
      getExposureMinimumStage(
        enemy,
        turn,
      );

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
            result.stage !==
              DETECTION_STAGES.HIDDEN &&
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

    bestStage =
      Math.max(
        bestStage,
        exposureMinimumStage,
      );

    if (
      bestStage ===
        DETECTION_STAGES.CONTACT &&
      exposureMinimumStage ===
        DETECTION_STAGES.CONTACT &&
      bestObserverId === null
    ) {
      bestObserverRole =
        "recon-by-fire";
    }

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

    enemy.detectionConfidence =
      [
        0,
        35,
        70,
        100,
      ][bestStage] ?? 0;

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
