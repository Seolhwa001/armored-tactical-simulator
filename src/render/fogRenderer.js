// ============================================================
// ATS PROJECT
// File      : src/render/fogRenderer.js
// Sprint    : 4
// Revision  : R4
// Purpose   : Fog visibility sourced from the shared hex View system
// ============================================================

import {
  calculateViewHexes,
} from "../engine/view.js";

import {
  getObservationVisualRange,
} from "../engine/detection.js";

function terrainKey(column, row) {
  return `${column},${row}`;
}

function finiteOrDefault(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegativeOrDefault(value, fallback) {
  return Math.max(0, finiteOrDefault(value, fallback));
}

function getActiveObservationCapabilities(unit) {
  const capabilities = [];
  const observers = unit.crewObservation?.observers ?? {};

  Object.entries(observers).forEach(([role, source]) => {
    if (
      !source ||
      source.enabled === false ||
      source.observing !== true ||
      !Number.isFinite(source.direction)
    ) {
      return;
    }

    capabilities.push({
      role,
      direction: source.direction,
      fieldOfView: Math.max(
        0.01,
        finiteOrDefault(source.fieldOfView, Math.PI / 2),
      ),
      range:
        nonNegativeOrDefault(
          source.range,
          getObservationVisualRange(unit, { role }),
        ),
    });
  });

  const sight = unit.crewObservation?.commanderIndependentSight;
  if (
    sight?.operational === true &&
    sight.active === true &&
    Number.isFinite(sight.direction)
  ) {
    capabilities.push({
      role: "commander-cps",
      direction: sight.direction,
      fieldOfView: Math.max(
        0.01,
        finiteOrDefault(sight.fieldOfView, Math.PI / 3),
      ),
      range:
        nonNegativeOrDefault(
          sight.range,
          getObservationVisualRange(
            unit,
            { role: "commander-cps" },
          ),
        ),
    });
  }

  return capabilities;
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

  units
    .filter((unit) => unit.side === "friendly" && !unit.destroyed)
    .forEach((unit) => {
      getActiveObservationCapabilities(unit).forEach((capability) => {
        const visibleHexes = calculateViewHexes({
          origin: { column: unit.column, row: unit.row },
          direction: capability.direction,
          fieldOfView: capability.fieldOfView,
          maximumRange: capability.range,
          terrain,
          smokeAreas,
        });

        visibleHexes.forEach((key) => {
          nextCurrent.add(key);
          fog.explored.add(key);
        });
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
