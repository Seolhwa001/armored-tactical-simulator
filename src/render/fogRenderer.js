// ============================================================
// ATS PROJECT
// File      : src/render/fogRenderer.js
// Sprint    : 3.9.x
// Revision  : R3
// Build     : 2026-08-06
// Type      : PARTIAL PATCH
// Purpose   : Directional fog visibility with complete smoke line blocking
// ============================================================

import {
  getSmokeOcclusion,
  prepareActiveSmokeAreas,
} from "../engine/combat.js";

import {
  getObservationVisualRange,
} from "../engine/detection.js";

import {
  getHexDirection,
  getHexDistance,
} from "../engine/hexGeometry.js";

import {
  normalizeAngle,
} from "../engine/mathUtils.js";

function terrainKey(column, row) {
  return `${column},${row}`;
}

function finiteOrDefault(value, fallback) {
  return Number.isFinite(value)
    ? value
    : fallback;
}

function nonNegativeOrDefault(value, fallback) {
  return Math.max(
    0,
    finiteOrDefault(value, fallback),
  );
}

function getAngleDifference(first, second) {
  return Math.abs(
    normalizeAngle(
      finiteOrDefault(first, 0) -
      finiteOrDefault(second, 0),
    ),
  );
}

function createObservationCapability({
  unit,
  role,
  source,
  defaultFieldOfView,
  defaultRangeFactor,
}) {
  if (
    !source ||
    source.enabled === false ||
    source.observing !== true ||
    !Number.isFinite(source.direction)
  ) {
    return null;
  }

  return {
    role,
    direction: source.direction,
    fieldOfView: Math.max(
      0.01,
      finiteOrDefault(
        source.fieldOfView,
        defaultFieldOfView,
      ),
    ),
    range:
      getObservationVisualRange(
        unit,
        { role },
      ) *
      nonNegativeOrDefault(
        source.range,
        defaultRangeFactor,
      ),
  };
}

function getActiveObservationCapabilities(unit) {
  const capabilities = [];
  const observers =
    unit.crewObservation?.observers ?? {};

  Object.entries(observers).forEach(
    ([role, observer]) => {
      const capability =
        createObservationCapability({
          unit,
          role,
          source: observer,
          defaultFieldOfView: Math.PI / 2,
          defaultRangeFactor: 1,
        });

      if (capability) {
        capabilities.push(capability);
      }
    },
  );

  const sight =
    unit.crewObservation
      ?.commanderIndependentSight;

  if (
    sight?.operational === true &&
    sight.active === true
  ) {
    const capability =
      createObservationCapability({
        unit,
        role: "commander-cps",
        source: {
          ...sight,
          enabled: true,
          observing: true,
        },
        defaultFieldOfView: Math.PI / 3,
        defaultRangeFactor: 1.18,
      });

    if (capability) {
      capabilities.push(capability);
    }
  }

  return capabilities;
}

function isHexWithinCapability(
  unit,
  hex,
  capability,
) {
  const distance =
    getHexDistance(unit, hex);

  if (distance > capability.range) {
    return false;
  }

  if (distance === 0) {
    return true;
  }

  if (capability.fieldOfView >= Math.PI * 2) {
    return true;
  }

  const targetDirection =
    getHexDirection(unit, hex);

  return (
    getAngleDifference(
      targetDirection,
      capability.direction,
    ) <= capability.fieldOfView / 2
  );
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
      const capabilities =
        getActiveObservationCapabilities(unit);

      if (capabilities.length === 0) {
        return;
      }

      terrain.forEach((hex) => {
        const matchingCapabilities =
          capabilities.filter((capability) =>
            isHexWithinCapability(
              unit,
              hex,
              capability,
            ),
          );

        if (matchingCapabilities.length === 0) {
          return;
        }

        const cacheKey =
          `${unit.id ?? `${unit.column},${unit.row}`}>` +
          terrainKey(hex.column, hex.row);

        let occlusion =
          visibilityCache.get(cacheKey);

        if (!occlusion) {
          occlusion = getSmokeOcclusion({
            ...smokeContext,
            observer: unit,
            target: hex,
            turn,
          });
          visibilityCache.set(cacheKey, occlusion);
        }

        const distance =
          getHexDistance(unit, hex);

        const visibleThroughSmoke =
          !occlusion.blocksOpticalSight &&
          matchingCapabilities.some(
            (capability) =>
              distance <=
              capability.range *
                occlusion.visualRangeFactor,
          );

        if (!visibleThroughSmoke) {
          return;
        }

        const key =
          terrainKey(hex.column, hex.row);

        nextCurrent.add(key);
        fog.explored.add(key);
      });
    });

  let changed =
    previousCurrent.size !== nextCurrent.size;

  if (!changed) {
    for (const key of nextCurrent) {
      if (!previousCurrent.has(key)) {
        changed = true;
        break;
      }
    }
  }

  fog.current = nextCurrent;

  if (changed) {
    fog.version += 1;
  }

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
