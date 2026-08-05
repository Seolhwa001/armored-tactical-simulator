// ============================================================
// ATS PROJECT
// File      : src/engine/combat.js
// Sprint    : 3.9.x
// Revision  : R3
// Build     : 2026-08-05
// Type      : PATCHED FULL REPLACEMENT
// Purpose   : Smoke creation, lifetime, and shared occlusion contract
// ============================================================

const DIRECT_FIRE_AMMUNITION = new Set([
  "apfsds",
  "heat",
  "canister",
]);

const DIRECT_HIT_UNIT_TYPES = new Set([
  "artillery-observer",
  "atgm-team",
]);

const AMMUNITION_DAMAGE = Object.freeze({
  apfsds: {
    minimum: 42,
    maximum: 68,
    accuracy: 0.82,
  },

  heat: {
    minimum: 34,
    maximum: 58,
    accuracy: 0.76,
  },

  canister: {
    minimum: 18,
    maximum: 36,
    accuracy: 0.72,
  },

  smoke: {
    minimum: 0,
    maximum: 0,
    accuracy: 1,
  },
});

const SMOKE_DURATION_TURNS = 10;
const SMOKE_RADIUS = 1;

const SMOKE_SOURCES = Object.freeze({
  MAIN_GUN: "main-gun",
  VEHICLE: "vehicle",
});
const FULL_ROTATION = Math.PI * 2;
const HEX_DIRECTION_STEP = Math.PI / 3;
const SMOKE_VISUAL_FACTOR = 0.7;
const SMOKE_IDENTIFICATION_FACTOR = 0.5;
const INSIDE_SMOKE_VISUAL_FACTOR = 0.45;
const INSIDE_SMOKE_IDENTIFICATION_FACTOR = 0.25;

function smokeKey(column, row) {
  return `${column},${row}`;
}

function normalizeDirection(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  let result = value % FULL_ROTATION;
  if (result < 0) result += FULL_ROTATION;
  return result;
}

function getDirectionIndex(direction) {
  return Math.round(
    normalizeDirection(direction) /
      HEX_DIRECTION_STEP,
  ) % 6;
}

function getNeighborHex(origin, directionIndex) {
  const evenOffsets = [
    [1, 0], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1],
  ];
  const oddOffsets = [
    [1, 0], [1, 1], [0, 1],
    [-1, 0], [0, -1], [1, -1],
  ];
  const offsets = (origin.row & 1)
    ? oddOffsets
    : evenOffsets;
  const [columnOffset, rowOffset] =
    offsets[(directionIndex + 6) % 6];
  return {
    column: origin.column + columnOffset,
    row: origin.row + rowOffset,
  };
}

function offsetToCube(hex) {
  const q = hex.column -
    (hex.row - (hex.row & 1)) / 2;
  const z = hex.row;
  const x = q;
  const y = -x - z;
  return { x, y, z };
}

function cubeToOffset(cube) {
  return {
    column: cube.x +
      (cube.z - (cube.z & 1)) / 2,
    row: cube.z,
  };
}

function cubeRound(cube) {
  let x = Math.round(cube.x);
  let y = Math.round(cube.y);
  let z = Math.round(cube.z);
  const xDifference = Math.abs(x - cube.x);
  const yDifference = Math.abs(y - cube.y);
  const zDifference = Math.abs(z - cube.z);
  if (xDifference > yDifference && xDifference > zDifference) {
    x = -y - z;
  } else if (yDifference > zDifference) {
    y = -x - z;
  } else {
    z = -x - y;
  }
  return { x, y, z };
}

function getHexLine(start, end) {
  const first = offsetToCube(start);
  const second = offsetToCube(end);
  const distance = Math.max(
    Math.abs(first.x - second.x),
    Math.abs(first.y - second.y),
    Math.abs(first.z - second.z),
  );
  if (distance === 0) return [{...start}];
  const line = [];
  for (let index = 0; index <= distance; index += 1) {
    const ratio = index / distance;
    line.push(cubeToOffset(cubeRound({
      x: first.x + (second.x - first.x) * ratio,
      y: first.y + (second.y - first.y) * ratio,
      z: first.z + (second.z - first.z) * ratio,
    })));
  }
  return line;
}

export function prepareActiveSmokeAreas(
  smokeAreas,
  turn,
) {
  const activeSmokeAreas = Array.isArray(smokeAreas)
    ? smokeAreas.filter((area) =>
        Number.isFinite(area?.column) &&
        Number.isFinite(area?.row) &&
        (!Number.isFinite(turn) ||
          !Number.isFinite(area.expiresTurn) ||
          area.expiresTurn >= turn),
      )
    : [];
  return {
    activeSmokeAreas,
    smokeHexKeys: new Set(
      activeSmokeAreas.map((area) =>
        smokeKey(area.column, area.row),
      ),
    ),
  };
}

export function getSmokeOcclusion({
  smokeAreas,
  activeSmokeAreas,
  smokeHexKeys,
  observer,
  target,
  turn,
}) {
  if (!observer || !target) {
    return {
      intersectsSmoke: false,
      observerInsideSmoke: false,
      targetInsideSmoke: false,
      smokeHexCount: 0,
      visualRangeFactor: 1,
      identificationRangeFactor: 1,
    };
  }
  const prepared = smokeHexKeys instanceof Set
    ? {
        activeSmokeAreas: Array.isArray(activeSmokeAreas)
          ? activeSmokeAreas
          : [],
        smokeHexKeys,
      }
    : prepareActiveSmokeAreas(
        activeSmokeAreas ?? smokeAreas,
        turn,
      );
  const observerKey = smokeKey(observer.column, observer.row);
  const targetKey = smokeKey(target.column, target.row);
  const observerInsideSmoke = prepared.smokeHexKeys.has(observerKey);
  const targetInsideSmoke = prepared.smokeHexKeys.has(targetKey);
  const line = getHexLine(observer, target);
  const intersectingKeys = new Set();
  line.forEach((hex) => {
    const key = smokeKey(hex.column, hex.row);
    if (prepared.smokeHexKeys.has(key)) intersectingKeys.add(key);
  });
  const smokeHexCount = intersectingKeys.size;
  let visualRangeFactor =
    Math.pow(SMOKE_VISUAL_FACTOR, smokeHexCount);
  let identificationRangeFactor =
    Math.pow(SMOKE_IDENTIFICATION_FACTOR, smokeHexCount);
  if (observerInsideSmoke || targetInsideSmoke) {
    visualRangeFactor *= INSIDE_SMOKE_VISUAL_FACTOR;
    identificationRangeFactor *=
      INSIDE_SMOKE_IDENTIFICATION_FACTOR;
  }
  return {
    intersectsSmoke: smokeHexCount > 0,
    observerInsideSmoke,
    targetInsideSmoke,
    smokeHexCount,
    visualRangeFactor: Math.max(0.15, visualRangeFactor),
    identificationRangeFactor: Math.max(0.08, identificationRangeFactor),
  };
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

function ensureSmokeAreas(
  runtimeScenario,
) {
  if (
    !Array.isArray(
      runtimeScenario.smokeAreas,
    )
  ) {
    runtimeScenario.smokeAreas = [];
  }

  return runtimeScenario.smokeAreas;
}

function removeExpiredAreasBeforeCreation(
  runtimeScenario,
  turn,
) {
  ensureSmokeAreas(
    runtimeScenario,
  );

  runtimeScenario.smokeAreas =
    runtimeScenario.smokeAreas.filter(
      (area) =>
        area.expiresTurn >= turn,
    );
}

function createOrRefreshSmokeArea({
  runtimeScenario,
  sourceUnit,
  targetHex,
  turn,
  sourceType,
}) {
  if (
    !runtimeScenario ||
    !sourceUnit ||
    !targetHex
  ) {
    return null;
  }

  removeExpiredAreasBeforeCreation(
    runtimeScenario,
    turn,
  );

  const existing =
    runtimeScenario.smokeAreas.find(
      (area) =>
        area.column ===
          targetHex.column &&
        area.row ===
          targetHex.row &&
        area.sourceType ===
          sourceType,
    );

  if (existing) {
    existing.startedTurn =
      turn;

    existing.expiresTurn =
      turn +
      SMOKE_DURATION_TURNS;

    existing.sourceUnitId =
      sourceUnit.id;

    existing.sourceType =
      sourceType;

    return existing;
  }

  const smokeArea = {
    id:
      `smoke-${sourceType}-` +
      `${sourceUnit.id}-${turn}-` +
      `${targetHex.column}-${targetHex.row}`,

    column:
      targetHex.column,

    row:
      targetHex.row,

    radius:
      SMOKE_RADIUS,

    sourceUnitId:
      sourceUnit.id,

    sourceType,

    startedTurn:
      turn,

    expiresTurn:
      turn +
      SMOKE_DURATION_TURNS,
  };

  runtimeScenario.smokeAreas.push(
    smokeArea,
  );

  return smokeArea;
}

function getTargetUnit(
  runtimeScenario,
  shooter,
) {
  const targetUnitId =
    shooter.fireControl
      ?.targetUnitId;

  if (targetUnitId) {
    return (
      runtimeScenario.units.find(
        (unit) =>
          unit.id ===
            targetUnitId &&
          !unit.destroyed,
      ) ?? null
    );
  }

  const targetHex =
    shooter.fireControl
      ?.targetHex;

  if (!targetHex) {
    return null;
  }

  return (
    runtimeScenario.units.find(
      (unit) =>
        unit.side !==
          shooter.side &&
        !unit.destroyed &&
        unit.column ===
          targetHex.column &&
        unit.row ===
          targetHex.row,
    ) ?? null
  );
}

function calculateHitChance(
  shooter,
  target,
  shotOptions,
) {
  const ammunition =
    shooter.fireControl
      ?.ammunition;

  const ammunitionData =
    AMMUNITION_DAMAGE[
      ammunition
    ] ??
    AMMUNITION_DAMAGE.heat;

  const aimStability =
    clamp(
      shotOptions
        .aimStability ??
        shooter.fireControl
          ?.aimStability ??
        1,
      0,
      1,
    );

  const movingPenalty =
    clamp(
      shotOptions
        .movingFirePenalty ??
        0,
      0,
      0.9,
    );

  const concealmentPenalty =
    clamp(
      (
        target?.concealment ??
        0
      ) / 250,
      0,
      0.35,
    );

  return clamp(
    ammunitionData.accuracy *
      aimStability -
      movingPenalty -
      concealmentPenalty,
    0.05,
    0.95,
  );
}

function calculateDamage(
  shooter,
  target,
) {
  const ammunition =
    shooter.fireControl
      ?.ammunition;

  if (
    DIRECT_HIT_UNIT_TYPES.has(
      target.type,
    ) &&
    DIRECT_FIRE_AMMUNITION.has(
      ammunition,
    )
  ) {
    return (
      target.health?.current ??
      1
    );
  }

  const damageData =
    AMMUNITION_DAMAGE[
      ammunition
    ] ??
    AMMUNITION_DAMAGE.heat;

  const resistance =
    clamp(
      (
        target.protection
          ?.explosionResistance ??
        0
      ) / 100,
      0,
      0.75,
    );

  const rawDamage =
    randomBetween(
      damageData.minimum,
      damageData.maximum,
    );

  return Math.max(
    1,
    Math.round(
      rawDamage *
        (1 - resistance),
    ),
  );
}

function stopDestroyedUnit(unit) {
  unit.destroyed = true;
  unit.condition = "격파";
  unit.command = "행동 불가";

  unit.destination = null;
  unit.plannedPath = [];

  if (unit.action) {
    unit.action.type =
      "idle";

    unit.action.targetHex =
      null;

    unit.action.targetUnitId =
      null;

    unit.action.direction =
      null;

    unit.action.crewRole =
      null;
  }

  if (unit.fireControl) {
    unit.fireControl.state =
      "stopped";

    unit.fireControl.procedureState =
      "stopped";

    unit.fireControl.targetHex =
      null;

    unit.fireControl.targetUnitId =
      null;

    unit.fireControl.loading =
      false;

    unit.fireControl.loaded =
      false;

    unit.fireControl.loadingAmmunition =
      null;

    unit.fireControl.loadedAmmunition =
      null;

    unit.fireControl.loadStartedTurn =
      null;

    unit.fireControl.loadedTurn =
      null;

    unit.fireControl.aiming =
      false;

    unit.fireControl.aimStartedTurn =
      null;

    unit.fireControl.gunnerAutonomous =
      false;
  }

  if (unit.turretControl) {
    unit.turretControl.rotating =
      false;

    unit.turretControl.warning =
      "격파";
  }
}

function applyDamage(
  target,
  damage,
  turn,
) {
  if (
    !target.health ||
    damage <= 0
  ) {
    return {
      damage: 0,
      destroyed: false,
    };
  }

  target.health.current =
    Math.max(
      0,
      target.health.current -
        damage,
    );

  target.health.lastDamage =
    damage;

  target.health.lastHitTurn =
    turn;

  const destroyed =
    target.health.current <= 0;

  if (destroyed) {
    stopDestroyedUnit(
      target,
    );
  } else {
    target.condition =
      "피해";
  }

  return {
    damage,
    destroyed,
  };
}

function createMainGunSmokeArea(
  runtimeScenario,
  shooter,
  turn,
) {
  const targetHex =
    shooter.fireControl
      ?.targetHex;

  if (!targetHex) {
    return null;
  }

  return createOrRefreshSmokeArea({
    runtimeScenario,
    sourceUnit:
      shooter,
    targetHex,
    turn,
    sourceType:
      SMOKE_SOURCES.MAIN_GUN,
  });
}

function resolveSmokeShot(
  runtimeScenario,
  shooter,
  turn,
) {
  const smokeArea =
    createMainGunSmokeArea(
      runtimeScenario,
      shooter,
      turn,
    );

  if (!smokeArea) {
    return {
      hit: false,
      damage: 0,
      destroyed: false,
      targetUnitId: null,

      smokeCreated: false,
      smokeAreaId: null,

      reason:
        "연막 목표가 지정되지 않았습니다.",
    };
  }

  return {
    hit: true,
    damage: 0,
    destroyed: false,
    targetUnitId: null,

    smokeCreated: true,

    smokeAreaId:
      smokeArea.id,

    targetHex: {
      column:
        smokeArea.column,

      row:
        smokeArea.row,
    },

    reason:
      "연막 형성",
  };
}

export function deployVehicleSmoke(
  runtimeScenario,
  unit,
  turn,
) {
  if (
    !runtimeScenario ||
    !unit ||
    unit.destroyed
  ) {
    return {
      success: false,
      reason:
        "자체연막을 전개할 수 없습니다.",
    };
  }

  const vehicleSmoke =
    unit.vehicleSmoke;

  if (!vehicleSmoke) {
    return {
      success: false,
      reason:
        "이 차량에는 자체연막 기능이 없습니다.",
    };
  }

  if (
    vehicleSmoke.remainingUses <= 0
  ) {
    return {
      success: false,
      reason:
        "사용 가능한 자체연막이 없습니다.",
    };
  }

  const centerDirection =
    getDirectionIndex(
      unit.turretDirection,
    );

  const targetHexes = [
    getNeighborHex(unit, centerDirection - 1),
    getNeighborHex(unit, centerDirection),
    getNeighborHex(unit, centerDirection + 1),
  ];

  const smokeAreas = targetHexes
    .map((targetHex) =>
      createOrRefreshSmokeArea({
        runtimeScenario,
        sourceUnit: unit,
        targetHex,
        turn,
        sourceType: SMOKE_SOURCES.VEHICLE,
      }),
    )
    .filter(Boolean);

  if (smokeAreas.length !== targetHexes.length) {
    return {
      success: false,
      reason:
        "자체연막 영역을 생성하지 못했습니다.",
    };
  }

  vehicleSmoke.remainingUses =
    Math.max(
      0,
      vehicleSmoke.remainingUses -
        1,
    );

  vehicleSmoke.lastDeployedTurn =
    turn;

  unit.command =
    "자체연막 전개";

  return {
    success: true,

    smokeCreated: true,

    smokeAreaId:
      smokeAreas[0]?.id ?? null,

    smokeAreaIds:
      smokeAreas.map((area) => area.id),

    sourceType:
      SMOKE_SOURCES.VEHICLE,

    targetHexes:
      smokeAreas.map((area) => ({
        column: area.column,
        row: area.row,
      })),

    expiresTurn:
      smokeAreas[0]?.expiresTurn ?? turn,

    remainingUses:
      vehicleSmoke.remainingUses,

    maximumUses:
      vehicleSmoke.maximumUses,

    reason:
      `차체 전방에 자체연막을 전개했습니다. ` +
      `남은 횟수 ${vehicleSmoke.remainingUses}` +
      `/${vehicleSmoke.maximumUses}`,
  };
}

export function removeExpiredSmokeAreas(
  runtimeScenario,
  turn,
) {
  if (
    !runtimeScenario ||
    !Array.isArray(
      runtimeScenario.smokeAreas,
    )
  ) {
    if (runtimeScenario) {
      runtimeScenario.smokeAreas = [];
    }

    return false;
  }

  const previousLength =
    runtimeScenario.smokeAreas.length;

  runtimeScenario.smokeAreas =
    runtimeScenario.smokeAreas.filter(
      (area) =>
        area.expiresTurn >= turn,
    );

  return (
    previousLength !==
    runtimeScenario.smokeAreas.length
  );
}

export function resolveShot(
  runtimeScenario,
  shooter,
  turn,
  shotOptions = {},
) {
  const ammunition =
    shooter.fireControl
      ?.ammunition;

  if (
    ammunition === "smoke"
  ) {
    return resolveSmokeShot(
      runtimeScenario,
      shooter,
      turn,
    );
  }

  const target =
    getTargetUnit(
      runtimeScenario,
      shooter,
    );

  if (!target) {
    return {
      hit: false,
      damage: 0,
      destroyed: false,
      targetUnitId: null,

      smokeCreated: false,

      reason:
        "목표 헥스에 유효한 객체가 없습니다.",
    };
  }

  const hitChance =
    calculateHitChance(
      shooter,
      target,
      shotOptions,
    );

  const hit =
    Math.random() <=
    hitChance;

  if (!hit) {
    return {
      hit: false,
      damage: 0,
      destroyed: false,

      targetUnitId:
        target.id,

      hitChance,
      smokeCreated: false,
      reason:
        "빗나감",
    };
  }

  const damage =
    calculateDamage(
      shooter,
      target,
    );

  const result =
    applyDamage(
      target,
      damage,
      turn,
    );

  return {
    hit: true,

    damage:
      result.damage,

    destroyed:
      result.destroyed,

    targetUnitId:
      target.id,

    hitChance,
    smokeCreated: false,

    remainingHealth:
      target.health?.current ??
      null,

    reason:
      result.destroyed
        ? "격파"
        : "피해",
  };
}
