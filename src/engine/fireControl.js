// ============================================================
// ATS PROJECT
// File      : src/engine/fireControl.js
// Sprint    : 3.9.1
// Revision  : R5
// Build     : 2026-08-05
// Type      : PARTIAL PATCH
// Purpose   : Fire procedure with explicit fire command and live target synchronization
// ============================================================

import { UNIT_ACTIONS } from "./constants/actionConstants.js";
import { createIdleAction } from "./factories/actionFactory.js";
import { getHexDirection } from "./hexGeometry.js";

import {
  canTurretFire,
  isTurretAligned,
  setTurretTargetDirection,
  unlockTurretFromHull,
} from "./turretControl.js";

import { resolveShot } from "./combat.js";

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
  return getHexDirection(
    observer,
    target,
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

function resetAimingState(unit) {
  const fireControl =
    unit.fireControl;

  fireControl.aiming =
    false;

  fireControl.aimStartedTurn =
    null;
}

function clearLoadingProgress(unit) {
  const fireControl =
    unit.fireControl;

  fireControl.loading =
    false;

  fireControl.loadingAmmunition =
    null;

  fireControl.loadStartedTurn =
    null;
}

function clearLoadedRound(unit) {
  const fireControl =
    unit.fireControl;

  fireControl.loaded =
    false;

  fireControl.loadedAmmunition =
    null;

  fireControl.loadedTurn =
    null;
}

function setAdjustedFireAction(
  unit,
  turn,
) {
  const fireControl =
    unit.fireControl;

  const targetHex =
    fireControl.targetHex;

  const direction =
    getDirectionBetween(
      unit,
      targetHex,
    );

  unit.action = {
    type: UNIT_ACTIONS.FIRE,

    targetHex: {
      column:
        targetHex.column,

      row:
        targetHex.row,
    },

    targetUnitId:
      fireControl.targetUnitId ??
      null,

    direction,
    crewRole: null,
    startedTurn: turn,
    persistent: true,
  };

  unit.command =
    "쏴-수정";

  unlockTurretFromHull(unit);

  setTurretTargetDirection(
    unit,
    direction,
  );
}

function clearFireAction(unit) {
  if (
    unit.action?.type !==
      UNIT_ACTIONS.FIRE &&
    unit.action?.type !==
      UNIT_ACTIONS.RECON_BY_FIRE
  ) {
    return;
  }

  unit.action =
    createIdleAction();

  if (!unit.destroyed) {
    unit.command =
      "대기";
  }
}

function beginAimingOrTraverse(
  unit,
  turn,
) {
  const fireControl =
    unit.fireControl;

  if (!hasFireTarget(unit)) {
    resetAimingState(unit);

    setProcedureState(
      unit,
      FIRE_PROCEDURE_STATES.STOPPED,
      turn,
    );

    return {
      aligned: false,

      state:
        FIRE_PROCEDURE_STATES.STOPPED,
    };
  }

  if (isTurretAligned(unit)) {
    fireControl.aiming =
      true;

    fireControl.aimStartedTurn =
      turn;

    setProcedureState(
      unit,
      FIRE_PROCEDURE_STATES.AIMING,
      turn,
    );

    unit.command =
      "조준";

    return {
      aligned: true,

      state:
        FIRE_PROCEDURE_STATES.AIMING,
    };
  }

  resetAimingState(unit);

  setProcedureState(
    unit,
    FIRE_PROCEDURE_STATES.TRAVERSING,
    turn,
  );

  unit.command =
    "포탑 선회";

  return {
    aligned: false,

    state:
      FIRE_PROCEDURE_STATES.TRAVERSING,
  };
}

export function createFireControl() {
  return {
    state:
      FIRE_STATES.STOPPED,

    procedureState:
      FIRE_PROCEDURE_STATES.STOPPED,

    procedureTurn:
      null,

    ammunition:
      AMMUNITION_TYPES.APFSDS,

    loadedAmmunition:
      null,

    loadingAmmunition:
      null,

    targetHex:
      null,

    targetUnitId:
      null,

    roundsFired:
      0,

    lastFiredTurn:
      null,

    gunnerAutonomous:
      false,

    loading:
      false,

    loaded:
      false,

    loadStartedTurn:
      null,

    loadedTurn:
      null,

    aiming:
      false,

    aimStartedTurn:
      null,

    aimStability:
      1,

    alignmentRequired:
      true,

    fireCommandIssued:
      false,

    lastShotResult:
      null,
  };
}

export function selectAmmunition(
  unit,
  ammunition,
) {
  if (
    unit.destroyed ||
    !unit.fireControl ||
    !Object.values(
      AMMUNITION_TYPES,
    ).includes(ammunition)
  ) {
    return false;
  }

  unit.fireControl.ammunition =
    ammunition;

  return true;
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
    !target ||
    !Number.isFinite(
      target.column,
    ) ||
    !Number.isFinite(
      target.row,
    )
  ) {
    return false;
  }

  const fireControl =
    unit.fireControl;

  if (
    ammunition &&
    Object.values(
      AMMUNITION_TYPES,
    ).includes(ammunition)
  ) {
    fireControl.ammunition =
      ammunition;
  }

  fireControl.targetHex = {
    column:
      target.column,

    row:
      target.row,
  };

  fireControl.targetUnitId =
    target.unitId ??
    null;

  fireControl.state =
    FIRE_STATES.READY;

  fireControl.gunnerAutonomous =
    false;

  fireControl.fireCommandIssued =
    false;

  fireControl.lastShotResult =
    null;

  resetAimingState(unit);
  unlockTurretFromHull(unit);

  setTurretTargetDirection(
    unit,
    getDirectionBetween(
      unit,
      target,
    ),
  );

  if (fireControl.loading) {
    unit.command =
      fireControl.procedureState ===
        FIRE_PROCEDURE_STATES.RELOADING
        ? "재장전 중 / 표적 지정"
        : "장전 중 / 표적 지정";
  } else {
    setProcedureState(
      unit,
      FIRE_PROCEDURE_STATES
        .TARGET_DESIGNATED,
      turn,
    );

    unit.command =
      "표적 지정";
  }

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

  const success =
    setFireTarget(
      unit,
      {
        column:
          target.column,

        row:
          target.row,

        unitId:
          target.id,
      },
      null,
      turn,
    );

  if (!success) {
    return false;
  }

  unit.command =
    "표적 인계";

  return true;
}

export function beginLoading(
  unit,
  turn,
) {
  if (
    unit.destroyed ||
    !unit.fireControl
  ) {
    return {
      success: false,

      reason:
        "장전할 수 없는 상태입니다.",
    };
  }

  const fireControl =
    unit.fireControl;

  if (fireControl.loaded) {
    return {
      success: false,

      reason:
        "주포에 탄이 이미 장전되어 있습니다.",
    };
  }

  if (fireControl.loading) {
    return {
      success: false,

      reason:
        "이미 장전 중입니다.",
    };
  }

  fireControl.loading =
    true;

  fireControl.loadingAmmunition =
    fireControl.ammunition;

  fireControl.loadStartedTurn =
    turn;

  const isReload =
    fireControl.procedureState ===
      FIRE_PROCEDURE_STATES.FIRED ||
    fireControl.procedureState ===
      FIRE_PROCEDURE_STATES.ADJUSTING ||
    fireControl.state ===
      FIRE_STATES.ADJUST;

  setProcedureState(
    unit,
    isReload
      ? FIRE_PROCEDURE_STATES.RELOADING
      : FIRE_PROCEDURE_STATES.LOADING,
    turn,
  );

  unit.command =
    isReload
      ? "재장전"
      : "장전";

  return {
    success: true,

    ammunition:
      fireControl.loadingAmmunition,

    reloading:
      isReload,
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

  const fireControl =
    unit.fireControl;

  const canIssueCommand =
    fireControl.procedureState ===
      FIRE_PROCEDURE_STATES
        .TARGET_DESIGNATED ||
    fireControl.loading;

  if (!canIssueCommand) {
    return {
      success: false,

      reason:
        "현재 단계에서는 사격명령을 내릴 수 없습니다.",
    };
  }

  fireControl.state =
    FIRE_STATES.READY;

  fireControl.fireCommandIssued =
    true;

  if (fireControl.loaded) {
    const aimingResult =
      beginAimingOrTraverse(
        unit,
        turn,
      );

    return {
      success: true,
      automaticLoading: false,
      usedLoadedRound: true,
      state: aimingResult.state,
    };
  }

  if (fireControl.loading) {
    unit.command =
      "사격명령 / 장전 중";

    return {
      success: true,
      automaticLoading: false,
      loadingInProgress: true,

      ammunition:
        fireControl.loadingAmmunition,

      state:
        fireControl.procedureState,
    };
  }

  setProcedureState(
    unit,
    FIRE_PROCEDURE_STATES.FIRE_COMMAND,
    turn,
  );

  unit.command =
    "사격명령";

  const loadingResult =
    beginLoading(
      unit,
      turn,
    );

  if (!loadingResult.success) {
    return loadingResult;
  }

  return {
    success: true,
    automaticLoading: true,
    loadingInProgress: true,

    ammunition:
      loadingResult.ammunition,

    state:
      fireControl.procedureState,
  };
}

function completeLoading(
  unit,
  turn,
) {
  const fireControl =
    unit.fireControl;

  if (
    unit.destroyed ||
    !fireControl?.loading
  ) {
    return {
      success: false,

      reason:
        "장전 중인 탄이 없습니다.",
    };
  }

  const loadedAmmunition =
    fireControl.loadingAmmunition;

  clearLoadingProgress(unit);

  fireControl.loaded =
    true;

  fireControl.loadedAmmunition =
    loadedAmmunition;

  fireControl.loadedTurn =
    turn;

  if (!hasFireTarget(unit)) {
    resetAimingState(unit);

    setProcedureState(
      unit,
      FIRE_PROCEDURE_STATES.STOPPED,
      turn,
    );

    if (!unit.destroyed) {
      unit.command =
        "장전 완료";
    }

    return {
      success: true,

      ammunition:
        loadedAmmunition,

      aligned: false,
      targetAvailable: false,
    };
  }

  if (
    fireControl.fireCommandIssued !==
      true
  ) {
    setProcedureState(
      unit,
      FIRE_PROCEDURE_STATES
        .TARGET_DESIGNATED,
      turn,
    );

    unit.command =
      "장전 완료 / 사격명령 대기";

    return {
      success: true,

      ammunition:
        loadedAmmunition,

      aligned: false,
      targetAvailable: true,
      awaitingFireCommand: true,
    };
  }

  const aimingResult =
    beginAimingOrTraverse(
      unit,
      turn,
    );

  return {
    success: true,

    ammunition:
      loadedAmmunition,

    aligned:
      aimingResult.aligned,

    targetAvailable: true,
  };
}

export function updateFireProcedure(
  unit,
  turn,
) {
  if (
    unit.destroyed ||
    !unit.fireControl
  ) {
    return {
      changed: false,
    };
  }

  const fireControl =
    unit.fireControl;

  if (
    fireControl.loading &&
    fireControl.loadStartedTurn !==
      null &&
    turn >
      fireControl.loadStartedTurn
  ) {
    const loadingResult =
      completeLoading(
        unit,
        turn,
      );

    return {
      changed:
        loadingResult.success,

      state:
        fireControl.procedureState,

      loadingCompleted:
        loadingResult.success,

      ammunition:
        loadingResult.ammunition ??
        null,
    };
  }

  if (!hasFireTarget(unit)) {
    return {
      changed: false,

      state:
        fireControl.procedureState,
    };
  }

  if (
    fireControl.fireCommandIssued ===
      true &&
    fireControl.procedureState ===
      FIRE_PROCEDURE_STATES.TRAVERSING &&
    isTurretAligned(unit)
  ) {
    fireControl.aiming =
      true;

    fireControl.aimStartedTurn =
      turn;

    setProcedureState(
      unit,
      FIRE_PROCEDURE_STATES.AIMING,
      turn,
    );

    unit.command =
      "조준";

    return {
      changed: true,

      state:
        fireControl.procedureState,
    };
  }

  if (
    fireControl.fireCommandIssued ===
      true &&
    fireControl.procedureState ===
      FIRE_PROCEDURE_STATES.AIMING &&
    fireControl.aimStartedTurn !==
      null &&
    turn >
      fireControl.aimStartedTurn
  ) {
    fireControl.aiming =
      false;

    setProcedureState(
      unit,
      FIRE_PROCEDURE_STATES
        .READY_TO_FIRE,
      turn,
    );

    unit.command =
      "발사 준비";

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

function synchronizeFireTarget(
  runtimeScenario,
  unit,
  turn = null,
) {
  const fireControl =
    unit.fireControl;

  if (
    !runtimeScenario ||
    !fireControl?.targetHex ||
    !unit.turretControl
  ) {
    return {
      success: false,
      reason:
        "사격 목표를 동기화할 수 없습니다.",
    };
  }

  if (fireControl.targetUnitId) {
    const target =
      runtimeScenario.units.find(
        (candidate) =>
          candidate.id ===
            fireControl.targetUnitId &&
          !candidate.destroyed,
      );

    if (!target) {
      fireControl.targetHex =
        null;

      fireControl.targetUnitId =
        null;

      fireControl.fireCommandIssued =
        false;

      resetAimingState(
        unit,
      );

      setProcedureState(
        unit,
        FIRE_PROCEDURE_STATES.STOPPED,
        turn,
      );

      return {
        success: false,
        reason:
          "지정 표적이 소실되었습니다.",
      };
    }

    fireControl.targetHex = {
      column:
        target.column,

      row:
        target.row,
    };
  }

  const direction =
    getDirectionBetween(
      unit,
      fireControl.targetHex,
    );

  setTurretTargetDirection(
    unit,
    direction,
  );

  return {
    success: true,
    direction,
  };
}

function validateFirePermission(
  runtimeScenario,
  unit,
  turn,
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

  if (
    unit.fireControl.fireCommandIssued !==
      true
  ) {
    return {
      allowed: false,

      reason:
        "사격명령이 하달되지 않았습니다.",
    };
  }

  const synchronization =
    synchronizeFireTarget(
      runtimeScenario,
      unit,
      turn,
    );

  if (!synchronization.success) {
    return {
      allowed: false,
      reason:
        synchronization.reason,
    };
  }

  if (
    !unit.fireControl.loaded ||
    !unit.fireControl.loadedAmmunition
  ) {
    return {
      allowed: false,

      reason:
        "장전이 완료되지 않았습니다.",
    };
  }

  if (
    unit.fireControl.procedureState !==
      FIRE_PROCEDURE_STATES.READY_TO_FIRE
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

  const firedAmmunition =
    fireControl.loadedAmmunition;

  fireControl.roundsFired +=
    1;

  fireControl.lastFiredTurn =
    turn;

  clearLoadedRound(unit);
  resetAimingState(unit);

  if (
    fireControl.state !==
      FIRE_STATES.ADJUST
  ) {
    fireControl.fireCommandIssued =
      false;
  }

  const selectedAmmunition =
    fireControl.ammunition;

  fireControl.ammunition =
    firedAmmunition;

  let shotResult;

  try {
    shotResult =
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
  } finally {
    fireControl.ammunition =
      selectedAmmunition;
  }

  fireControl.lastShotResult = {
    ...shotResult,

    ammunition:
      firedAmmunition,
  };

  setProcedureState(
    unit,
    FIRE_PROCEDURE_STATES.FIRED,
    turn,
  );

  return fireControl.lastShotResult;
}

export function fireSingleShot(
  runtimeScenario,
  unit,
  turn,
  options = {},
) {
  const permission =
    validateFirePermission(
      runtimeScenario,
      unit,
      turn,
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

  const reloadResult =
    beginReloading(
      unit,
      turn,
    );

  unit.command =
    reloadResult.success
      ? "쏴 / 재장전"
      : "쏴";

  return {
    success: true,

    aimStability:
      permission.aimStability,

    movingFirePenalty:
      permission.movingFirePenalty ??
      0,

    ammunition:
      shotResult.ammunition,

    shotResult,

    reloadStarted:
      reloadResult.success,

    loadingAmmunition:
      reloadResult.ammunition ??
      null,
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
      runtimeScenario,
      unit,
      turn,
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

  unit.fireControl.fireCommandIssued =
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

  setAdjustedFireAction(
    unit,
    turn,
  );

  return {
    success: true,

    aimStability:
      permission.aimStability,

    movingFirePenalty:
      permission.movingFirePenalty ??
      0,

    ammunition:
      shotResult.ammunition,

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
    !unit.fireControl.gunnerAutonomous
  ) {
    return {
      success: false,

      reason:
        "포수 자율사격 상태가 아닙니다.",
    };
  }

  const permission =
    validateFirePermission(
      runtimeScenario,
      unit,
      turn,
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

  unit.command =
    "쏴-수정";

  return {
    success: true,

    aimStability:
      permission.aimStability,

    movingFirePenalty:
      permission.movingFirePenalty ??
      0,

    ammunition:
      shotResult.ammunition,

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

  fireControl.targetHex =
    null;

  fireControl.targetUnitId =
    null;

  fireControl.gunnerAutonomous =
    false;

  fireControl.fireCommandIssued =
    false;

  resetAimingState(unit);

  setProcedureState(
    unit,
    FIRE_PROCEDURE_STATES.STOPPED,
  );

  clearFireAction(unit);

  if (!unit.destroyed) {
    unit.command =
      fireControl.loading
        ? "사격 그만 / 장전 중"
        : fireControl.loaded
          ? "사격 그만 / 장전 완료"
          : "사격 그만";
  }

  return true;
}

export function stopFireTracking(unit) {
  if (unit.fireControl) {
    ceaseFire(unit);
  }
}
