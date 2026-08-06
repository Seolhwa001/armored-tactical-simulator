// ============================================================
// ATS PROJECT
// File      : src/engine/detection.js
// Sprint    : 3.9.1
// Revision  : R13
// Build     : 2026-08-06
// Type      : PARTIAL PATCH
// Purpose   : Directional detection with shared ranges and smoke line blocking
// ============================================================

import {
  getHexDirection,
  getHexDistance,
} from "./hexGeometry.js";

import {
  normalizeAngle,
} from "./mathUtils.js";

import {
  getSmokeOcclusion,
  prepareActiveSmokeAreas,
} from "./combat.js";

export {
  getHexDistance,
} from "./hexGeometry.js";

export const DETECTION_STAGES =
  Object.freeze({
    HIDDEN: 0,
    CONTACT: 1,
    DETECTED: 2,
    IDENTIFIED: 3,
  });

const DEFAULT_VISUAL_RANGE =
  7;

const DEFAULT_IDENTIFICATION_RATIO =
  0.48;

const DEFAULT_OBSERVER_RANGE =
  1;

const DEFAULT_IDENTIFICATION_FACTOR =
  1;

const TEMPORARY_ROLE_VISUAL_RANGES =
  Object.freeze({
    gunner: 20,
    commander: 12,
    "commander-cps": 20,
  });

const RECON_RANGE_FACTOR =
  1;

const RECON_IDENTIFICATION_FACTOR =
  0.75;

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

function getAbsoluteAngleDifference(
  first,
  second,
) {
  return Math.abs(
    normalizeAngle(
      finiteOrDefault(
        first,
        0,
      ) -
      finiteOrDefault(
        second,
        0,
      ),
    ),
  );
}

function getActiveCrewObservers(
  unit,
) {
  const observers =
    unit.crewObservation
      ?.observers;

  if (!observers) {
    return [];
  }

  return Object.entries(
    observers,
  )
    .filter(
      ([, observer]) =>
        observer?.enabled !==
          false &&
        observer?.observing ===
          true,
    )
    .map(
      ([
        role,
        observer,
      ]) => ({
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
    role:
      observer.role,

    range:
      nonNegativeOrDefault(
        observer.range,
        DEFAULT_OBSERVER_RANGE,
      ),

    identificationFactor:
      nonNegativeOrDefault(
        observer
          .identificationFactor,
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
    role:
      "commander-cps",

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

function getObservationCandidates(
  observer,
  enemy,
) {
  const targetDirection =
    getHexDirection(
      observer,
      enemy,
    );

  const diagnostics = [];
  const candidates = [];
  const observers =
    observer.crewObservation
      ?.observers ?? {};

  Object.entries(observers).forEach(
    ([role, crewObserver]) => {
      const enabled =
        crewObserver?.enabled !==
          false;

      const observing =
        crewObserver?.observing ===
          true;

      const observerDirection =
        Number.isFinite(
          crewObserver?.direction,
        )
          ? crewObserver.direction
          : null;

      const fieldOfView =
        positiveOrDefault(
          crewObserver?.fieldOfView,
          Math.PI / 2,
        );

      const angleDifference =
        observerDirection === null
          ? null
          : getAbsoluteAngleDifference(
              targetDirection,
              observerDirection,
            );

      let rejectionReason = null;

      if (!enabled) {
        rejectionReason =
          "OBSERVER_DISABLED";
      } else if (!observing) {
        rejectionReason =
          "NOT_OBSERVING";
      } else if (
        observerDirection === null
      ) {
        rejectionReason =
          "INVALID_DIRECTION";
      } else if (
        angleDifference >
        fieldOfView / 2
      ) {
        rejectionReason =
          "OUTSIDE_FIELD_OF_VIEW";
      }

      const candidate =
        rejectionReason === null
          ? evaluateCrewObserver(
              observer,
              {
                role,
                ...crewObserver,
              },
              targetDirection,
            )
          : null;

      if (candidate) {
        candidates.push(candidate);
      }

      diagnostics.push({
        role,
        sourceType: "crew-observer",
        enabled,
        observing,
        observerDirection,
        targetDirection,
        angleDifference,
        fieldOfView,
        range:
          nonNegativeOrDefault(
            crewObserver?.range,
            DEFAULT_OBSERVER_RANGE,
          ),
        identificationFactor:
          nonNegativeOrDefault(
            crewObserver
              ?.identificationFactor,
            DEFAULT_IDENTIFICATION_FACTOR,
          ),
        directionAccepted:
          Boolean(candidate),
        rejectionReason,
      });
    },
  );

  const sight =
    observer.crewObservation
      ?.commanderIndependentSight;

  const sightEnabled =
    sight?.operational === true;

  const sightObserving =
    sight?.active === true;

  const sightDirection =
    Number.isFinite(sight?.direction)
      ? sight.direction
      : null;

  const sightFieldOfView =
    positiveOrDefault(
      sight?.fieldOfView,
      Math.PI / 3,
    );

  const sightAngleDifference =
    sightDirection === null
      ? null
      : getAbsoluteAngleDifference(
          targetDirection,
          sightDirection,
        );

  let sightRejectionReason = null;

  if (!sightEnabled) {
    sightRejectionReason =
      "OBSERVER_DISABLED";
  } else if (!sightObserving) {
    sightRejectionReason =
      "NOT_OBSERVING";
  } else if (sightDirection === null) {
    sightRejectionReason =
      "INVALID_DIRECTION";
  } else if (
    sightAngleDifference >
    sightFieldOfView / 2
  ) {
    sightRejectionReason =
      "OUTSIDE_FIELD_OF_VIEW";
  }

  const commanderSight =
    sightRejectionReason === null
      ? evaluateCommanderSight(
          observer,
          targetDirection,
        )
      : null;

  if (commanderSight) {
    candidates.push(commanderSight);
  }

  diagnostics.push({
    role: "commander-cps",
    sourceType: "commander-sight",
    enabled: sightEnabled,
    observing: sightObserving,
    observerDirection: sightDirection,
    targetDirection,
    angleDifference:
      sightAngleDifference,
    fieldOfView: sightFieldOfView,
    range:
      nonNegativeOrDefault(
        sight?.range,
        1.18,
      ),
    identificationFactor:
      nonNegativeOrDefault(
        sight?.identificationFactor,
        1.2,
      ),
    directionAccepted:
      Boolean(commanderSight),
    rejectionReason:
      sightRejectionReason,
  });


  candidates.diagnostics =
    diagnostics;

  return candidates;
}

function getSensorVisualRange(
  observer,
) {
  const sensorVisualRange =
    observer.sensors
      ?.visualRange;

  if (
    Number.isFinite(
      sensorVisualRange,
    ) &&
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

export function getObservationVisualRange(
  observer,
  observation,
) {
  const sensorVisualRange =
    getSensorVisualRange(observer);

  const temporaryRoleRange =
    TEMPORARY_ROLE_VISUAL_RANGES[
      observation?.role
    ];

  if (
    !Number.isFinite(
      temporaryRoleRange,
    )
  ) {
    return sensorVisualRange;
  }

  return Math.max(
    sensorVisualRange,
    temporaryRoleRange,
  );
}

function getSensorIdentificationRange(
  observer,
  visualRange,
) {
  const configuredRange =
    observer.sensors
      ?.identificationRange;

  if (
    Number.isFinite(
      configuredRange,
    ) &&
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
    enemy.exposedUntilTurn !==
      null &&
    enemy.exposedUntilTurn !==
      undefined &&
    enemy.exposedUntilTurn >=
      turn &&
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
  if (
    !isExposureActive(
      enemy,
      turn,
    )
  ) {
    return (
      DETECTION_STAGES.HIDDEN
    );
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
    isExposureActive(
      enemy,
      turn,
    )
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
  smokeContext,
) {
  const visualRange =
    getObservationVisualRange(
      observer,
      observation,
    );

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
      observation
        .identificationFactor,
      DEFAULT_IDENTIFICATION_FACTOR,
    );

  const concealmentPenalty =
    getEffectiveConcealment(
      enemy,
      turn,
    ) / 25;

  const baseEffectiveVisualRange =
    Math.max(
      0,
      visualRange * observerRange -
        concealmentPenalty,
    );

  const baseEffectiveIdentificationRange =
    Math.max(
      0,
      identificationRange * observerRange *
        identificationFactor -
        concealmentPenalty,
    );

  const smokeOcclusion =
    getSmokeOcclusion({
      ...smokeContext,
      observer,
      target: enemy,
      turn,
    });

  const effectiveVisualRange =
    baseEffectiveVisualRange *
      smokeOcclusion.visualRangeFactor;

  const effectiveIdentificationRange =
    baseEffectiveIdentificationRange *
      smokeOcclusion.identificationRangeFactor;

  let stage =
    DETECTION_STAGES.HIDDEN;

  if (smokeOcclusion.blocksOpticalSight) {
    stage =
      DETECTION_STAGES.HIDDEN;
  } else if (
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

    role:
      observation.role,

    effectiveVisualRange,

    effectiveIdentificationRange,

    visualRange,

    identificationRange,

    observerRange,

    identificationFactor,

    concealmentPenalty,
    baseEffectiveVisualRange,
    baseEffectiveIdentificationRange,
    smokeOcclusion,
  };
}

function enrichCandidateDiagnostics(
  observer,
  enemy,
  distance,
  turn,
  diagnostics,
  results,
  smokeContext,
) {
  const concealmentPenalty =
    getEffectiveConcealment(
      enemy,
      turn,
    ) / 25;

  const smokeOcclusion =
    getSmokeOcclusion({
      ...smokeContext,
      observer,
      target: enemy,
      turn,
    });

  return diagnostics.map(
    (diagnostic) => {
      const visualRange =
        getObservationVisualRange(
          observer,
          diagnostic,
        );

      const identificationRange =
        getSensorIdentificationRange(
          observer,
          visualRange,
        );

      const matchingResult =
        results.find(
          (result) =>
            result.role ===
            diagnostic.role,
        ) ?? null;

      const observerRange =
        nonNegativeOrDefault(
          diagnostic.range,
          DEFAULT_OBSERVER_RANGE,
        );

      const identificationFactor =
        nonNegativeOrDefault(
          diagnostic
            .identificationFactor,
          DEFAULT_IDENTIFICATION_FACTOR,
        );

      const baseEffectiveVisualRange =
        matchingResult?.baseEffectiveVisualRange ??
        Math.max(
          0,
          visualRange * observerRange -
            concealmentPenalty,
        );

      const baseEffectiveIdentificationRange =
        matchingResult?.baseEffectiveIdentificationRange ??
        Math.max(
          0,
          identificationRange * observerRange *
            identificationFactor -
            concealmentPenalty,
        );

      const effectiveVisualRange =
        matchingResult?.effectiveVisualRange ??
        baseEffectiveVisualRange *
          smokeOcclusion.visualRangeFactor;

      const effectiveIdentificationRange =
        matchingResult?.effectiveIdentificationRange ??
        baseEffectiveIdentificationRange *
          smokeOcclusion.identificationRangeFactor;

      const candidateStage =
        matchingResult?.stage ??
        DETECTION_STAGES.HIDDEN;

      let rejectionReason =
        diagnostic.rejectionReason;

      if (
        rejectionReason === null &&
        smokeOcclusion.blocksOpticalSight
      ) {
        rejectionReason =
          "SMOKE_BLOCKED";
      } else if (
        rejectionReason === null &&
        distance > effectiveVisualRange
      ) {
        rejectionReason =
          "OUTSIDE_VISUAL_RANGE";
      }

      return {
        ...diagnostic,
        distance,
        visualRange,
        effectiveVisualRange,
        identificationRange,
        effectiveIdentificationRange,
        concealmentPenalty,
        baseEffectiveVisualRange,
        baseEffectiveIdentificationRange,
        observerInsideSmoke:
          smokeOcclusion.observerInsideSmoke,
        targetInsideSmoke:
          smokeOcclusion.targetInsideSmoke,
        pathIntersectsSmoke:
          smokeOcclusion.intersectsSmoke,
        smokeHexCount:
          smokeOcclusion.smokeHexCount,
        smokeVisualFactor:
          smokeOcclusion.visualRangeFactor,
        smokeIdentificationFactor:
          smokeOcclusion.identificationRangeFactor,
        smokeBlocked:
          smokeOcclusion.blocksOpticalSight === true,
        blockingSmokeHex:
          smokeOcclusion.blockingSmokeHex ?? null,
        candidateStage,
        accepted:
          rejectionReason === null,
        rejectionReason,
      };
    },
  );
}

function calculateDetectionStage(
  observer,
  enemy,
  distance,
  turn,
  smokeContext,
) {
  const candidates =
    getObservationCandidates(
      observer,
      enemy,
    );

  if (
    candidates.length === 0
  ) {
    return {
      stage:
        DETECTION_STAGES.HIDDEN,

      observerRole:
        null,

      distance,

      candidateCount:
        0,

      reason:
        "no-active-observation-candidate",

      effectiveVisualRange:
        0,

      effectiveIdentificationRange:
        0,

      candidateDiagnostics:
        enrichCandidateDiagnostics(
          observer,
          enemy,
          distance,
          turn,
          candidates.diagnostics ?? [],
          [],
          smokeContext,
        ),
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
          smokeContext,
        ),
    );

  const candidateDiagnostics =
    enrichCandidateDiagnostics(
      observer,
      enemy,
      distance,
      turn,
      candidates.diagnostics ?? [],
      results,
      smokeContext,
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
    stage:
      best.stage,

    observerRole:
      best.role,

    distance,

    candidateCount:
      candidates.length,

    reason:
      best.stage ===
        DETECTION_STAGES.HIDDEN
        ? "outside-effective-range"
        : "detected",

    effectiveVisualRange:
      best.effectiveVisualRange,

    effectiveIdentificationRange:
      best.effectiveIdentificationRange,

    visualRange:
      best.visualRange,

    identificationRange:
      best.identificationRange,

    observerRange:
      best.observerRange,

    identificationFactor:
      best.identificationFactor,

    concealmentPenalty:
      best.concealmentPenalty,

    baseEffectiveVisualRange:
      best.baseEffectiveVisualRange,

    baseEffectiveIdentificationRange:
      best.baseEffectiveIdentificationRange,

    smokeOcclusion:
      best.smokeOcclusion,

    candidateDiagnostics,
  };
}

function getDetectionResultScore(
  result,
) {
  return (
    nonNegativeOrDefault(
      result?.effectiveVisualRange,
      0,
    ) +
    nonNegativeOrDefault(
      result?.effectiveIdentificationRange,
      0,
    )
  );
}

function shouldReplaceBestAttempt(
  current,
  candidate,
) {
  if (!current) {
    return true;
  }

  if (
    candidate.stage !==
    current.stage
  ) {
    return (
      candidate.stage >
      current.stage
    );
  }

  const candidateScore =
    getDetectionResultScore(
      candidate,
    );

  const currentScore =
    getDetectionResultScore(
      current,
    );

  if (
    candidateScore !==
    currentScore
  ) {
    return (
      candidateScore >
      currentScore
    );
  }

  return (
    finiteOrDefault(
      candidate.distance,
      Infinity,
    ) <
    finiteOrDefault(
      current.distance,
      Infinity,
    )
  );
}

function createDetectionReplay({
  turn,
  finalStage,
  observerUnitId,
  observerRole,
  result,
  exposureMinimumStage,
  exposureActive,
  exposureApplied,
}) {
  return {
    turn,

    finalStage,

    observerUnitId:
      observerUnitId ??
      null,

    observerRole:
      observerRole ??
      null,

    distance:
      Number.isFinite(
        result?.distance,
      )
        ? result.distance
        : null,

    candidateCount:
      nonNegativeOrDefault(
        result?.candidateCount,
        0,
      ),

    candidateDiagnostics:
      Array.isArray(
        result?.candidateDiagnostics,
      )
        ? result.candidateDiagnostics
        : [],

    effectiveVisualRange:
      nonNegativeOrDefault(
        result?.effectiveVisualRange,
        0,
      ),

    effectiveIdentificationRange:
      nonNegativeOrDefault(
        result?.effectiveIdentificationRange,
        0,
      ),

    baseVisualRange:
      nonNegativeOrDefault(
        result?.visualRange,
        0,
      ),

    baseIdentificationRange:
      nonNegativeOrDefault(
        result?.identificationRange,
        0,
      ),

    observerRangeFactor:
      nonNegativeOrDefault(
        result?.observerRange,
        0,
      ),

    identificationFactor:
      nonNegativeOrDefault(
        result?.identificationFactor,
        0,
      ),

    concealmentPenalty:
      nonNegativeOrDefault(
        result?.concealmentPenalty,
        0,
      ),

    exposureMinimumStage,

    exposureActive:
      exposureActive === true,

    exposureApplied:
      exposureApplied === true,

    reason:
      exposureApplied
        ? "recon-by-fire-contact"
        : result?.reason ??
          "no-friendly-observer",
  };
}

function clearExpiredExposure(
  enemy,
  turn,
) {
  if (
    enemy.exposedUntilTurn ===
      null ||
    enemy.exposedUntilTurn ===
      undefined ||
    enemy.exposedUntilTurn >=
      turn
  ) {
    return;
  }

  enemy.temporaryExposure =
    0;

  enemy.exposedUntilTurn =
    null;
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
        unit.side ===
          "friendly" &&
        !unit.destroyed,
    );

  const smokeContext =
    prepareActiveSmokeAreas(
      runtimeScenario?.smokeAreas ?? [],
      turn,
    );

  const enemies =
    units.filter(
      (unit) =>
        unit.side ===
          "enemy" &&
        !unit.destroyed,
    );

  enemies.forEach(
    (enemy) => {
      let bestStage =
        DETECTION_STAGES.HIDDEN;

      let bestDistance =
        Infinity;

      let bestObserverId =
        null;

      let bestObserverRole =
        null;

      let bestDetectionResult =
        null;

      let bestAttempt =
        null;

      let bestAttemptObserverId =
        null;

      const exposureActive =
        isExposureActive(
          enemy,
          turn,
        );

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
              smokeContext,
            );

          if (
            shouldReplaceBestAttempt(
              bestAttempt,
              result,
            )
          ) {
            bestAttempt =
              result;

            bestAttemptObserverId =
              observer.id;
          }

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

            bestDetectionResult =
              result;
          }
        },
      );

      const calculatedStage =
        bestStage;

      bestStage =
        Math.max(
          bestStage,
          exposureMinimumStage,
        );

      const exposureApplied =
        bestStage >
          calculatedStage &&
        exposureMinimumStage ===
          DETECTION_STAGES.CONTACT;

      if (exposureApplied) {
        bestObserverId =
          null;

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

      enemy.detectionReplay =
        createDetectionReplay({
          turn,
          finalStage:
            bestStage,
          observerUnitId:
            exposureApplied
              ? null
              : bestObserverId ??
                bestAttemptObserverId,
          observerRole:
            exposureApplied
              ? "recon-by-fire"
              : bestObserverRole ??
                bestAttempt
                  ?.observerRole,
          result:
            exposureApplied
              ? bestAttempt
              : bestDetectionResult ??
                bestAttempt,
          exposureMinimumStage,
          exposureActive,
          exposureApplied,
        });

      if (
        bestStage !==
        DETECTION_STAGES.HIDDEN
      ) {
        enemy.lastKnownPosition = {
          column:
            enemy.column,

          row:
            enemy.row,
        };
      }

      clearExpiredExposure(
        enemy,
        turn,
      );
    },
  );

  return enemies;
}

export function isUnitVisible(
  unit,
  developerMode = false,
) {
  return (
    unit.side ===
      "friendly" ||
    developerMode ||
    unit.visible
  );
}
