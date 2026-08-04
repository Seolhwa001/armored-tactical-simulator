// src/engine/turretControl.js — 새 파일

export const TURRET_MODES = Object.freeze({
  NORMAL: "normal",
  EMERGENCY: "emergency",
  MANUAL: "manual",
});

export const TURRET_MODE_SETTINGS = Object.freeze({
  [TURRET_MODES.NORMAL]: {
    traverseSpeed: Math.PI / 6,
    stabilizerAvailable: true,
    movingTrackingFactor: 1,
    movingFirePenalty: 0,
  },

  [TURRET_MODES.EMERGENCY]: {
    traverseSpeed: Math.PI / 4,
    stabilizerAvailable: false,
    movingTrackingFactor: 0.55,
    movingFirePenalty: 0.35,
  },

  [TURRET_MODES.MANUAL]: {
    traverseSpeed: Math.PI / 18,
    stabilizerAvailable: false,
    movingTrackingFactor: 0,
    movingFirePenalty: 1,
  },
});

const ALIGNMENT_TOLERANCE =
  Math.PI / 36;

function normalizeAngle(angle) {
  let normalized =
    angle % (Math.PI * 2);

  if (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }

  if (normalized < -Math.PI) {
    normalized += Math.PI * 2;
  }

  return normalized;
}

function getAngleDifference(
  current,
  target,
) {
  return normalizeAngle(
    target - current,
  );
}

function moveAngleToward(
  current,
  target,
  maximumStep,
) {
  const difference =
    getAngleDifference(
      current,
      target,
    );

  if (
    Math.abs(difference) <=
    maximumStep
  ) {
    return normalizeAngle(target);
  }

  return normalizeAngle(
    current +
      Math.sign(difference) *
        maximumStep,
  );
}

export function createTurretControl(
  unitData,
) {
  const mode =
    unitData.turretControl?.mode ??
    TURRET_MODES.NORMAL;

  const settings =
    TURRET_MODE_SETTINGS[mode];

  const initialDirection =
    unitData.turretDirection ??
    unitData.hullDirection ??
    0;

  return {
    mode,

    driveOperational:
      unitData.turretControl
        ?.driveOperational ??
      true,

    stabilizerOperational:
      unitData.turretControl
        ?.stabilizerOperational ??
      true,

    targetDirection:
      unitData.turretControl
        ?.targetDirection ??
      initialDirection,

    traverseSpeed:
      unitData.turretControl
        ?.traverseSpeed ??
      settings.traverseSpeed,

    lockedToHull:
      unitData.turretControl
        ?.lockedToHull ??
      false,

    aligned: true,
    rotating: false,
    warning: null,

    movingTrackingFactor:
      settings.movingTrackingFactor,

    movingFirePenalty:
      settings.movingFirePenalty,
  };
}

export function setTurretMode(
  unit,
  mode,
) {
  if (
    !unit.turretControl ||
    !TURRET_MODE_SETTINGS[mode]
  ) {
    return {
      success: false,
      reason:
        "포탑 구동 모드를 변경할 수 없습니다.",
    };
  }

  const settings =
    TURRET_MODE_SETTINGS[mode];

  unit.turretControl.mode =
    mode;

  unit.turretControl.traverseSpeed =
    settings.traverseSpeed;

  unit.turretControl
    .movingTrackingFactor =
    settings.movingTrackingFactor;

  unit.turretControl
    .movingFirePenalty =
    settings.movingFirePenalty;

  unit.turretControl.warning =
    null;

  if (
    mode === TURRET_MODES.NORMAL &&
    !unit.turretControl
      .driveOperational
  ) {
    unit.turretControl.warning =
      "포탑 구동장치 고장";
  }

  if (
    mode ===
      TURRET_MODES.EMERGENCY &&
    unit.turretControl
      .stabilizerOperational
  ) {
    unit.turretControl.warning =
      "안정화장치 정상 상태에서 비상구동 선택";
  }

  if (
    mode === TURRET_MODES.MANUAL
  ) {
    unit.turretControl.warning =
      "수동구동: 정지 상태에서만 포탑 회전 및 사격 가능";
  }

  updateAimStability(
    unit,
    false,
  );

  return {
    success: true,
    warning:
      unit.turretControl.warning,
  };
}

export function setTurretTargetDirection(
  unit,
  direction,
) {
  if (
    !unit.turretControl ||
    !Number.isFinite(direction)
  ) {
    return false;
  }

  unit.turretControl.targetDirection =
    normalizeAngle(direction);

  unit.turretControl.aligned =
    isTurretAligned(unit);

  unit.turretControl.rotating =
    !unit.turretControl.aligned;

  return true;
}

export function unlockTurretFromHull(
  unit,
) {
  if (!unit.turretControl) {
    return false;
  }

  unit.turretControl.lockedToHull =
    false;

  return true;
}

export function lockTurretToHull(
  unit,
) {
  if (!unit.turretControl) {
    return false;
  }

  unit.turretControl.lockedToHull =
    true;

  unit.turretControl.targetDirection =
    normalizeAngle(
      unit.hullDirection ?? 0,
    );

  unit.turretControl.aligned =
    isTurretAligned(unit);

  unit.turretControl.rotating =
    !unit.turretControl.aligned;

  return true;
}

export function isTurretAligned(
  unit,
  tolerance =
    ALIGNMENT_TOLERANCE,
) {
  if (!unit.turretControl) {
    return true;
  }

  const difference =
    Math.abs(
      getAngleDifference(
        unit.turretDirection ?? 0,
        unit.turretControl
          .targetDirection ??
          unit.turretDirection ??
          0,
      ),
    );

  return difference <= tolerance;
}

export function isStabilizerAvailable(
  unit,
) {
  if (!unit.turretControl) {
    return false;
  }

  return (
    unit.turretControl.mode ===
      TURRET_MODES.NORMAL &&
    unit.turretControl
      .driveOperational &&
    unit.turretControl
      .stabilizerOperational
  );
}

function getTraverseStep(
  unit,
  moving,
) {
  const control =
    unit.turretControl;

  if (!control) {
    return 0;
  }

  if (
    control.mode ===
      TURRET_MODES.NORMAL &&
    !control.driveOperational
  ) {
    return 0;
  }

  if (
    control.mode ===
      TURRET_MODES.MANUAL &&
    moving
  ) {
    return 0;
  }

  let step =
    control.traverseSpeed;

  if (
    moving &&
    control.mode ===
      TURRET_MODES.EMERGENCY
  ) {
    step *=
      control.movingTrackingFactor;
  }

  return Math.max(0, step);
}

function updateAimStability(
  unit,
  moving,
) {
  if (
    !unit.fireControl ||
    !unit.turretControl
  ) {
    return;
  }

  const mode =
    unit.turretControl.mode;

  if (
    mode === TURRET_MODES.NORMAL
  ) {
    unit.fireControl.aimStability =
      isStabilizerAvailable(unit)
        ? 1
        : moving
          ? 0.65
          : 0.85;

    return;
  }

  if (
    mode ===
    TURRET_MODES.EMERGENCY
  ) {
    unit.fireControl.aimStability =
      moving
        ? 0.45
        : 0.72;

    return;
  }

  unit.fireControl.aimStability =
    moving
      ? 0
      : 0.4;
}

export function updateTurretRotation(
  unit,
  options = {},
) {
  if (!unit.turretControl) {
    return {
      rotated: false,
      aligned: true,
    };
  }

  const moving =
    options.moving === true;

  const control =
    unit.turretControl;

  if (control.lockedToHull) {
    control.targetDirection =
      normalizeAngle(
        unit.hullDirection ?? 0,
      );
  }

  const step =
    getTraverseStep(
      unit,
      moving,
    );

  if (step <= 0) {
    control.aligned =
      isTurretAligned(unit);

    control.rotating =
      !control.aligned;

    updateAimStability(
      unit,
      moving,
    );

    return {
      rotated: false,
      aligned: control.aligned,
      blocked: true,
    };
  }

  const previousDirection =
    unit.turretDirection ?? 0;

  unit.turretDirection =
    moveAngleToward(
      previousDirection,
      control.targetDirection,
      step,
    );

  control.aligned =
    isTurretAligned(unit);

  control.rotating =
    !control.aligned;

  updateAimStability(
    unit,
    moving,
  );

  return {
    rotated:
      previousDirection !==
      unit.turretDirection,

    aligned: control.aligned,
    blocked: false,
  };
}

export function canTurretFire(
  unit,
  options = {},
) {
  if (
    !unit.fireControl ||
    !unit.turretControl
  ) {
    return {
      allowed: false,
      reason:
        "사격 기능이 없습니다.",
    };
  }

  const moving =
    options.moving === true;

  if (
    unit.turretControl.mode ===
      TURRET_MODES.MANUAL &&
    moving
  ) {
    return {
      allowed: false,
      reason:
        "수동구동 중에는 이동 중 사격할 수 없습니다.",
    };
  }

  if (!isTurretAligned(unit)) {
    return {
      allowed: false,
      reason: "포탑 정렬 중",
    };
  }

  if (
    unit.turretControl.mode ===
      TURRET_MODES.NORMAL &&
    !unit.turretControl
      .driveOperational
  ) {
    return {
      allowed: false,
      reason:
        "포탑 구동장치가 작동하지 않습니다.",
    };
  }

  return {
    allowed: true,
    reason: null,

    aimStability:
      unit.fireControl.aimStability,
  };
}

export function getTurretStatus(
  unit,
) {
  if (!unit.turretControl) {
    return null;
  }

  return {
    ...unit.turretControl,

    aligned:
      isTurretAligned(unit),

    stabilizerAvailable:
      isStabilizerAvailable(unit),
  };
}
