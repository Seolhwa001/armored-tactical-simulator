// src/engine/fireControl.js — 새 파일, 1~258행

import {
  UNIT_ACTIONS,
  clearPersistentAction,
  setPersistentAction,
} from "./actions.js";

import {
  canTurretFire,
  setTurretTargetDirection,
  unlockTurretFromHull,
} from "./turretControl.js";

export const FIRE_STATES = Object.freeze({
  STOPPED: "stopped",
  READY: "ready",
  SINGLE: "single",
  ADJUST: "adjust",
});

export const AMMUNITION_TYPES = Object.freeze({
  APFSDS: "apfsds",
  HEAT: "heat",
  CANISTER: "canister",
  SMOKE: "smoke",
});

function getDirectionBetween(
  observer,
  target,
) {
  return Math.atan2(
    target.row - observer.row,
    target.column - observer.column,
  );
}

export function createFireControl() {
  return {
    state: FIRE_STATES.STOPPED,

    ammunition:
      AMMUNITION_TYPES.APFSDS,

    targetHex: null,
    targetUnitId: null,

    roundsFired: 0,
    lastFiredTurn: null,

    gunnerAutonomous: false,
    loading: false,

    aimStability: 1,
    alignmentRequired: true,
  };
}

export function setFireTarget(
  unit,
  target,
  ammunition,
) {
  if (
    !unit.fireControl ||
    !unit.turretControl
  ) {
    return false;
  }

  unlockTurretFromHull(unit);

  unit.fireControl.ammunition =
    ammunition ??
    unit.fireControl.ammunition;

  unit.fireControl.targetHex =
    target
      ? {
          column: target.column,
          row: target.row,
        }
      : null;

  unit.fireControl.targetUnitId =
    target?.unitId ??
    null;

  unit.fireControl.state =
    FIRE_STATES.READY;

  unit.fireControl.loading = true;

  if (target) {
    setTurretTargetDirection(
      unit,
      getDirectionBetween(
        unit,
        target,
      ),
    );
  }

  return true;
}

export function fireSingleShot(
  unit,
  turn,
  options = {},
) {
  if (
    !unit.fireControl ||
    !unit.fireControl.targetHex
  ) {
    return {
      success: false,
      reason:
        "사격 목표가 지정되지 않았습니다.",
    };
  }

  const permission =
    canTurretFire(
      unit,
      options,
    );

  if (!permission.allowed) {
    return {
      success: false,
      reason: permission.reason,
    };
  }

  unit.fireControl.state =
    FIRE_STATES.SINGLE;

  unit.fireControl.roundsFired += 1;

  unit.fireControl.lastFiredTurn =
    turn;

  unit.fireControl.gunnerAutonomous =
    false;

  unit.fireControl.loading = true;

  unit.command = "쏴";

  return {
    success: true,

    aimStability:
      permission.aimStability,
  };
}

export function enableAdjustedFire(
  unit,
  turn,
  options = {},
) {
  if (
    !unit.fireControl ||
    !unit.fireControl.targetHex
  ) {
    return {
      success: false,
      reason:
        "사격 목표가 지정되지 않았습니다.",
    };
  }

  const permission =
    canTurretFire(
      unit,
      options,
    );

  if (!permission.allowed) {
    return {
      success: false,
      reason: permission.reason,
    };
  }

  unit.fireControl.state =
    FIRE_STATES.ADJUST;

  unit.fireControl.roundsFired += 1;

  unit.fireControl.lastFiredTurn =
    turn;

  unit.fireControl.gunnerAutonomous =
    true;

  unit.fireControl.loading = true;

  unit.command = "쏴-수정";

  unlockTurretFromHull(unit);

  setPersistentAction(
    unit,
    {
      type: UNIT_ACTIONS.FIRE,

      targetHex:
        unit.fireControl.targetHex,

      targetUnitId:
        unit.fireControl.targetUnitId,

      direction:
        getDirectionBetween(
          unit,
          unit.fireControl.targetHex,
        ),

      label: "쏴-수정",
    },
    turn,
  );

  return {
    success: true,

    aimStability:
      permission.aimStability,
  };
}

export function ceaseFire(unit) {
  if (!unit.fireControl) {
    return false;
  }

  unit.fireControl.state =
    FIRE_STATES.STOPPED;

  unit.fireControl.targetHex =
    null;

  unit.fireControl.targetUnitId =
    null;

  unit.fireControl.gunnerAutonomous =
    false;

  unit.fireControl.loading =
    false;

  if (
    unit.action?.type ===
      UNIT_ACTIONS.FIRE ||
    unit.action?.type ===
      UNIT_ACTIONS.RECON_BY_FIRE
  ) {
    clearPersistentAction(unit);
  }

  unit.command = "사격 그만";

  return true;
}

export function stopFireTracking(
  unit,
) {
  if (!unit.fireControl) {
    return;
  }

  unit.fireControl.state =
    FIRE_STATES.STOPPED;

  unit.fireControl.targetHex =
    null;

  unit.fireControl.targetUnitId =
    null;

  unit.fireControl.gunnerAutonomous =
    false;

  unit.fireControl.loading =
    false;
}

export function registerAdjustedShot(
  unit,
  turn,
  options = {},
) {
  if (
    unit.fireControl?.state !==
      FIRE_STATES.ADJUST ||
    !unit.fireControl.targetHex
  ) {
    return {
      success: false,
      reason:
        "포수 자율사격 상태가 아닙니다.",
    };
  }

  const permission =
    canTurretFire(
      unit,
      options,
    );

  if (!permission.allowed) {
    return {
      success: false,
      reason: permission.reason,
    };
  }

  unit.fireControl.roundsFired += 1;

  unit.fireControl.lastFiredTurn =
    turn;

  unit.fireControl.loading = true;

  return {
    success: true,

    aimStability:
      permission.aimStability,
  };
}
