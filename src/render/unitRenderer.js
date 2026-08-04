// src/render/unitRenderer.js — 새 파일

import {
  DETECTION_STAGES,
  isUnitVisible,
} from "../engine/detection.js";

import {
  UNIT_ACTIONS,
} from "../engine/actions.js";

function drawSelection(
  context,
  point,
) {
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

  context.lineWidth = 2;
  context.stroke();
}

function drawTankIcon(
  context,
  unit,
  point,
) {
  context.save();

  context.translate(
    point.x,
    point.y,
  );

  context.rotate(
    unit.hullDirection ?? 0,
  );

  context.fillStyle =
    unit.side === "friendly"
      ? "#73957e"
      : "#a35f59";

  context.strokeStyle =
    "#edf4ef";

  context.lineWidth = 1.5;

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

  context.fillStyle =
    unit.side === "friendly"
      ? "#9ec2aa"
      : "#c98178";

  context.strokeStyle =
    "#edf4ef";

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

  context.moveTo(4, 0);
  context.lineTo(21, 0);
  context.stroke();

  context.restore();
}

function drawObserverIcon(
  context,
  point,
) {
  context.save();

  context.translate(
    point.x,
    point.y,
  );

  context.fillStyle =
    "#8c4f45";

  context.strokeStyle =
    "#ffd2c4";

  context.lineWidth = 2;

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

  context.moveTo(-7, 0);
  context.lineTo(-2, 0);

  context.moveTo(2, 0);
  context.lineTo(7, 0);

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
  point,
) {
  context.fillStyle =
    "#9d514e";

  context.strokeStyle =
    "#ffd1c6";

  context.lineWidth = 2;

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
}

function drawContactIcon(
  context,
  point,
) {
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
}

function drawUnitLabel(
  context,
  unit,
  point,
  developerMode,
) {
  context.fillStyle =
    unit.side === "friendly"
      ? "#edf4ef"
      : "#ffd2c8";

  context.font =
    "800 10px system-ui";

  context.textAlign =
    "center";

  const label =
    unit.side === "enemy" &&
    !developerMode &&
    !unit.identified
      ? "미확인"
      : unit.id;

  context.fillText(
    label,
    point.x,
    point.y + 31,
  );
}

function drawObservationArea(
  context,
  unit,
  point,
  hexRadius,
) {
  if (
    unit.side !== "friendly"
  ) {
    return;
  }

  if (
    unit.action?.type ===
    UNIT_ACTIONS.RECON
  ) {
    context.save();

    context.fillStyle =
      "rgba(112, 196, 151, 0.10)";

    context.strokeStyle =
      "rgba(150, 230, 184, 0.7)";

    context.lineWidth = 2;

    context.setLineDash([
      7,
      5,
    ]);

    context.beginPath();

    context.arc(
      point.x,
      point.y,
      hexRadius * 10,
      0,
      Math.PI * 2,
    );

    context.fill();
    context.stroke();
    context.restore();
  }

  if (
    unit.action?.type !==
      UNIT_ACTIONS.OBSERVE ||
    !Number.isFinite(
      unit.action.direction,
    )
  ) {
    return;
  }

  const radius =
    hexRadius * 13;

  context.save();

  context.fillStyle =
    "rgba(105, 206, 153, 0.13)";

  context.strokeStyle =
    "rgba(146, 235, 185, 0.8)";

  context.lineWidth = 2;

  context.beginPath();

  context.moveTo(
    point.x,
    point.y,
  );

  context.arc(
    point.x,
    point.y,
    radius,
    unit.action.direction -
      Math.PI / 4,
    unit.action.direction +
      Math.PI / 4,
  );

  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawTurretDirections(
  context,
  unit,
  point,
) {
  if (
    !unit.turretControl ||
    unit.side !== "friendly"
  ) {
    return;
  }

  const currentDirection =
    unit.turretDirection ?? 0;

  const targetDirection =
    unit.turretControl
      .targetDirection ??
    currentDirection;

  context.save();

  context.lineWidth = 2;

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

  context.setLineDash([
    5,
    4,
  ]);

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
      column: unit.column,
      row: unit.row,
    },
    ...unit.plannedPath,
  ];

  context.save();

  context.strokeStyle =
    "#d7b46a";

  context.lineWidth = 3;

  context.setLineDash([
    7,
    5,
  ]);

  context.beginPath();

  route.forEach(
    (hex, index) => {
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
    unit.fireControl?.targetHex;

  if (!target) {
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

  context.lineWidth = 2;

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

export function drawUnits({
  context,
  units,
  selectedUnitId,
  developerMode,
  hexRadius,
  hexToWorld,
  bounds,
  isPointVisible,
}) {
  units
    .filter(
      (unit) =>
        unit.side === "friendly",
    )
    .forEach((unit) => {
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
    });

  units.forEach((unit) => {
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

    drawObservationArea(
      context,
      unit,
      point,
      hexRadius,
    );

    if (
      unit.id ===
      selectedUnitId
    ) {
      drawSelection(
        context,
        point,
      );
    }

    if (
      unit.side === "enemy" &&
      !developerMode &&
      unit.detectionStage ===
        DETECTION_STAGES.CONTACT
    ) {
      drawContactIcon(
        context,
        point,
      );
    } else if (
      unit.type ===
      "artillery-observer"
    ) {
      drawObserverIcon(
        context,
        point,
      );
    } else if (
      unit.type ===
      "atgm-team"
    ) {
      drawAtgmIcon(
        context,
        point,
      );
    } else {
      drawTankIcon(
        context,
        unit,
        point,
      );
    }

    drawTurretDirections(
      context,
      unit,
      point,
    );

    drawUnitLabel(
      context,
      unit,
      point,
      developerMode,
    );
  });
}
