// src/engine/turretControl.js — 전체 교체, 1~407행

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
    movingTrackingFactor: 0.8,
    movingFirePenalty: 0.35,
  },

  [TURRET_MODES.MANUAL]: {
    traverseSpeed: Math.PI / 18,
    stabilizerAvailable: false,
    movingTrackingFactor: 0.35,
    movingFirePenalty: 0.65,
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

function createIdleAction() {
  return {
    type: "idle",
    targetHex: null,
    targetUnitId: null,
    direction: null,
    crewRole: null,
    startedTurn: null,
    persistent: true,
  };
}

function stopTurretTracking(unit) {
  if (
    unit.action?.type ===
      "recon-by-fire" ||
    unit.action?.type ===
      "fire"
  ) {
    unit.action =
      createIdleAction();
  }

  if (!unit.fireControl) {
    return;
  }

  unit.fireControl.state =
    "stopped";

  unit.fireControl.targetHex =
    null;

  unit.fireControl.targetUnitId =
    null;

  unit.fireControl.gunnerAutonomous =
    false;

  unit.fireControl.loading =
    false;
}

export function createTurretControl(
  unitData,
) {
  const mode =
    unitData.turretControl?.mode ??
    TURRET_MODES.NORMAL;

  const settings =
    TURRET_MODE_SETTINGS[mode];

  const hullDirection =
    unitData.hullDirection ??
    0;

  const initialDirection =
    unitData.turretDirection ??
    hullDirection;

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

    lastHullDirection:
      unitData.turretControl
        ?.lastHullDirection ??
      hullDirection,

    aligned: true,
    rotating: false,
    hullCoupled: false,
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
    unit.destroyed ||
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

  const control =
    unit.turretControl;

  control.mode = mode;

  control.traverseSpeed =
    settings.traverseSpeed;

  control.movingTrackingFactor =
    settings.movingTrackingFactor;

  control.movingFirePenalty =
    settings.movingFirePenalty;

  control.lastHullDirection =
    unit.hullDirection ??
    control.lastHullDirection ??
    0;

  control.warning = null;

  if (
    mode === TURRET_MODES.NORMAL &&
    !control.driveOperational
  ) {
    control.warning =
      "포탑 구동장치 고장";
  }

  if (
    mode === TURRET_MODES.EMERGENCY &&
    control.stabilizerOperational
  ) {
    control.warning =
      "안정화장치 정상 상태에서 비상구동 선택";
  }

  if (
    mode === TURRET_MODES.MANUAL
  ) {
    control.warning =
      "수동구동: 회전속도와 조준성능 감소";
  }

  updateAimStability(
    unit,
    false,
  );

  return {
    success: true,
    warning:
      control.warning,
  };
}

export function setTurretTargetDirection(
  unit,
  direction,
) {
  if (
    unit.destroyed ||
    !unit.turretControl ||
    !Number.isFinite(direction)
  ) {
    return false;
  }

  const control =
    unit.turretControl;

  control.targetDirection =
    normalizeAngle(direction);

  control.aligned =
    isTurretAligned(unit);

  control.rotating =
    !control.aligned;

  return true;
}

export function unlockTurretFromHull(
  unit,
) {
  if (
    unit.destroyed ||
    !unit.turretControl
  ) {
    return false;
  }

  unit.turretControl.lockedToHull =
    false;

  return true;
}

export function commandMainGunStow(
  unit,
  turn = 1,
) {
  if (
    unit.destroyed ||
    !unit.turretControl
  ) {
    return {
      success: false,
      reason:
        "포탑 제어 기능이 없습니다.",
    };
  }

  stopTurretTracking(unit);

  const control =
    unit.turretControl;

  control.lockedToHull = true;

  control.targetDirection =
    normalizeAngle(
      unit.hullDirection ?? 0,
    );

  control.aligned =
    isTurretAligned(unit);

  control.rotating =
    !control.aligned;

  unit.action = {
    type: "turret-stow",
    targetHex: null,
    targetUnitId: null,
    direction:
      control.targetDirection,
    crewRole: null,
    startedTurn: turn,
    persistent: true,
  };

  unit.command =
    "주포 정위치";

  return {
    success: true,
    completed:
      control.aligned,
  };
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

  const control =
    unit.turretControl;

  return (
    control.mode ===
      TURRET_MODES.NORMAL &&
    control.driveOperational &&
    control.stabilizerOperational
  );
}

function applyHullCoupling(unit) {
  const control =
    unit.turretControl;

  const hullDirection =
    normalizeAngle(
      unit.hullDirection ?? 0,
    );

  const previousHullDirection =
    normalizeAngle(
      control.lastHullDirection ??
      hullDirection,
    );

  const hullChange =
    getAngleDifference(
      previousHullDirection,
      hullDirection,
    );

  control.lastHullDirection =
    hullDirection;

  if (
    isStabilizerAvailable(unit) ||
    Math.abs(hullChange) <
      Number.EPSILON
  ) {
    control.hullCoupled = false;
    return false;
  }

  unit.turretDirection =
    normalizeAngle(
      (
        unit.turretDirection ??
        hullDirection
      ) + hullChange,
    );

  control.hullCoupled = true;

  return true;
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

  let step =
    control.traverseSpeed;

  if (moving) {
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

  const control =
    unit.turretControl;

  if (
    control.mode ===
    TURRET_MODES.NORMAL
  ) {
    unit.fireControl.aimStability =
      isStabilizerAvailable(unit)
        ? 1
        : moving
          ? 0.6
          : 0.82;

    return;
  }

  if (
    control.mode ===
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
      ? 0.22
      : 0.4;
}

export function updateTurretRotation(
  unit,
  options = {},
) {
  if (
    unit.destroyed ||
    !unit.turretControl
  ) {
    return {
      rotated: false,
      aligned:
        !unit.turretControl,
      blocked:
        unit.destroyed === true,
      hullCoupled: false,
    };
  }

  const moving =
    options.moving === true;

  const control =
    unit.turretControl;

  const previousDirection =
    unit.turretDirection ??
    unit.hullDirection ??
    0;

  const hullCoupled =
    applyHullCoupling(unit);

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
      rotated:
        previousDirection !==
        unit.turretDirection,

      aligned:
        control.aligned,

      blocked: true,
      hullCoupled,
    };
  }

  unit.turretDirection =
    moveAngleToward(
      unit.turretDirection ??
        previousDirection,

      control.targetDirection,
      step,
    );

  control.aligned =
    isTurretAligned(unit);

  control.rotating =
    !control.aligned;

  if (
    control.lockedToHull &&
    control.aligned
  ) {
    unit.command =
      "주포 정위치";
  }

  updateAimStability(
    unit,
    moving,
  );

  return {
    rotated:
      previousDirection !==
      unit.turretDirection,

    aligned:
      control.aligned,

    blocked: false,
    hullCoupled,
  };
}

export function canTurretFire(
  unit,
  options = {},
) {
  if (unit.destroyed) {
    return {
      allowed: false,
      reason:
        "격파된 객체는 사격할 수 없습니다.",
    };
  }

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

  if (!isTurretAligned(unit)) {
    return {
      allowed: false,
      reason: "포탑 정렬 중",
    };
  }

  const control =
    unit.turretControl;

  if (
    control.mode ===
      TURRET_MODES.NORMAL &&
    !control.driveOperational
  ) {
    return {
      allowed: false,
      reason:
        "포탑 구동장치가 작동하지 않습니다.",
    };
  }

  updateAimStability(
    unit,
    options.moving === true,
  );

  return {
    allowed: true,
    reason: null,

    aimStability:
      unit.fireControl
        .aimStability,

    movingFirePenalty:
      options.moving === true
        ? control.movingFirePenalty
        : 0,
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
