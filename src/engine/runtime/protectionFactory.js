// src/engine/runtime/protectionFactory.js

export function createRuntimeProtection({
  unitData = {},
  unitType,
} = {}) {
  if (unitType === "tank") {
    return {
      explosionResistance:
        unitData.explosionResistance ?? 25,

      opticsCondition: "정상",

      fireSuppressionStage: 0,

      engineCondition: "정상",

      turretCondition: "정상",

      mobilityKill: false,

      firepowerKill: false,
    };
  }

  return {
    explosionResistance:
      unitData.explosionResistance ?? 5,

    opticsCondition: null,

    fireSuppressionStage: 0,
  };
}
