// src/render/fogRenderer.js — 새 파일

function terrainKey(
  column,
  row,
) {
  return `${column},${row}`;
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
      ) /
        2,

    r: row,
  };
}

function getHexDistance(
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
    Math.abs(
      deltaQ + deltaR,
    )
  ) / 2;
}

function getObservationRange(
  unit,
) {
  if (
    unit.action?.type ===
    "recon"
  ) {
    return 10;
  }

  return 7;
}

export function createFogState() {
  return {
    current: new Set(),
    explored: new Set(),
    version: 0,
  };
}

export function resetFog(
  fog,
) {
  fog.current.clear();
  fog.explored.clear();
  fog.version += 1;
}

export function updateFog(
  fog,
  terrain,
  units,
) {
  const previousCurrent =
    fog.current;

  const nextCurrent =
    new Set();

  units
    .filter(
      (unit) =>
        unit.side ===
          "friendly" &&
        !unit.destroyed,
    )
    .forEach((unit) => {
      const range =
        getObservationRange(
          unit,
        );

      terrain.forEach((hex) => {
        if (
          getHexDistance(
            unit,
            hex,
          ) > range
        ) {
          return;
        }

        const key =
          terrainKey(
            hex.column,
            hex.row,
          );

        nextCurrent.add(key);
        fog.explored.add(key);
      });
    });

  let changed =
    previousCurrent.size !==
    nextCurrent.size;

  if (!changed) {
    for (
      const key of nextCurrent
    ) {
      if (
        !previousCurrent.has(
          key,
        )
      ) {
        changed = true;
        break;
      }
    }
  }

  fog.current =
    nextCurrent;

  if (changed) {
    fog.version += 1;
  }

  return changed;
}

export function drawFogLayer({
  context,
  terrain,
  fog,
  bounds,
  hexRadius,
  hexToWorld,
  drawHexagon,
  isPointVisible,
}) {
  terrain.forEach((hex) => {
    const key =
      terrainKey(
        hex.column,
        hex.row,
      );

    if (
      fog.current.has(key)
    ) {
      return;
    }

    const point =
      hexToWorld(
        hex.column,
        hex.row,
      );

    if (
      !isPointVisible(
        point,
        bounds,
      )
    ) {
      return;
    }

    const explored =
      fog.explored.has(key);

    drawHexagon(
      point.x,
      point.y,
      hexRadius - 0.5,

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
