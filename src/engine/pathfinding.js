/**
 * ATS A* Pathfinding
 *
 * 좌표 형식:
 * {
 *   column: number,
 *   row: number
 * }
 */

function makeKey(column, row) {
  return `${column},${row}`;
}

function reconstructPath(cameFrom, current) {
  const path = [current];

  while (cameFrom.has(makeKey(current.column, current.row))) {
    current = cameFrom.get(makeKey(current.column, current.row));
    path.push(current);
  }

  path.reverse();
  return path;
}

/**
 * 육각형 격자용 대략적인 거리 계산.
 * 홀수·짝수 행 오프셋 좌표를 큐브 좌표로 변환한다.
 */
function offsetToCube(column, row) {
  const x = column - (row - (row & 1)) / 2;
  const z = row;
  const y = -x - z;

  return { x, y, z };
}

function hexDistance(a, b) {
  const cubeA = offsetToCube(a.column, a.row);
  const cubeB = offsetToCube(b.column, b.row);

  return Math.max(
    Math.abs(cubeA.x - cubeB.x),
    Math.abs(cubeA.y - cubeB.y),
    Math.abs(cubeA.z - cubeB.z),
  );
}

function getLowestScoreNode(openSet, scoreMap) {
  let bestNode = null;
  let bestScore = Infinity;

  for (const node of openSet.values()) {
    const score =
      scoreMap.get(makeKey(node.column, node.row)) ??
      Infinity;

    if (score < bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }

  return bestNode;
}

/**
 * A* 경로탐색.
 *
 * @param {object} start 출발 좌표
 * @param {object} goal 목적지 좌표
 * @param {Function} getNeighbors 인접 좌표 반환 함수
 * @param {Function} getMovementCost 이동비용 반환 함수
 * @returns {object[]} 출발지를 제외한 이동 경로
 */
export function findPath({
  start,
  goal,
  getNeighbors,
  getMovementCost,
}) {
  if (
    start.column === goal.column &&
    start.row === goal.row
  ) {
    return [];
  }

  const startKey = makeKey(start.column, start.row);
  const goalKey = makeKey(goal.column, goal.row);

  const openSet = new Map([[startKey, start]]);
  const cameFrom = new Map();

  const gScore = new Map([[startKey, 0]]);
  const fScore = new Map([
    [startKey, hexDistance(start, goal)],
  ]);

  const closedSet = new Set();

  while (openSet.size > 0) {
    const current = getLowestScoreNode(
      openSet,
      fScore,
    );

    if (!current) {
      break;
    }

    const currentKey = makeKey(
      current.column,
      current.row,
    );

    if (currentKey === goalKey) {
      const fullPath = reconstructPath(
        cameFrom,
        current,
      );

      // 현재 위치는 제외하고 다음 이동 칸부터 반환
      return fullPath.slice(1);
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    const neighbors = getNeighbors(
      current.column,
      current.row,
    );

    for (const neighbor of neighbors) {
      const neighborKey = makeKey(
        neighbor.column,
        neighbor.row,
      );

      if (closedSet.has(neighborKey)) {
        continue;
      }

      const movementCost = getMovementCost(
        neighbor.column,
        neighbor.row,
      );

      // 하천, 절벽 등 이동 불가 지역
      if (!Number.isFinite(movementCost)) {
        continue;
      }

      const tentativeScore =
        (gScore.get(currentKey) ?? Infinity) +
        movementCost;

      const knownScore =
        gScore.get(neighborKey) ?? Infinity;

      if (tentativeScore >= knownScore) {
        continue;
      }

      cameFrom.set(neighborKey, current);
      gScore.set(neighborKey, tentativeScore);

      fScore.set(
        neighborKey,
        tentativeScore +
          hexDistance(neighbor, goal),
      );

      openSet.set(neighborKey, neighbor);
    }
  }

  // 목적지까지 갈 수 있는 경로가 없음
  return [];
}
