// ============================================================
// ATS PROJECT
// File      : src/engine/movement.js
// Sprint    : 3.9.x
// Revision  : R1
// Build     : 2026-08-05
// Type      : PATCHED FULL REPLACEMENT
// Purpose   : Hull turning, pivot turning, and turn-speed movement control
// ============================================================

import { findPath } from "./pathfinding.js";

const FULL_ROTATION = Math.PI * 2;
const DEFAULT_HULL_TURN_RATE = Math.PI / 3;
const DEFAULT_MOVING_TURN_LIMIT = Math.PI / 3;
const MINIMUM_MOVEMENT_FACTOR = 0.35;
const MOVEMENT_BUDGET_PER_TURN = 1;
const ALIGNMENT_TOLERANCE = 0.001;

function finiteOrDefault(value, fallback) {
  return Number.isFinite(value)
    ? value
    : fallback;
}

function normalizeAngle(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  let normalized = value % FULL_ROTATION;

  if (normalized > Math.PI) {
    normalized -= FULL_ROTATION;
  }

  if (normalized < -Math.PI) {
    normalized += FULL_ROTATION;
  }

  return normalized;
}

function getAngleDifference(target, current) {
  return normalizeAngle(
    normalizeAngle(target) -
      normalizeAngle(current),
  );
}

function rotateToward(current, target, maximumStep) {
  const safeCurrent = normalizeAngle(current);
  const safeTarget = normalizeAngle(target);
  const difference = getAngleDifference(
    safeTarget,
    safeCurrent,
  );

  if (
    Math.abs(difference) <=
    ALIGNMENT_TOLERANCE
  ) {
    return safeTarget;
  }

  const step = Math.min(
    Math.abs(difference),
    Math.max(
      0,
      finiteOrDefault(
        maximumStep,
        DEFAULT_HULL_TURN_RATE,
      ),
    ),
  );

  return normalizeAngle(
    safeCurrent +
      Math.sign(difference) * step,
  );
}

function ensureMovementControl(unit) {
  if (!unit.movementControl) {
    unit.movementControl = {};
  }

  const control = unit.movementControl;

  control.hullTurnRate = Math.max(
    0.01,
    finiteOrDefault(
      control.hullTurnRate,
      DEFAULT_HULL_TURN_RATE,
    ),
  );

  control.movingTurnLimit = Math.max(
    0.01,
    finiteOrDefault(
      control.movingTurnLimit,
      DEFAULT_MOVING_TURN_LIMIT,
    ),
  );

  control.movementProgress = Math.max(
    0,
    finiteOrDefault(
      control.movementProgress,
      0,
    ),
  );

  control.targetDirection = Number.isFinite(
    control.targetDirection,
  )
    ? normalizeAngle(
        control.targetDirection,
      )
    : null;

  control.turning =
    control.turning === true;

  control.pivoting =
    control.pivoting === true;

  control.lastSpeedFactor = Math.max(
    0,
    finiteOrDefault(
      control.lastSpeedFactor,
      0,
    ),
  );

  return control;
}

function clearMovementControl(unit) {
  const control =
    ensureMovementControl(unit);

  control.movementProgress = 0;
  control.targetDirection = null;
  control.turning = false;
  control.pivoting = false;
  control.lastSpeedFactor = 0;
}

/**
 * 두 지점 사이의 방향을 라디안으로 계산한다.
 */
function calculateDirection(
  from,
  to,
  hexToWorld,
) {
  const start = hexToWorld(
    from.column,
    from.row,
  );

  const end = hexToWorld(
    to.column,
    to.row,
  );

  return normalizeAngle(
    Math.atan2(
      end.y - start.y,
      end.x - start.x,
    ),
  );
}

function calculateMovementFactor(
  angleDifference,
  movingTurnLimit,
) {
  const normalizedTurn = Math.min(
    1,
    Math.abs(angleDifference) /
      Math.max(
        movingTurnLimit,
        ALIGNMENT_TOLERANCE,
      ),
  );

  return Math.max(
    MINIMUM_MOVEMENT_FACTOR,
    1 -
      normalizedTurn *
        (1 - MINIMUM_MOVEMENT_FACTOR),
  );
}

/**
 * 객체의 이동경로를 새로 계산한다.
 *
 * @returns {{ success: boolean, reason?: string }}
 */
export function planUnitMovement({
  unit,
  destination,
  getNeighbors,
  getMovementCost,
}) {
  const path = findPath({
    start: {
      column: unit.column,
      row: unit.row,
    },
    goal: destination,
    getNeighbors,
    getMovementCost,
  });

  const alreadyAtDestination =
    unit.column === destination.column &&
    unit.row === destination.row;

  if (
    !alreadyAtDestination &&
    path.length === 0
  ) {
    unit.destination = null;
    unit.plannedPath = [];
    unit.command = "이동 불가";
    clearMovementControl(unit);

    return {
      success: false,
      reason:
        "목적지까지 이동 가능한 경로가 없습니다.",
    };
  }

  unit.destination = {
    column: destination.column,
    row: destination.row,
  };

  unit.plannedPath = path;

  const control =
    ensureMovementControl(unit);

  control.movementProgress = 0;
  control.targetDirection = null;
  control.turning = false;
  control.pivoting = false;
  control.lastSpeedFactor = 0;

  return {
    success: true,
  };
}

/**
 * 이동 명령을 취소한다.
 */
export function cancelUnitMovement(unit) {
  unit.destination = null;
  unit.plannedPath = [];
  unit.command = "대기";
  clearMovementControl(unit);
}

/**
 * 한 턴 동안 차체 선회와 경로 이동을 처리한다.
 *
 * - 큰 방향 차이는 제자리 선회로 처리한다.
 * - 작은 방향 차이는 이동 중 선회가 가능하다.
 * - 조향 각도가 클수록 이동 진행량이 감소한다.
 * - 포탑 방향은 변경하지 않는다.
 */
export function advanceUnitMovement({
  unit,
  turn,
  hexToWorld,
}) {
  if (
    !unit.destination ||
    !Array.isArray(unit.plannedPath) ||
    unit.plannedPath.length === 0
  ) {
    clearMovementControl(unit);

    return {
      moved: false,
      turned: false,
      pivoted: false,
      arrived: false,
    };
  }

  const nextHex =
    unit.plannedPath[0];

  const previousPosition = {
    column: unit.column,
    row: unit.row,
  };

  const control =
    ensureMovementControl(unit);

  const targetDirection =
    calculateDirection(
      previousPosition,
      nextHex,
      hexToWorld,
    );

  const currentDirection =
    normalizeAngle(
      finiteOrDefault(
        unit.hullDirection ??
          unit.direction,
        0,
      ),
    );

  const initialDifference =
    getAngleDifference(
      targetDirection,
      currentDirection,
    );

  const initialAbsoluteDifference =
    Math.abs(initialDifference);

  control.targetDirection =
    targetDirection;

  const pivotRequired =
    initialAbsoluteDifference >
    control.movingTurnLimit;

  const nextHullDirection =
    rotateToward(
      currentDirection,
      targetDirection,
      control.hullTurnRate,
    );

  const turned =
    Math.abs(
      getAngleDifference(
        nextHullDirection,
        currentDirection,
      ),
    ) > ALIGNMENT_TOLERANCE;

  unit.hullDirection =
    nextHullDirection;

  // 기존 코드 호환용 차체 방향 별칭.
  unit.direction =
    unit.hullDirection;

  control.turning =
    turned;

  control.pivoting =
    pivotRequired;

  if (pivotRequired) {
    control.lastSpeedFactor = 0;
    unit.command = "제자리 선회";

    return {
      moved: false,
      turned,
      pivoted: true,
      arrived: false,
      previousPosition,
      targetDirection,
      hullDirection:
        unit.hullDirection,
      angleDifference:
        initialAbsoluteDifference,
      speedFactor: 0,
    };
  }

  const speedFactor =
    calculateMovementFactor(
      initialAbsoluteDifference,
      control.movingTurnLimit,
    );

  control.lastSpeedFactor =
    speedFactor;

  control.movementProgress +=
    speedFactor;

  if (
    control.movementProgress +
      ALIGNMENT_TOLERANCE <
    MOVEMENT_BUDGET_PER_TURN
  ) {
    unit.command = turned
      ? "이동 중 선회"
      : "이동 준비";

    return {
      moved: false,
      turned,
      pivoted: false,
      arrived: false,
      previousPosition,
      targetDirection,
      hullDirection:
        unit.hullDirection,
      angleDifference:
        initialAbsoluteDifference,
      speedFactor,
    };
  }

  control.movementProgress = Math.max(
    0,
    control.movementProgress -
      MOVEMENT_BUDGET_PER_TURN,
  );

  unit.movementHistory.push({
    column: previousPosition.column,
    row: previousPosition.row,
    turn,
  });

  unit.column = nextHex.column;
  unit.row = nextHex.row;
  unit.plannedPath.shift();

  const arrived =
    unit.column === unit.destination.column &&
    unit.row === unit.destination.row;

  if (arrived) {
    unit.destination = null;
    unit.plannedPath = [];
    unit.command = "목적지 도달";
    clearMovementControl(unit);
  } else {
    unit.command = turned
      ? "이동 중 선회"
      : "이동";

    control.turning = false;
    control.pivoting = false;
  }

  return {
    moved: true,
    turned,
    pivoted: false,
    arrived,
    previousPosition,
    currentPosition: {
      column: unit.column,
      row: unit.row,
    },
    targetDirection,
    hullDirection:
      unit.hullDirection,
    angleDifference:
      initialAbsoluteDifference,
    speedFactor,
  };
}
