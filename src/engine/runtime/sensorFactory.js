// ============================================================
// ATS PROJECT
// File      : src/engine/runtime/sensorFactory.js
// Sprint    : 3.9.1
// Revision  : R2
// Build     : 2026-08-05
// Type      : FULL REPLACEMENT
// Purpose   : Normalize legacy and directional sensor ranges
// ============================================================

const DEFAULT_TANK_SURROUNDING_RECON = 75;
const DEFAULT_TANK_DIRECTIONAL_OBSERVATION = 55;
const DEFAULT_NON_TANK_OBSERVATION = 50;
const LEGACY_RANGE_DIVISOR = 10;
const DEFAULT_IDENTIFICATION_RATIO = 0.48;

function finiteOrDefault(value, fallback) {
  return Number.isFinite(value)
    ? value
    : fallback;
}

function positiveOrDefault(value, fallback) {
  return Math.max(
    0.01,
    finiteOrDefault(value, fallback),
  );
}

function getExplicitPositiveValue(value) {
  return (
    Number.isFinite(value) &&
    value > 0
      ? value
      : null
  );
}

function getLegacyVisualRange(
  directionalObservation,
) {
  return positiveOrDefault(
    directionalObservation /
      LEGACY_RANGE_DIVISOR,
    DEFAULT_NON_TANK_OBSERVATION /
      LEGACY_RANGE_DIVISOR,
  );
}

function getIdentificationRange(
  unitData,
  visualRange,
) {
  const configuredRange =
    getExplicitPositiveValue(
      unitData?.identificationRange,
    );

  if (configuredRange !== null) {
    return configuredRange;
  }

  return (
    visualRange *
    DEFAULT_IDENTIFICATION_RATIO
  );
}

function createTankSensors(unitData) {
  const surroundingRecon =
    positiveOrDefault(
      unitData?.surroundingRecon,
      DEFAULT_TANK_SURROUNDING_RECON,
    );

  const directionalObservation =
    positiveOrDefault(
      unitData?.directionalObservation,
      DEFAULT_TANK_DIRECTIONAL_OBSERVATION,
    );

  const visualRange =
    getExplicitPositiveValue(
      unitData?.visualRange,
    ) ??
    getLegacyVisualRange(
      directionalObservation,
    );

  return {
    surroundingRecon,
    directionalObservation,
    visualRange,

    identificationRange:
      getIdentificationRange(
        unitData,
        visualRange,
      ),

    thermal:
      unitData?.thermal ??
      false,

    nightVision:
      unitData?.nightVision ??
      false,

    laserRangefinder:
      unitData?.laserRangefinder ??
      true,

    commanderIndependentSight:
      unitData?.commanderIndependentSight ??
      true,

    hunterKiller:
      unitData?.hunterKiller ??
      true,
  };
}

function createNonTankSensors(unitData) {
  const observation =
    positiveOrDefault(
      unitData?.observation,
      DEFAULT_NON_TANK_OBSERVATION,
    );

  const surroundingRecon =
    positiveOrDefault(
      unitData?.surroundingRecon,
      observation,
    );

  const directionalObservation =
    positiveOrDefault(
      unitData?.directionalObservation,
      observation,
    );

  const visualRange =
    getExplicitPositiveValue(
      unitData?.visualRange,
    ) ??
    getLegacyVisualRange(
      directionalObservation,
    );

  return {
    surroundingRecon,
    directionalObservation,
    visualRange,

    identificationRange:
      getIdentificationRange(
        unitData,
        visualRange,
      ),

    thermal:
      unitData?.thermal ??
      false,

    nightVision:
      unitData?.nightVision ??
      false,

    laserRangefinder:
      unitData?.laserRangefinder ??
      false,

    commanderIndependentSight:
      unitData?.commanderIndependentSight ??
      false,

    hunterKiller:
      unitData?.hunterKiller ??
      false,
  };
}

export function createRuntimeSensors({
  unitData = {},
  unitType,
} = {}) {
  return unitType === "tank"
    ? createTankSensors(unitData)
    : createNonTankSensors(unitData);
}
