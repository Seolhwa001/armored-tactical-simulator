// src/engine/terrainGenerator.js — 새 파일

const DEFAULT_OPTIONS = Object.freeze({
  columns: 18,
  rows: 18,
  minimumCorridorWidth: 2,
});

function terrainKey(column, row) {
  return `${column},${row}`;
}

function randomBetween(
  minimum,
  maximum,
) {
  return (
    minimum +
    Math.random() *
      (maximum - minimum)
  );
}

function randomInteger(
  minimum,
  maximum,
) {
  return Math.floor(
    randomBetween(
      minimum,
      maximum + 1,
    ),
  );
}

function clamp(
  value,
  minimum,
  maximum,
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function seededValue(
  column,
  row,
  seed,
) {
  const value =
    Math.sin(
      column * 12.9898 +
        row * 78.233 +
        seed * 31.719,
    ) *
    43758.5453;

  return (
    value -
    Math.floor(value)
  );
}

function getTerrain(
  terrain,
  column,
  row,
) {
  return terrain.get(
    terrainKey(
      column,
      row,
    ),
  );
}

function setTerrainType(
  terrain,
  column,
  row,
  type,
) {
  const target =
    getTerrain(
      terrain,
      column,
      row,
    );

  if (target) {
    target.type = type;
  }
}

function createBaseTerrain(
  options,
  seed,
) {
  const terrain =
    new Map();

  for (
    let row = -options.rows;
    row <= options.rows;
    row += 1
  ) {
    for (
      let column = -options.columns;
      column <= options.columns;
      column += 1
    ) {
      const value =
        seededValue(
          column,
          row,
          seed,
        );

      terrain.set(
        terrainKey(
          column,
          row,
        ),
        {
          column,
          row,

          type:
            value < 0.43
              ? "grass"
              : "open",

          elevation: Math.round(
            8 +
              seededValue(
                column + 17,
                row - 9,
                seed,
              ) *
                42,
          ),
        },
      );
    }
  }

  return terrain;
}

function generateCluster(
  terrain,
  type,
  centerColumn,
  centerRow,
  radius,
  density,
  seed,
) {
  for (
    let row =
      centerRow - radius;
    row <=
    centerRow + radius;
    row += 1
  ) {
    for (
      let column =
        centerColumn - radius;
      column <=
      centerColumn + radius;
      column += 1
    ) {
      const distance =
        Math.hypot(
          column - centerColumn,
          row - centerRow,
        );

      if (
        distance >
        radius
      ) {
        continue;
      }

      const edgeFactor =
        1 -
        distance /
          (radius + 0.5);

      const value =
        seededValue(
          column,
          row,
          seed,
        );

      if (
        value <
        density *
          (
            0.4 +
            edgeFactor * 0.8
          )
      ) {
        setTerrainType(
          terrain,
          column,
          row,
          type,
        );
      }
    }
  }
}

function generateTerrainClusters(
  terrain,
  options,
  seed,
) {
  const forestCount =
    randomInteger(5, 9);

  const ridgeCount =
    randomInteger(4, 7);

  for (
    let index = 0;
    index < forestCount;
    index += 1
  ) {
    generateCluster(
      terrain,
      "forest",

      randomInteger(
        -options.columns + 3,
        options.columns - 3,
      ),

      randomInteger(
        -options.rows + 3,
        options.rows - 3,
      ),

      randomInteger(2, 4),
      randomBetween(
        0.55,
        0.85,
      ),

      seed +
        index * 71,
    );
  }

  for (
    let index = 0;
    index < ridgeCount;
    index += 1
  ) {
    generateCluster(
      terrain,
      "ridge",

      randomInteger(
        -options.columns + 3,
        options.columns - 3,
      ),

      randomInteger(
        -options.rows + 3,
        options.rows - 3,
      ),

      randomInteger(2, 5),
      randomBetween(
        0.45,
        0.75,
      ),

      seed +
        1000 +
        index * 83,
    );
  }
}

function generateRoad(
  terrain,
  options,
) {
  const horizontal =
    Math.random() < 0.5;

  const offset =
    horizontal
      ? randomInteger(
          -Math.floor(
            options.rows * 0.55,
          ),
          Math.floor(
            options.rows * 0.55,
          ),
        )
      : randomInteger(
          -Math.floor(
            options.columns * 0.55,
          ),
          Math.floor(
            options.columns * 0.55,
          ),
        );

  let drift = 0;

  const applyDrift = () => {
    if (
      Math.random() < 0.25
    ) {
      drift +=
        Math.random() < 0.5
          ? -1
          : 1;
    }

    drift =
      clamp(
        drift,
        -4,
        4,
      );
  };

  if (horizontal) {
    for (
      let column =
        -options.columns;
      column <=
      options.columns;
      column += 1
    ) {
      applyDrift();

      const row =
        offset + drift;

      setTerrainType(
        terrain,
        column,
        row,
        "road",
      );

      if (
        Math.random() < 0.3
      ) {
        setTerrainType(
          terrain,
          column,
          row + 1,
          "road",
        );
      }
    }

    return;
  }

  for (
    let row =
      -options.rows;
    row <=
    options.rows;
    row += 1
  ) {
    applyDrift();

    const column =
      offset + drift;

    setTerrainType(
      terrain,
      column,
      row,
      "road",
    );

    if (
      Math.random() < 0.3
    ) {
      setTerrainType(
        terrain,
        column + 1,
        row,
        "road",
      );
    }
  }
}

function generateRiver(
  terrain,
  options,
) {
  const vertical =
    Math.random() < 0.5;

  const baseOffset =
    vertical
      ? randomInteger(
          -Math.floor(
            options.columns * 0.6,
          ),
          Math.floor(
            options.columns * 0.6,
          ),
        )
      : randomInteger(
          -Math.floor(
            options.rows * 0.6,
          ),
          Math.floor(
            options.rows * 0.6,
          ),
        );

  const amplitude =
    randomBetween(
      2.5,
      6,
    );

  const frequency =
    randomBetween(
      0.18,
      0.34,
    );

  const phase =
    randomBetween(
      0,
      Math.PI * 2,
    );

  const calculateCurve =
    (value) =>
      Math.sin(
        value *
          frequency +
          phase,
      ) *
        amplitude +
      Math.sin(
        value *
          frequency *
          0.43 +
          phase * 1.7,
      ) *
        2;

  if (vertical) {
    for (
      let row =
        -options.rows;
      row <=
      options.rows;
      row += 1
    ) {
      const column =
        Math.round(
          baseOffset +
            calculateCurve(row),
        );

      setTerrainType(
        terrain,
        column,
        row,
        "water",
      );

      if (
        Math.random() < 0.55
      ) {
        setTerrainType(
          terrain,
          column + 1,
          row,
          "water",
        );
      }
    }

    return;
  }

  for (
    let column =
      -options.columns;
    column <=
    options.columns;
    column += 1
  ) {
    const row =
      Math.round(
        baseOffset +
          calculateCurve(column),
      );

    setTerrainType(
      terrain,
      column,
      row,
      "water",
    );

    if (
      Math.random() < 0.55
    ) {
      setTerrainType(
        terrain,
        column,
        row + 1,
        "water",
      );
    }
  }
}

function carvePlayableCorridor(
  terrain,
  options,
) {
  const baseRow =
    randomInteger(-4, 4);

  for (
    let column =
      -options.columns;
    column <=
    options.columns;
    column += 1
  ) {
    const centerRow =
      baseRow +
      Math.round(
        Math.sin(
          column * 0.28,
        ) *
          2,
      );

    for (
      let width = 0;
      width <
      options.minimumCorridorWidth;
      width += 1
    ) {
      const row =
        centerRow + width;

      const target =
        getTerrain(
          terrain,
          column,
          row,
        );

      if (
        target?.type ===
        "water"
      ) {
        target.type =
          width === 0
            ? "road"
            : "open";
      }
    }
  }
}

function getNeighbors(
  column,
  row,
) {
  const directions =
    row % 2 === 0
      ? [
          [-1, 0],
          [1, 0],
          [-1, -1],
          [0, -1],
          [-1, 1],
          [0, 1],
        ]
      : [
          [-1, 0],
          [1, 0],
          [0, -1],
          [1, -1],
          [0, 1],
          [1, 1],
        ];

  return directions.map(
    ([
      columnOffset,
      rowOffset,
    ]) => ({
      column:
        column +
        columnOffset,

      row:
        row +
        rowOffset,
    }),
  );
}

export function generateTerrain(
  customOptions = {},
) {
  const options = {
    ...DEFAULT_OPTIONS,
    ...customOptions,
  };

  const seed =
    customOptions.seed ??
    randomInteger(
      1,
      1000000,
    );

  const terrain =
    createBaseTerrain(
      options,
      seed,
    );

  generateTerrainClusters(
    terrain,
    options,
    seed,
  );

  generateRiver(
    terrain,
    options,
  );

  generateRoad(
    terrain,
    options,
  );

  carvePlayableCorridor(
    terrain,
    options,
  );

  return terrain;
}

export function getAvailablePlacementHexes(
  terrain,
  terrainTypes,
) {
  return Array.from(
    terrain.values(),
  )
    .filter((hex) =>
      Number.isFinite(
        terrainTypes[
          hex.type
        ]?.movementCost,
      ),
    )
    .map((hex) => ({
      column: hex.column,
      row: hex.row,
      passable: true,
    }));
}

export function ensureUnitHexesPassable(
  terrain,
  units,
) {
  units.forEach((unit) => {
    const current =
      getTerrain(
        terrain,
        unit.column,
        unit.row,
      );

    if (current) {
      current.type = "open";
    }

    getNeighbors(
      unit.column,
      unit.row,
    )
      .slice(0, 2)
      .forEach((neighbor) => {
        const adjacent =
          getTerrain(
            terrain,
            neighbor.column,
            neighbor.row,
          );

        if (
          adjacent?.type ===
          "water"
        ) {
          adjacent.type =
            "open";
        }
      });
  });
}
