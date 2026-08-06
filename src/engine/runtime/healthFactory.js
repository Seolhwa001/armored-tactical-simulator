// src/engine/runtime/healthFactory.js — 새 파일, 전체 코드

export function createRuntimeHealth({
  unitData = {},
  unitType,
} = {}) {
  const maximum =
    unitData.maximumHealth ??
    (unitType === "tank" ? 100 : 1);

  return {
    current: unitData.health ?? maximum,
    maximum,
    lastDamage: 0,
    lastHitTurn: null,
  };
}
