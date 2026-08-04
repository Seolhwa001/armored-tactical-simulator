// src/engine/fireControl.js — 전체 교체, 1~398행

import {
  UNIT_ACTIONS,
  clearPersistentAction,
  setPersistentAction,
} from "./actions.js";

import {
  canTurretFire,
  isTurretAligned,
  setTurretTargetDirection,
  unlockTurretFromHull,
} from "./turretControl.js";

import {
  resolveShot,
} from "./combat.js";

export const FIRE_STATES = Object.freeze({
  STOPPED: "stopped",
  READY: "ready",
  SINGLE: "single",
  ADJUST: "adjust",
});

export const FIRE_PROCEDURE_STATES = Object.freeze({
  STOPPED: "stopped",
  TARGET_DESIGNATED: "target-designated",
  FIRE_COMMAND: "fire-command",
  LOADING: "loading",
  TRAVERSING: "traversing",
  AIMING: "aiming",
  READY_TO_FIRE: "ready-to-fire",
  FIRED: "fired",
  RELOADING: "reloading",
  ADJUSTING: "adjusting",
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

function hasFireTarget(unit) {
  return Boolean(
    unit.fireControl?.targetHex,
  );
}

function setProcedureState(
  unit,
  procedureState,
  turn = null,
) {
  if (!unit.fireControl) {
    return;
  }

  unit.fireControl.procedureState =
    procedureState;

  unit.fireControl.procedureTurn =
    turn;
}

function resetLoadingState(unit) {
  const fireControl =
    unit.fireControl;

  fireControl.loading = false;
  fireControl.loaded = false;
  fireControl.loadStartedTurn = null;
  fireControl.loadedTurn = null;
}

function resetAimingState(unit) {
  const fireControl =
    unit.fireControl;

  fireControl.aiming = false;
  fireControl.aimStartedTurn = null;
}

export function createFireControl() {
  return {
    state: FIRE_STATES.STOPPED,

    procedureState:
      FIRE_PROCEDURE_STATES.STOPPED,

    procedureTurn: null,

    ammunition:
      AMMUNITION_TYPES.APFSDS,

    targetHex: null,
    targetUnitId: null,

    roundsFired: 0,
    lastFiredTurn: null,

    gunnerAutonomous: false,

    loading: false,
    loaded: false,

    loadStartedTurn: null,
    loadedTurn: null,

    aiming: false,
    aimStartedTurn: null,

    aimStability: 1,
    alignmentRequired: true,

    lastShotResult: null,
  };
}

export function setFireTarget(
  unit,
  target,
  ammunition,
  turn = null,
) {
  if (
    unit.destroyed ||
    !unit.fireControl ||
    !unit.turretControl ||
    !target
  ) {
    return false;
  }

  unlockTurretFromHull(unit);

  const fireControl =
    unit.fireControl;

  fireControl.ammunition =
    ammunition ??
    fireControl.ammunition;

  fireControl.targetHex = {
    column: target.column,
    row: target.row,
  };

  fireControl.targetUnitId =
    target.unitId ??
    null;

  fireControl.state =
    FIRE_STATES.READY;

  fireControl.gunnerAutonomous =
    false;

  fireControl.lastShotResult =
    null;

  resetLoadingState(unit);
  resetAimingState(unit);

  setProcedureState(
    unit,
    FIRE_PROCEDURE_STATES
      .TARGET_DESIGNATED,
    turn,
  );

  setTurretTargetDirection(
    unit,
    getDirectionBetween(
      unit,
      target,
    ),
  );

  unit.command = "표적 지정";

  return true;
}

export function acceptHunterKillerTarget(
  unit,
  target,
  turn,
) {
  if (
    unit.destroyed ||
    !unit.fireControl ||
    !unit.turretControl ||
    !target
  ) {
    return false;
  }

  const result =
    setFireTarget(
      unit,
      {
        column: target.column,
        row: target.row,
        unitId: target.id,
      },
      unit.fireControl.ammunition,
      turn,
    );

  if (!result) {
    return false;
  }

  unit.command =
    "표적 인계";

  return true;
}

export function issueFireCommand(
  unit,
  turn,
) {
  if (
    unit.destroyed ||
    !hasFireTarget(unit)
  ) {
    return {
      success: false,
      reason:
        "사격 목표가 지정되지 않았습니다.",
    };
  }

  if (
    unit.fireControl
      .procedureState !==
    FIRE_PROCEDURE_STATES
      .TARGET_DESIGNATED
  ) {
    return {
      success: false,
      reason:
        "표적 지정 단계가 아닙니다.",
    };
  }

  unit.fireControl.state =
    FIRE_STATES.READY;

  setProcedureState(
    unit,
    FIRE_PROCEDURE_STATES
      .FIRE_COMMAND,
    turn,
  );

  unit.command = "사격명령";

  return {
    success: true,
  };
}

export function beginLoading(
  unit,
  turn,
) {
  if (
    unit.destroyed ||
    !hasFireTarget(unit)
  ) {
    return {
      success: false,
      reason:
        "장전할 사격 목표가 없습니다.",
    };
  }

  const procedureState =
    unit.fireControl
      .procedureState;

  if (
    procedureState !==
      FIRE_PROCEDURE_STATES
        .FIRE_COMMAND &&
    procedureState !==
      FIRE_PROCEDURE_STATES.FIRED &&
    procedureState !==
      FIRE_PROCEDURE_STATES.ADJUSTING
  ) {
    return {
      success: false,
      reason:
        "현재 단계에서는 장전할 수 없습니다.",
    };
  }

  const fireControl =
    unit.fireControl;

  fireControl.loading = true;
  fireControl.loaded = false;
  fireControl.loadStartedTurn =
    turn;

  setProcedureState(
    unit,
    procedureState ===
      FIRE_PROCEDURE_STATES
        .FIRE_COMMAND
      ? FIRE_PROCEDURE_STATES.LOADING
      : FIRE_PROCEDURE_STATES.RELOADING,
    turn,
  );

  unit.command =
    procedureState ===
      FIRE_PROCEDURE_STATES
        .FIRE_COMMAND
      ? "장전"
      : "재장전";

  return {
    success: true,
  };
}

export function beginReloading(
  unit,
  turn,
) {
  return beginLoading(
    unit,
    turn,
  );
}

function completeLoading(
  unit,
  turn,
) {
  if (
    unit.destroyed ||
    !unit.fireControl?.loading
  ) {
    return {
      success: false,
      reason:
        "장전 중인 탄이 없습니다.",
    };
  }

  const fireControl =
    unit.fireControl;

  fireControl.loading = false;
  fireControl.loaded = true;
  fireControl.loadedTurn = turn;

  if (isTurretAligned(unit)) {
    fireControl.aiming = true;
    fireControl.aimStartedTurn =
      turn;

    setProcedureState(
      unit,
      FIRE_PROCEDURE_STATES.AIMING,
      turn,
    );

    unit.command = "조준";
  } else {
    resetAimingState(unit);

    setProcedureState(
      unit,
      FIRE_PROCEDURE_STATES.TRAVERSING,
      turn,
    );

    unit.command = "포탑 선회";
  }

  return {
    success: true,

    aligned:
      isTurretAligned(unit),
  };
}

export function updateFireProcedure(
  unit,
  turn,
) {
  if (
    unit.destroyed ||
    !unit.fireControl ||
    !unit.fireControl.targetHex
  ) {
    return {
      changed: false,
    };
  }

  const fireControl =
    unit.fireControl;

  if (
    (
      fireControl.procedureState ===
        FIRE_PROCEDURE_STATES.LOADING ||
      fireControl.procedureState ===
        FIRE_PROCEDURE_STATES.RELOADING
    ) &&
    fireControl.loadStartedTurn !==
      null &&
    turn >
      fireControl.loadStartedTurn
  ) {
    completeLoading(
      unit,
      turn,
    );

    return {
      changed: true,
      state:
        fireControl.procedureState,
    };
  }

  if (
    fireControl.procedureState ===
      FIRE_PROCEDURE_STATES.TRAVERSING &&
    isTurretAligned(unit)
  ) {
    fireControl.aiming = true;
    fireControl.aimStartedTurn =
      turn;

    setProcedureState(
      unit,
      FIRE_PROCEDURE_STATES.AIMING,
      turn,
    );

    unit.command = "조준";

    return {
      changed: true,
      state:
        fireControl.procedureState,
    };
  }

  if (
    fireControl.procedureState ===
      FIRE_PROCEDURE_STATES.AIMING &&
    fireControl.aimStartedTurn !==
      null &&
    turn >
      fireControl.aimStartedTurn
  ) {
    fireControl.aiming = false;

    setProcedureState(
      unit,
      FIRE_PROCEDURE_STATES
        .READY_TO_FIRE,
      turn,
    );

    unit.command = "발사 준비";

    return {
      changed: true,
      state:
        fireControl.procedureState,
    };
  }

  return {
    changed: false,
    state:
      fireControl.procedureState,
  };
}

function validateFirePermission(
  unit,
  options,
) {
  if (unit.destroyed) {
    return {
      allowed: false,
      reason:
        "격파된 객체는 사격할 수 없습니다.",
    };
  }

  if (!hasFireTarget(unit)) {
    return {
      allowed: false,
      reason:
        "사격 목표가 지정되지 않았습니다.",
    };
  }

  if (!unit.fireControl.loaded) {
    return {
      allowed: false,
      reason:
        "장전이 완료되지 않았습니다.",
    };
  }

  if (
    unit.fireControl.procedureState !==
    FIRE_PROCEDURE_STATES
      .READY_TO_FIRE
  ) {
    return {
      allowed: false,
      reason:
        "사격 절차가 완료되지 않았습니다.",
    };
  }

  return canTurretFire(
    unit,
    options,
  );
}

function registerShot(
  runtimeScenario,
  unit,
  turn,
  permission,
) {
  const fireControl =
    unit.fireControl;

  fireControl.roundsFired += 1;
  fireControl.lastFiredTurn =
    turn;

  fireControl.loaded = false;
  fireControl.loading = false;

  resetAimingState(unit);

  const shotResult =
    resolveShot(
      runtimeScenario,
      unit,
      turn,
      {
        aimStability:
          permission.aimStability,

        movingFirePenalty:
          permission
            .movingFirePenalty ??
          0,
      },
    );

  fireControl.lastShotResult =
    shotResult;

  setProcedureState(
    unit,
    FIRE_PROCEDURE_STATES.FIRED,
    turn,
  );

  return shotResult;
}

export function fireSingleShot(
  runtimeScenario,
  unit,
  turn,
  options = {},
) {
  const permission =
    validateFirePermission(
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

  unit.fireControl.gunnerAutonomous =
    false;

  const shotResult =
    registerShot(
      runtimeScenario,
      unit,
      turn,
      permission,
    );

  unit.command = "쏴";

  return {
    success: true,

    aimStability:
      permission.aimStability,

    movingFirePenalty:
      permission
        .movingFirePenalty ??
      0,

    shotResult,
  };
}

export function enableAdjustedFire(
  runtimeScenario,
  unit,
  turn,
  options = {},
) {
  const permission =
    validateFirePermission(
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

  unit.fireControl.gunnerAutonomous =
    true;

  const shotResult =
    registerShot(
      runtimeScenario,
      unit,
      turn,
      permission,
    );

  setProcedureState(
    unit,
    FIRE_PROCEDURE_STATES.ADJUSTING,
    turn,
  );

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

    movingFirePenalty:
      permission
        .movingFirePenalty ??
      0,

    shotResult,
  };
}

export function registerAdjustedShot(
  runtimeScenario,
  unit,
  turn,
  options = {},
) {
  if (
    unit.destroyed ||
    unit.fireControl?.state !==
      FIRE_STATES.ADJUST ||
    !unit.fireControl
      .gunnerAutonomous
  ) {
    return {
      success: false,
      reason:
        "포수 자율사격 상태가 아닙니다.",
    };
  }

  const permission =
    validateFirePermission(
      unit,
      options,
    );

  if (!permission.allowed) {
    return {
      success: false,
      reason: permission.reason,
    };
  }

  const shotResult =
    registerShot(
      runtimeScenario,
      unit,
      turn,
      permission,
    );

  setProcedureState(
    unit,
    FIRE_PROCEDURE_STATES.ADJUSTING,
    turn,
  );

  unit.command = "쏴-수정";

  return {
    success: true,

    aimStability:
      permission.aimStability,

    movingFirePenalty:
      permission
        .movingFirePenalty ??
      0,

    shotResult,
  };
}

export function ceaseFire(unit) {
  if (!unit.fireControl) {
    return false;
  }

  const fireControl =
    unit.fireControl;

  fireControl.state =
    FIRE_STATES.STOPPED;

  fireControl.targetHex = null;
  fireControl.targetUnitId = null;

  fireControl.gunnerAutonomous =
    false;

  resetLoadingState(unit);
  resetAimingState(unit);

  setProcedureState(
    unit,
    FIRE_PROCEDURE_STATES.STOPPED,
  );

  if (
    unit.action?.type ===
      UNIT_ACTIONS.FIRE ||
    unit.action?.type ===
      UNIT_ACTIONS.RECON_BY_FIRE
  ) {
    clearPersistentAction(unit);
  }

  if (!unit.destroyed) {
    unit.command =
      "사격 그만";
  }

  return true;
}

export function stopFireTracking(
  unit,
) {
  if (unit.fireControl) {
    ceaseFire(unit);
  }
}
