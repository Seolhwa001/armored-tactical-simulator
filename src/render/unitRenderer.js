// ============================================================
// ATS PROJECT
// File      : src/render/unitRenderer.js
// Sprint    : 3.9.1
// Revision  : R12
// Build     : 2026-08-06
// Type      : PATCHED FULL REPLACEMENT
// Purpose   : Unit rendering with separate control and debug selections
// ============================================================

import {
  UNIT_ACTIONS,
} from "../engine/constants/actionConstants.js";

import {
  CREW_ROLES,
} from "../engine/runtime/runtimeConstants.js";

import {
  DETECTION_STAGES,
  getObservationVisualRange,
  isUnitVisible,
} from "../engine/detection.js";

import {
  calculateViewHexes,
  toHexKey,
} from "../engine/view.js";

const DEFAULT_VISUAL_RANGE =
  7;

const CREW_OBSERVATION_STYLES =
  Object.freeze({
    [CREW_ROLES.COMMANDER]: {
      label: "전차장",
      stroke:
        "rgba(255, 218, 128, 0.9)",

      fill:
        "rgba(255, 218, 128, 0.11)",
    },

    [CREW_ROLES.GUNNER]: {
      label: "포수",
      stroke:
        "rgba(128, 194, 255, 0.9)",

      fill:
        "rgba(128, 194, 255, 0.11)",
    },

    [CREW_ROLES.DRIVER]: {
      label: "조종수",
      stroke:
        "rgba(153, 221, 161, 0.9)",

      fill:
        "rgba(153, 221, 161, 0.11)",
    },

    [CREW_ROLES.LOADER]: {
      label: "탄약수",
      stroke:
        "rgba(211, 165, 255, 0.9)",

      fill:
        "rgba(211, 165, 255, 0.11)",
    },
  });

function finiteOrDefault(
  value,
  fallback,
) {
  return Number.isFinite(value)
    ? value
    : fallback;
}

function nonNegativeOrDefault(
  value,
  fallback,
) {
  return Math.max(
    0,
    finiteOrDefault(
      value,
      fallback,
    ),
  );
}

function clamp(
  value,
  minimum,
  maximum,
) {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value,
    ),
  );
}

function getBaseVisualRange(unit) {
  const visualRange =
    unit.sensors?.visualRange;

  if (
    Number.isFinite(visualRange) &&
    visualRange > 0
  ) {
    return visualRange;
  }

  if (
    Number.isFinite(
      unit.detectionRange,
    ) &&
    unit.detectionRange > 0
  ) {
    return unit.detectionRange;
  }

  const legacyRange =
    unit.sensors
      ?.directionalObservation;

  if (
    Number.isFinite(legacyRange) &&
    legacyRange > 0
  ) {
    return legacyRange / 10;
  }

  return DEFAULT_VISUAL_RANGE;
}

function getObserverRadius(
  unit,
  observer,
  hexRadius,
  role = null,
) {
  return (
    hexRadius *
    nonNegativeOrDefault(
      observer.range,
      getObservationVisualRange(
        unit,
        {
          role,
        },
      ),
    )
  );
}

function getDetectionConfidence(unit) {
  if (
    !Number.isFinite(
      unit.detectionConfidence,
    )
  ) {
    return 0;
  }

  return clamp(
    unit.detectionConfidence,
    0,
    100,
  );
}

function getDetectionRenderAlpha(
  unit,
  developerMode,
) {
  if (
    unit.side !== "enemy" ||
    developerMode ||
    unit.destroyed
  ) {
    return 1;
  }

  const confidence =
    getDetectionConfidence(unit);

  if (
    unit.detectionStage >=
    DETECTION_STAGES.IDENTIFIED
  ) {
    return 1;
  }

  if (
    unit.detectionStage >=
    DETECTION_STAGES.DETECTED
  ) {
    return clamp(
      0.55 +
        confidence / 220,
      0.68,
      0.9,
    );
  }

  if (
    unit.detectionStage >=
    DETECTION_STAGES.CONTACT
  ) {
    return clamp(
      0.3 +
        confidence / 180,
      0.42,
      0.68,
    );
  }

  return 0;
}

function drawSelection(
  context,
  point,
) {
  context.save();

  context.beginPath();

  context.arc(
    point.x,
    point.y,
    25,
    0,
    Math.PI * 2,
  );

  context.fillStyle =
    "rgba(198, 225, 181, 0.2)";

  context.fill();

  context.strokeStyle =
    "#c5dfb5";

  context.lineWidth =
    2;

  context.stroke();
  context.restore();
}

function drawDebugSelection(
  context,
  point,
) {
  const outerSize =
    35;

  const cornerLength =
    10;

  context.save();

  context.strokeStyle =
    "#66e0ff";

  context.lineWidth =
    2;

  context.setLineDash(
    [5, 4],
  );

  context.beginPath();

  context.moveTo(
    point.x - outerSize,
    point.y - outerSize +
      cornerLength,
  );

  context.lineTo(
    point.x - outerSize,
    point.y - outerSize,
  );

  context.lineTo(
    point.x - outerSize +
      cornerLength,
    point.y - outerSize,
  );

  context.moveTo(
    point.x + outerSize -
      cornerLength,
    point.y - outerSize,
  );

  context.lineTo(
    point.x + outerSize,
    point.y - outerSize,
  );

  context.lineTo(
    point.x + outerSize,
    point.y - outerSize +
      cornerLength,
  );

  context.moveTo(
    point.x + outerSize,
    point.y + outerSize -
      cornerLength,
  );

  context.lineTo(
    point.x + outerSize,
    point.y + outerSize,
  );

  context.lineTo(
    point.x + outerSize -
      cornerLength,
    point.y + outerSize,
  );

  context.moveTo(
    point.x - outerSize +
      cornerLength,
    point.y + outerSize,
  );

  context.lineTo(
    point.x - outerSize,
    point.y + outerSize,
  );

  context.lineTo(
    point.x - outerSize,
    point.y + outerSize -
      cornerLength,
  );

  context.stroke();
  context.restore();
}

function drawTankIcon(
  context,
  unit,
  point,
) {
  const destroyed =
    unit.destroyed === true;

  context.save();

  context.translate(
    point.x,
    point.y,
  );

  context.rotate(
    unit.hullDirection ??
    0,
  );

  context.globalAlpha =
    destroyed
      ? context.globalAlpha *
        0.55
      : context.globalAlpha;

  context.fillStyle =
    destroyed
      ? "#333735"
      : unit.side ===
          "friendly"
        ? "#73957e"
        : "#a35f59";

  context.strokeStyle =
    destroyed
      ? "#9b9f9c"
      : "#edf4ef";

  context.lineWidth =
    1.5;

  context.fillRect(
    -14,
    -8,
    28,
    16,
  );

  context.strokeRect(
    -14,
    -8,
    28,
    16,
  );

  context.beginPath();

  context.moveTo(
    -12,
    -11,
  );

  context.lineTo(
    12,
    -11,
  );

  context.moveTo(
    -12,
    11,
  );

  context.lineTo(
    12,
    11,
  );

  context.stroke();
  context.restore();

  context.save();

  context.translate(
    point.x,
    point.y,
  );

  context.rotate(
    unit.turretDirection ??
    unit.hullDirection ??
    0,
  );

  context.globalAlpha =
    destroyed
      ? context.globalAlpha *
        0.55
      : context.globalAlpha;

  context.fillStyle =
    destroyed
      ? "#454947"
      : unit.side ===
          "friendly"
        ? "#9ec2aa"
        : "#c98178";

  context.strokeStyle =
    destroyed
      ? "#9b9f9c"
      : "#edf4ef";

  context.lineWidth =
    1.5;

  context.beginPath();

  context.arc(
    0,
    0,
    6,
    0,
    Math.PI * 2,
  );

  context.fill();
  context.stroke();

  context.beginPath();

  context.moveTo(
    4,
    0,
  );

  context.lineTo(
    21,
    0,
  );

  context.stroke();
  context.restore();
}
function drawObserverIcon(
  context,
  unit,
  point,
) {
  context.save();

  context.translate(
    point.x,
    point.y,
  );

  context.globalAlpha =
    unit.destroyed
      ? context.globalAlpha *
        0.5
      : context.globalAlpha;

  context.fillStyle =
    unit.destroyed
      ? "#373737"
      : "#8c4f45";

  context.strokeStyle =
    unit.destroyed
      ? "#989898"
      : "#ffd2c4";

  context.lineWidth =
    2;

  context.fillRect(
    -15,
    -11,
    30,
    22,
  );

  context.strokeRect(
    -15,
    -11,
    30,
    22,
  );

  context.beginPath();

  context.arc(
    0,
    0,
    7,
    0,
    Math.PI * 2,
  );

  context.stroke();

  context.beginPath();

  context.moveTo(
    -7,
    0,
  );

  context.lineTo(
    -2,
    0,
  );

  context.moveTo(
    2,
    0,
  );

  context.lineTo(
    7,
    0,
  );

  context.stroke();

  context.beginPath();

  context.moveTo(
    -9,
    -15,
  );

  context.lineTo(
    9,
    -15,
  );

  context.moveTo(
    0,
    -15,
  );

  context.lineTo(
    0,
    -11,
  );

  context.stroke();
  context.restore();
}

function drawAtgmIcon(
  context,
  unit,
  point,
) {
  context.save();

  context.globalAlpha =
    unit.destroyed
      ? context.globalAlpha *
        0.5
      : context.globalAlpha;

  context.fillStyle =
    unit.destroyed
      ? "#373737"
      : "#9d514e";

  context.strokeStyle =
    unit.destroyed
      ? "#989898"
      : "#ffd1c6";

  context.lineWidth =
    2;

  context.beginPath();

  context.moveTo(
    point.x,
    point.y - 13,
  );

  context.lineTo(
    point.x + 13,
    point.y + 10,
  );

  context.lineTo(
    point.x - 13,
    point.y + 10,
  );

  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();

  context.moveTo(
    point.x - 8,
    point.y,
  );

  context.lineTo(
    point.x + 13,
    point.y,
  );

  context.stroke();
  context.restore();
}

function drawContactIcon(
  context,
  point,
  confidence,
) {
  const normalizedConfidence =
    clamp(
      confidence / 100,
      0,
      1,
    );

  const confidenceAlpha =
    clamp(
      0.45 +
        normalizedConfidence *
        0.45,
      0.45,
      0.9,
    );

  context.save();

  context.globalAlpha *=
    confidenceAlpha;

  context.fillStyle =
    "#d8a85f";

  context.font =
    "900 24px system-ui";

  context.textAlign =
    "center";

  context.fillText(
    "?",
    point.x,
    point.y + 8,
  );

  context.restore();
}

function drawDestroyedMarker(
  context,
  point,
) {
  context.save();

  context.strokeStyle =
    "#ff8d7f";

  context.lineWidth =
    3;

  context.beginPath();

  context.moveTo(
    point.x - 15,
    point.y - 15,
  );

  context.lineTo(
    point.x + 15,
    point.y + 15,
  );

  context.moveTo(
    point.x + 15,
    point.y - 15,
  );

  context.lineTo(
    point.x - 15,
    point.y + 15,
  );

  context.stroke();

  context.fillStyle =
    "rgba(28, 31, 29, 0.8)";

  context.beginPath();

  context.arc(
    point.x,
    point.y,
    5,
    0,
    Math.PI * 2,
  );

  context.fill();
  context.restore();
}

function drawUnitLabel(
  context,
  unit,
  point,
  developerMode,
) {
  context.save();

  const renderAlpha =
    getDetectionRenderAlpha(
      unit,
      developerMode,
    );

  context.globalAlpha =
    unit.destroyed
      ? 0.7
      : renderAlpha;

  context.fillStyle =
    unit.destroyed
      ? "#b7b7b7"
      : unit.side ===
          "friendly"
        ? "#edf4ef"
        : "#ffd2c8";

  context.font =
    "800 10px system-ui";

  context.textAlign =
    "center";

  const unidentifiedEnemy =
    unit.side === "enemy" &&
    !developerMode &&
    (
      unit.detectionStage ??
      DETECTION_STAGES.HIDDEN
    ) <
      DETECTION_STAGES.IDENTIFIED;

  const baseLabel =
    unidentifiedEnemy
      ? "미확인"
      : (
          unit.name ??
          unit.id
        );

  const label =
    unit.destroyed
      ? `${baseLabel} [격파]`
      : baseLabel;

  context.fillText(
    label,
    point.x,
    point.y + 33,
  );

  context.restore();
}

function canDisplayHealth(
  unit,
  developerMode,
) {
  if (
    !unit.health ||
    unit.destroyed
  ) {
    return false;
  }

  if (
    unit.side === "friendly" ||
    developerMode
  ) {
    return true;
  }

  return (
    unit.detectionStage >=
    DETECTION_STAGES.IDENTIFIED
  );
}

function drawHealthBar(
  context,
  unit,
  point,
  developerMode,
) {
  if (
    !canDisplayHealth(
      unit,
      developerMode,
    )
  ) {
    return;
  }

  const maximumHealth =
    Math.max(
      1,
      unit.health.maximum ??
      1,
    );

  const currentHealth =
    clamp(
      unit.health.current ??
      maximumHealth,
      0,
      maximumHealth,
    );

  const healthRatio =
    currentHealth /
    maximumHealth;

  const width =
    30;

  const height =
    4;

  context.save();

  context.fillStyle =
    "rgba(11, 14, 12, 0.85)";

  context.fillRect(
    point.x - width / 2,
    point.y + 18,
    width,
    height,
  );

  context.fillStyle =
    healthRatio > 0.5
      ? "#88c795"
      : healthRatio > 0.25
        ? "#d4b468"
        : "#d56f65";

  context.fillRect(
    point.x - width / 2,
    point.y + 18,
    width * healthRatio,
    height,
  );

  context.strokeStyle =
    "rgba(235, 242, 237, 0.65)";

  context.lineWidth =
    1;

  context.strokeRect(
    point.x - width / 2,
    point.y + 18,
    width,
    height,
  );

  context.restore();
}

function getHexCorners(point, hexRadius) {
  const corners = [];

  for (let index = 0; index < 6; index += 1) {
    const angle = Math.PI / 180 * (60 * index - 30);
    corners.push({
      x: point.x + hexRadius * Math.cos(angle),
      y: point.y + hexRadius * Math.sin(angle),
    });
  }

  return corners;
}

const HEX_NEIGHBOR_OFFSETS = Object.freeze({
  even: Object.freeze([
    [0, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1],
  ]),
  odd: Object.freeze([
    [1, -1], [1, 0], [1, 1], [0, 1], [-1, 0], [0, -1],
  ]),
});

function drawHexViewArea({
  context,
  viewHexes,
  hexToWorld,
  hexRadius,
  strokeStyle,
  fillStyle,
}) {
  if (!(viewHexes instanceof Set) || viewHexes.size === 0) {
    return;
  }

  context.save();
  context.fillStyle = fillStyle;
  context.strokeStyle = strokeStyle;
  context.lineWidth = 2;
  context.lineJoin = "round";

  viewHexes.forEach((key) => {
    const [column, row] = key.split(",").map(Number);
    const point = hexToWorld(column, row);
    const corners = getHexCorners(point, hexRadius);

    context.beginPath();
    corners.forEach((corner, index) => {
      if (index === 0) {
        context.moveTo(corner.x, corner.y);
      } else {
        context.lineTo(corner.x, corner.y);
      }
    });
    context.closePath();
    context.fill();

    const offsets = row % 2 === 0
      ? HEX_NEIGHBOR_OFFSETS.even
      : HEX_NEIGHBOR_OFFSETS.odd;

    offsets.forEach(([columnOffset, rowOffset], side) => {
      const neighborKey = toHexKey(column + columnOffset, row + rowOffset);
      if (viewHexes.has(neighborKey)) {
        return;
      }

      const first = corners[side];
      const second = corners[(side + 1) % 6];
      context.beginPath();
      context.moveTo(first.x, first.y);
      context.lineTo(second.x, second.y);
      context.stroke();
    });
  });

  context.restore();
}

function buildObserverView(unit, observer, role, terrain, smokeAreas) {
  return calculateViewHexes({
    origin: {
      column: unit.column,
      row: unit.row,
    },
    direction: observer.direction,
    fieldOfView: finiteOrDefault(observer.fieldOfView, Math.PI / 2),
    maximumRange:
      nonNegativeOrDefault(
        observer.range,
        getObservationVisualRange(unit, { role }),
      ),
    terrain,
    smokeAreas,
  });
}

function drawObservationDirectionIndicator({
  context,
  originPoint,
  direction,
  label,
  strokeStyle,
  length = 92,
}) {
  if (
    !originPoint ||
    !Number.isFinite(direction)
  ) {
    return;
  }

  const start = {
    x:
      originPoint.x,

    y:
      originPoint.y,
  };

  const end = {
    x:
      start.x +
      Math.cos(direction) * length,

    y:
      start.y +
      Math.sin(direction) * length,
  };

  context.save();

  context.strokeStyle =
    strokeStyle;

  context.fillStyle =
    strokeStyle;

  context.lineWidth =
    3;

  context.beginPath();
  context.moveTo(
    start.x,
    start.y,
  );
  context.lineTo(
    end.x,
    end.y,
  );
  context.stroke();

  const arrowSize = 7;
  const leftAngle =
    direction +
    Math.PI * 0.82;
  const rightAngle =
    direction -
    Math.PI * 0.82;

  context.beginPath();
  context.moveTo(
    end.x,
    end.y,
  );
  context.lineTo(
    end.x +
      Math.cos(leftAngle) *
      arrowSize,
    end.y +
      Math.sin(leftAngle) *
      arrowSize,
  );
  context.lineTo(
    end.x +
      Math.cos(rightAngle) *
      arrowSize,
    end.y +
      Math.sin(rightAngle) *
      arrowSize,
  );
  context.closePath();
  context.fill();

  context.font =
    "600 11px system-ui, sans-serif";

  context.textAlign =
    "center";

  context.textBaseline =
    "middle";

  context.lineWidth =
    4;

  context.strokeStyle =
    "rgba(10, 14, 12, 0.9)";

  const labelY =
    end.y - 16;

  const labelWidth =
    Math.max(
      34,
      context.measureText(label).width +
      12,
    );

  context.fillStyle =
    "rgba(8, 12, 10, 0.82)";

  context.fillRect(
    end.x - labelWidth / 2,
    labelY - 9,
    labelWidth,
    18,
  );

  context.strokeText(
    label,
    end.x,
    labelY,
  );

  context.fillStyle =
    strokeStyle;

  context.fillText(
    label,
    end.x,
    labelY,
  );

  context.restore();
}

function drawCrewObservationAreas(
  context,
  unit,
  point,
  hexRadius,
  hexToWorld,
  terrain,
  smokeAreas,
  {
    drawView = true,
    drawDirection = true,
  } = {},
) {
  if (
    unit.side !== "friendly" ||
    unit.destroyed ||
    !unit.crewObservation ||
    !(terrain instanceof Map)
  ) {
    return;
  }

  const observers = unit.crewObservation.observers ?? {};

  Object.entries(observers).forEach(([crewRole, observer]) => {
    const style = CREW_OBSERVATION_STYLES[crewRole];

    if (
      !style ||
      !observer ||
      observer.enabled === false ||
      !Number.isFinite(observer.direction)
    ) {
      return;
    }

    if (
      drawView &&
      observer.observing === true
    ) {
      drawHexViewArea({
        context,
        viewHexes: buildObserverView(
          unit,
          observer,
          crewRole,
          terrain,
          smokeAreas,
        ),
        hexToWorld,
        hexRadius,
        strokeStyle: style.stroke,
        fillStyle: style.fill,
      });
    }

    if (drawDirection) {
      const roleLengths = {
        [CREW_ROLES.COMMANDER]: 82,
        [CREW_ROLES.GUNNER]: 98,
        [CREW_ROLES.LOADER]: 114,
        [CREW_ROLES.DRIVER]: 130,
      };

      drawObservationDirectionIndicator({
        context,
        originPoint: point,
        direction:
          observer.direction,
        label:
          style.label ??
          crewRole,
        strokeStyle:
          style.stroke,
        length:
          roleLengths[crewRole] ?? 92,
      });
    }
  });
}

function isCpsDisplayActive(unit) {
  const sight = unit.crewObservation?.commanderIndependentSight;

  return (
    unit.side === "friendly" &&
    !unit.destroyed &&
    sight?.operational === true &&
    sight.active === true &&
    Number.isFinite(sight.direction)
  );
}

function drawCpsObservationArea(
  context,
  unit,
  hexRadius,
  hexToWorld,
  terrain,
  smokeAreas,
  {
    drawView = true,
    drawDirection = true,
  } = {},
) {
  if (!isCpsDisplayActive(unit) || !(terrain instanceof Map)) {
    return;
  }

  const sight = unit.crewObservation.commanderIndependentSight;
  const viewHexes = calculateViewHexes({
    origin: {
      column: unit.column,
      row: unit.row,
    },
    direction: sight.direction,
    fieldOfView: finiteOrDefault(sight.fieldOfView, Math.PI / 3),
    maximumRange:
      nonNegativeOrDefault(
        sight.range,
        getObservationVisualRange(
          unit,
          { role: "commander-cps" },
        ),
      ),
    terrain,
    smokeAreas,
  });

  if (drawView) {
    drawHexViewArea({
      context,
      viewHexes,
      hexToWorld,
      hexRadius,
      strokeStyle: "rgba(255, 240, 145, 0.95)",
      fillStyle: "rgba(255, 240, 145, 0.11)",
    });
  }

  if (drawDirection) {
    const originPoint =
      hexToWorld(
        unit.column,
        unit.row,
      );

    drawObservationDirectionIndicator({
      context,
      originPoint,
      direction:
        sight.direction,
      label:
        "CPS",
      strokeStyle:
        "rgba(255, 240, 145, 0.95)",
      length:
        146,
    });
  }
}

function drawObservationAreas(
  context,
  unit,
  point,
  hexRadius,
  hexToWorld,
  terrain,
  smokeAreas,
  options = {},
) {
  if (
    unit.side !== "friendly" ||
    unit.destroyed
  ) {
    return;
  }

  drawCrewObservationAreas(
    context,
    unit,
    point,
    hexRadius,
    hexToWorld,
    terrain,
    smokeAreas,
    options,
  );

  drawCpsObservationArea(
    context,
    unit,
    hexRadius,
    hexToWorld,
    terrain,
    smokeAreas,
    options,
  );
}

function drawTurretDirections(
  context,
  unit,
  point,
) {
  if (
    !unit.turretControl ||
    unit.side !== "friendly" ||
    unit.destroyed
  ) {
    return;
  }

  const currentDirection =
    unit.turretDirection ??
    0;

  const targetDirection =
    unit.turretControl
      .targetDirection ??
    currentDirection;

  context.save();

  context.lineWidth =
    2;

  context.strokeStyle =
    "#a9d5ff";

  context.beginPath();

  context.moveTo(
    point.x,
    point.y,
  );

  context.lineTo(
    point.x +
      Math.cos(
        currentDirection,
      ) *
      52,

    point.y +
      Math.sin(
        currentDirection,
      ) *
      52,
  );

  context.stroke();

  context.strokeStyle =
    "#ffd078";

  context.setLineDash(
    [5, 4],
  );

  context.beginPath();

  context.moveTo(
    point.x,
    point.y,
  );

  context.lineTo(
    point.x +
      Math.cos(
        targetDirection,
      ) *
      68,

    point.y +
      Math.sin(
        targetDirection,
      ) *
      68,
  );

  context.stroke();
  context.restore();
}
function drawDestination(
  context,
  unit,
  hexToWorld,
) {
  if (
    unit.side !== "friendly" ||
    unit.destroyed ||
    !unit.destination ||
    !Array.isArray(
      unit.plannedPath,
    ) ||
    unit.plannedPath.length === 0
  ) {
    return;
  }

  const route = [
    {
      column:
        unit.column,

      row:
        unit.row,
    },

    ...unit.plannedPath,
  ];

  context.save();

  context.strokeStyle =
    "#d7b46a";

  context.lineWidth =
    3;

  context.setLineDash(
    [7, 5],
  );

  context.beginPath();

  route.forEach(
    (
      hex,
      index,
    ) => {
      const point =
        hexToWorld(
          hex.column,
          hex.row,
        );

      if (index === 0) {
        context.moveTo(
          point.x,
          point.y,
        );
      } else {
        context.lineTo(
          point.x,
          point.y,
        );
      }
    },
  );

  context.stroke();
  context.restore();
}

function drawFireTarget(
  context,
  unit,
  hexToWorld,
) {
  const target =
    unit.fireControl
      ?.targetHex;

  if (
    !target ||
    unit.destroyed
  ) {
    return;
  }

  const point =
    hexToWorld(
      target.column,
      target.row,
    );

  context.save();

  context.strokeStyle =
    "#ff9a7f";

  context.lineWidth =
    2;

  context.beginPath();

  context.arc(
    point.x,
    point.y,
    14,
    0,
    Math.PI * 2,
  );

  context.stroke();

  context.beginPath();

  context.moveTo(
    point.x - 19,
    point.y,
  );

  context.lineTo(
    point.x + 19,
    point.y,
  );

  context.moveTo(
    point.x,
    point.y - 19,
  );

  context.lineTo(
    point.x,
    point.y + 19,
  );

  context.stroke();
  context.restore();
}

function drawDetectedUnitIcon(
  context,
  unit,
  point,
  developerMode,
) {
  const renderAlpha =
    getDetectionRenderAlpha(
      unit,
      developerMode,
    );

  context.save();

  context.globalAlpha =
    renderAlpha;

  if (
    unit.side === "enemy" &&
    !developerMode &&
    unit.detectionStage ===
      DETECTION_STAGES.CONTACT &&
    !unit.destroyed
  ) {
    drawContactIcon(
      context,
      point,
      getDetectionConfidence(
        unit,
      ),
    );

    context.restore();

    return;
  }

  if (
    unit.type ===
    "artillery-observer"
  ) {
    drawObserverIcon(
      context,
      unit,
      point,
    );
  } else if (
    unit.type ===
    "atgm-team"
  ) {
    drawAtgmIcon(
      context,
      unit,
      point,
    );
  } else {
    drawTankIcon(
      context,
      unit,
      point,
    );
  }

  context.restore();
}
export function drawSelectedObservationOverlay({
  context,
  units,
  selectedUnitId,
  hexRadius,
  hexToWorld,
  bounds,
  isPointVisible,
  terrain,
  smokeAreas = [],
}) {
  const unit =
    (Array.isArray(units)
      ? units
      : []
    ).find(
      (candidate) =>
        candidate.side === "friendly" &&
        candidate.id === selectedUnitId &&
        !candidate.destroyed,
    );

  if (!unit) {
    return;
  }

  const point =
    hexToWorld(
      unit.column,
      unit.row,
    );

  if (
    !isPointVisible(
      point,
      bounds,
    )
  ) {
    return;
  }

  drawObservationAreas(
    context,
    unit,
    point,
    hexRadius,
    hexToWorld,
    terrain,
    smokeAreas,
    {
      drawView: false,
      drawDirection: true,
    },
  );
}

export function drawUnits({
  context,
  units,
  selectedUnitId,
  debugSelectedUnitId,
  developerMode,
  hexRadius,
  hexToWorld,
  bounds,
  isPointVisible,
  terrain,
  smokeAreas = [],
}) {
  const runtimeUnits =
    Array.isArray(units)
      ? units
      : [];

  runtimeUnits
    .filter(
      (unit) =>
        unit.side ===
        "friendly",
    )
    .forEach(
      (unit) => {
        drawDestination(
          context,
          unit,
          hexToWorld,
        );

        drawFireTarget(
          context,
          unit,
          hexToWorld,
        );
      },
    );

  runtimeUnits.forEach(
    (unit) => {
      if (
        !isUnitVisible(
          unit,
          developerMode,
        )
      ) {
        return;
      }

      const point =
        hexToWorld(
          unit.column,
          unit.row,
        );

      if (
        !isPointVisible(
          point,
          bounds,
        )
      ) {
        return;
      }

      if (
        unit.side === "friendly" &&
        unit.id === selectedUnitId &&
        !unit.destroyed
      ) {
        drawObservationAreas(
          context,
          unit,
          point,
          hexRadius,
          hexToWorld,
          terrain,
          smokeAreas,
          {
            drawView: true,
            drawDirection: false,
          },
        );
      }

      if (
        unit.id ===
          selectedUnitId &&
        !unit.destroyed
      ) {
        drawSelection(
          context,
          point,
        );
      }

      if (
        developerMode &&
        debugSelectedUnitId &&
        unit.id ===
          debugSelectedUnitId
      ) {
        drawDebugSelection(
          context,
          point,
        );
      }

      drawDetectedUnitIcon(
        context,
        unit,
        point,
        developerMode,
      );

      if (unit.destroyed) {
        drawDestroyedMarker(
          context,
          point,
        );
      } else {
        drawTurretDirections(
          context,
          unit,
          point,
        );

        drawHealthBar(
          context,
          unit,
          point,
          developerMode,
        );
      }

      drawUnitLabel(
        context,
        unit,
        point,
        developerMode,
      );
    },
  );
}
