// ============================================================
// ATS PROJECT
// File      : src/render/fogRenderer.js
// Sprint    : 3.9.x
// Revision  : R1
// Build     : 2026-08-05
// Type      : PATCHED FULL REPLACEMENT
// Purpose   : Fog visibility with shared smoke occlusion
// ============================================================

import {
  getSmokeOcclusion,
  prepareActiveSmokeAreas,
} from "../engine/combat.js";

import {
  getHexDistance,
} from "../engine/hexGeometry.js";

function terrainKey(column, row) {
  return `${column},${row}`;
}

function getObservationRange(unit) {
  if (unit.action?.type === "recon") return 10;
  return 7;
}

export function createFogState() {
  return {
    current: new Set(),
    explored: new Set(),
    version: 0,
  };
}

export function resetFog(fog) {
  fog.current.clear();
  fog.explored.clear();
  fog.version += 1;
}

export function updateFog(
  fog,
  terrain,
  units,
  smokeAreas = [],
  turn = null,
) {
  const previousCurrent = fog.current;
  const nextCurrent = new Set();
  const smokeContext = prepareActiveSmokeAreas(
    smokeAreas,
    turn,
  );
  const visibilityCache = new Map();

  units
    .filter((unit) =>
      unit.side === "friendly" &&
      !unit.destroyed,
    )
    .forEach((unit) => {
      const range = getObservationRange(unit);
      terrain.forEach((hex) => {
        const distance = getHexDistance(unit, hex);
        if (distance > range) return;
        const cacheKey =
          `${unit.id ?? `${unit.column},${unit.row}`}>` +
          terrainKey(hex.column, hex.row);
        let occlusion = visibilityCache.get(cacheKey);
        if (!occlusion) {
          occlusion = getSmokeOcclusion({
            ...smokeContext,
            observer: unit,
            target: hex,
            turn,
          });
          visibilityCache.set(cacheKey, occlusion);
        }
        const effectiveRange =
          range * occlusion.visualRangeFactor;
        if (distance > effectiveRange) return;
        const key = terrainKey(hex.column, hex.row);
        nextCurrent.add(key);
        fog.explored.add(key);
      });
    });

  let changed = previousCurrent.size !== nextCurrent.size;
  if (!changed) {
    for (const key of nextCurrent) {
      if (!previousCurrent.has(key)) {
        changed = true;
        break;
      }
    }
  }
  fog.current = nextCurrent;
  if (changed) fog.version += 1;
  return changed;
}

export function drawFogLayer({
  context, terrain, fog, bounds, hexRadius,
  hexToWorld, drawHexagon, isPointVisible,
}) {
  terrain.forEach((hex) => {
    const key = terrainKey(hex.column, hex.row);
    if (fog.current.has(key)) return;
    const point = hexToWorld(hex.column, hex.row);
    if (!isPointVisible(point, bounds)) return;
    const explored = fog.explored.has(key);
    drawHexagon(
      point.x, point.y, hexRadius - 0.5,
      explored
        ? "rgba(4, 8, 7, 0.48)"
        : "rgba(2, 4, 4, 0.84)",
      explored
        ? "rgba(28, 39, 34, 0.45)"
        : "rgba(5, 8, 7, 0.9)",
      1,
    );
  });
}
