// src/engine/runtime/sensorFactory.js — 새 파일, 전체 코드

export function createRuntimeSensors({
  unitData,
  unitType,
} = {}) {
  const isTank =
    unitType === "tank";

  if (isTank) {
    return {
      surroundingRecon:
        unitData?.surroundingRecon ??
        75,

      directionalObservation:
        unitData?.directionalObservation ??
        55,

      visualRange:
        unitData?.visualRange ??
        null,

      identificationRange:
        unitData?.identificationRange ??
        null,

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

  const observation =
    unitData?.observation ??
    50;

  return {
    surroundingRecon: observation,
    directionalObservation: observation,

    visualRange:
      unitData?.visualRange ??
      null,

    identificationRange:
      unitData?.identificationRange ??
      null,

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
