// ============================================================
// ATS PROJECT
// File      : src/engine/view.js
// Sprint    : 4
// Revision  : R1
// Purpose   : Hex-based View calculation separated from Detection
// ============================================================

import {
  getHexDirection,
  getHexDistance,
} from "./hexGeometry.js";

import {
  normalizeAngle,
} from "./mathUtils.js";

export const DEFAULT_FOREST_VISIBLE_DEPTH = 2;
export const DEFAULT_OBSERVER_HEIGHT_METERS = 2.5;
export const DEFAULT_ELEVATION_BLOCK_THRESHOLD_METERS = 0.5;

export function toHexKey(column, row) {
  return `${column},${row}`;
}

function offsetToCube(column, row) {
  const x = column - (row - (row & 1)) / 2;
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

function cubeToOffset(cube) {
  const row = cube.z;
  const column = cube.x + (row - (row & 1)) / 2;
  return { column, row };
}

function cubeRound(cube) {
  let x = Math.round(cube.x);
  let y = Math.round(cube.y);
  let z = Math.round(cube.z);

  const dx = Math.abs(x - cube.x);
  const dy = Math.abs(y - cube.y);
  const dz = Math.abs(z - cube.z);

  if (dx > dy && dx > dz) {
    x = -y - z;
  } else if (dy > dz) {
    y = -x - z;
  } else {
    z = -x - y;
  }

  return { x, y, z };
}

function lerp(first, second, t) {
  return first + (second - first) * t;
}

export function getHexLine(start, end) {
  const distance = getHexDistance(start, end);
  if (distance <= 0) {
    return [{ column: start.column, row: start.row }];
  }

  const first = offsetToCube(start.column, start.row);
  const second = offsetToCube(end.column, end.row);
  const result = [];

  for (let step = 0; step <= distance; step += 1) {
    const t = step / distance;
    const cube = cubeRound({
      x: lerp(first.x, second.x, t),
      y: lerp(first.y, second.y, t),
      z: lerp(first.z, second.z, t),
    });
    result.push(cubeToOffset(cube));
  }

  return result;
}

function isSmokeHex(smokeAreas, column, row) {
  return (Array.isArray(smokeAreas) ? smokeAreas : []).some((area) => {
    if (!area || area.active === false) {
      return false;
    }

    if (Array.isArray(area.hexes)) {
      return area.hexes.some(
        (hex) => hex?.column === column && hex?.row === row,
      );
    }

    if (
      Number.isFinite(area.column) &&
      Number.isFinite(area.row) &&
      Number.isFinite(area.radius)
    ) {
      return getHexDistance(
        { column: area.column, row: area.row },
        { column, row },
      ) <= area.radius;
    }

    return area.column === column && area.row === row;
  });
}

function isWithinArc(origin, target, direction, fieldOfView) {
  if (!Number.isFinite(direction) || !Number.isFinite(fieldOfView)) {
    return false;
  }

  const targetDirection = getHexDirection(origin, target);
  return Math.abs(normalizeAngle(targetDirection - direction)) <= fieldOfView / 2;
}

function evaluateLineOfSight({
  origin,
  target,
  terrain,
  smokeAreas,
  forestVisibleDepth,
  observerHeightMeters,
  elevationBlockThresholdMeters,
}) {
  const line = getHexLine(origin, target);
  let forestDepth = 0;
  const originTerrain = terrain.get(toHexKey(origin.column, origin.row));

  if (!originTerrain) {
    return false;
  }

  const originGroundElevation = Number.isFinite(originTerrain.elevation)
    ? originTerrain.elevation
    : 0;
  const targetTerrain = terrain.get(toHexKey(target.column, target.row));
  const targetGroundElevation = Number.isFinite(targetTerrain?.elevation)
    ? targetTerrain.elevation
    : originGroundElevation;
  const observerEyeElevation = originGroundElevation + observerHeightMeters;
  const targetEyeElevation = targetGroundElevation + observerHeightMeters;
  const totalSteps = Math.max(1, line.length - 1);

  for (let index = 1; index < line.length; index += 1) {
    const hex = line[index];
    const isTarget = index === line.length - 1;
    const terrainHex = terrain.get(toHexKey(hex.column, hex.row));

    if (!terrainHex) {
      return false;
    }

    if (isSmokeHex(smokeAreas, hex.column, hex.row)) {
      return isTarget;
    }

    if (!isTarget) {
      const elevation = Number.isFinite(terrainHex.elevation)
        ? terrainHex.elevation
        : 0;
      const progress = index / totalSteps;
      const sightLineElevation =
        observerEyeElevation +
        (targetEyeElevation - observerEyeElevation) * progress;

      if (elevation >= sightLineElevation + elevationBlockThresholdMeters) {
        return false;
      }
    }

    if (terrainHex.type === "forest") {
      forestDepth += 1;
      if (forestDepth > forestVisibleDepth) {
        return false;
      }
    } else {
      forestDepth = 0;
    }
  }

  return true;
}

export function calculateViewHexes({
  origin,
  direction,
  fieldOfView,
  maximumRange,
  terrain,
  smokeAreas = [],
  forestVisibleDepth = DEFAULT_FOREST_VISIBLE_DEPTH,
  observerHeightMeters = DEFAULT_OBSERVER_HEIGHT_METERS,
  elevationBlockThresholdMeters = DEFAULT_ELEVATION_BLOCK_THRESHOLD_METERS,
}) {
  if (
    !origin ||
    !(terrain instanceof Map) ||
    !Number.isFinite(maximumRange) ||
    maximumRange < 0 ||
    !Number.isFinite(fieldOfView) ||
    fieldOfView <= 0
  ) {
    return new Set();
  }

  const view = new Set([toHexKey(origin.column, origin.row)]);

  terrain.forEach((hex) => {
    const target = {
      column: hex.column,
      row: hex.row,
    };

    if (getHexDistance(origin, target) > maximumRange) {
      return;
    }

    if (!isWithinArc(origin, target, direction, fieldOfView)) {
      return;
    }

    if (!evaluateLineOfSight({
      origin,
      target,
      terrain,
      smokeAreas,
      forestVisibleDepth,
      observerHeightMeters,
      elevationBlockThresholdMeters,
    })) {
      return;
    }

    view.add(toHexKey(target.column, target.row));
  });

  return view;
}
