import { findPath } from "./pathfinding.js";

/**
 * 두 지점 사이의 방향을 라디안으로 계산한다.
 */
function calculateDirection(from, to, hexToWorld) {
  const start = hexToWorld(from.column, from.row);
  const end = hexToWorld(to.column, to.row);

  return Math.atan2(
    end.y - start.y,
    end.x - start.x,
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

  if (!alreadyAtDestination && path.length === 0) {
    unit.destination = null;
    unit.plannedPath = [];
    unit.command = "이동 불가";

    return {
      success: false,
      reason: "목적지까지 이동 가능한 경로가 없습니다.",
    };
  }

  unit.destination = {
    column: destination.column,
    row: destination.row,
  };

  unit.plannedPath = path;

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
}

/**
 * 한 턴 동안 객체를 경로상에서 한 칸 이동시킨다.
 *
 * 현재는 한 턴당 한 칸 이동한다.
 * 이후 객체 속도와 지형 이동비용에 따라 이동량을 확장할 수 있다.
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
    return {
      moved: false,
      arrived: false,
    };
  }

  const nextHex = unit.plannedPath[0];

  const previousPosition = {
    column: unit.column,
    row: unit.row,
  };

  /*
   * 이동 전에 차체 방향을 다음 칸 방향으로 변경한다.
   * 현재 프로토타입에서는 회전과 이동이 같은 턴에 처리된다.
   */
  unit.hullDirection = calculateDirection(
    previousPosition,
    nextHex,
    hexToWorld,
  );

  /*
   * 기존 코드와의 임시 호환성.
   * app.js가 direction을 참조해도 같은 방향을 표시한다.
   */
  unit.direction = unit.hullDirection;

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
  }

  return {
    moved: true,
    arrived,
    previousPosition,
    currentPosition: {
      column: unit.column,
      row: unit.row,
    },
  };
}
