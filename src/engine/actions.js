// ============================================================
// ATS PROJECT
// File      : src/engine/actions.js
// Sprint    : 3.9.1
// Revision  : R7
// Build     : 2026-08-05
// Type      : PARTIAL PATCH
// Purpose   : Crew actions with single-shot recon-by-fire and live target tracking
// ============================================================

import {
  UNIT_ACTIONS,
} from "./constants/actionConstants.js";

import {
  createIdleAction,
} from "./factories/actionFactory.js";

import {
  CREW_ROLES,
  HUNTER_KILLER_STATES,
} from "./runtime/runtimeConstants.js";

import {
  DETECTION_STAGES,
} from "./detection.js";

import {
  getHexDirection,
  getHexDistance,
} from "./hexGeometry.js";

import {
  normalizeAngle,
} from "./mathUtils.js";

import {
  isTurretAligned,
  setTurretTargetDirection,
  unlockTurretFromHull,
  updateTurretRotation,
} from "./turretControl.js";

export {
  UNIT_ACTIONS,
};

const FIRE_STATES =
  Object.freeze({
    ADJUST:
      "adjust",
  });

const FIRE_PROCEDURE_STATES =
  Object.freeze({
    READY_TO_FIRE:
      "ready-to-fire",

    FIRED:
      "fired",

    ADJUSTING:
      "adjusting",
  });


export const DIRECTED_ACTION_STATES = Object.freeze({
  TARGET_DESIGNATED: "target-designated",
  ALIGNING: "aligning",
  READY: "ready",
  EXECUTING: "executing",
  COMPLETED: "completed",
});

const LOADER_OBSERVATION_MODES =
  Object.freeze({
    OPEN_HATCH:
      "open-hatch",

    PERISCOPE:
      "periscope",

    LOADING:
      "loading",
  });

const LOADER_SIDE_OFFSET =
  Math.PI / 2;

const DEFAULT_CPS_ROTATION_RATE =
  Math.PI / 4;

const ANGLE_ALIGNMENT_TOLERANCE =
  0.001;

const LOADER_OBSERVATION_FACTORS =
  Object.freeze({
    [LOADER_OBSERVATION_MODES
      .OPEN_HATCH]: {
      fieldOfView: 1,
      range: 1,
      identification: 1,
    },

    [LOADER_OBSERVATION_MODES
      .PERISCOPE]: {
      fieldOfView: 0.42,
      range: 0.4,
      identification: 0.35,
    },

    [LOADER_OBSERVATION_MODES
      .LOADING]: {
      fieldOfView: 0.22,
      range: 0.16,
      identification: 0.12,
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

function positiveOrDefault(
  value,
  fallback,
) {
  return Math.max(
    0.01,
    finiteOrDefault(
      value,
      fallback,
    ),
  );
}

function getAngleDifference(
  first,
  second,
) {
  return normalizeAngle(
    finiteOrDefault(
      first,
      0,
    ) -
    finiteOrDefault(
      second,
      0,
    ),
  );
}

function areDirectionsAligned(
  first,
  second,
) {
  return (
    Math.abs(
      getAngleDifference(
        first,
        second,
      ),
    ) <=
    ANGLE_ALIGNMENT_TOLERANCE
  );
}

function rotateToward(
  current,
  target,
  maximumStep,
) {
  const safeCurrent =
    normalizeAngle(
      current,
    );

  const safeTarget =
    normalizeAngle(
      target,
    );

  const difference =
    getAngleDifference(
      safeTarget,
      safeCurrent,
    );

  const step =
    Math.min(
      Math.abs(
        difference,
      ),
      nonNegativeOrDefault(
        maximumStep,
        0,
      ),
    );

  if (step === 0) {
    return safeCurrent;
  }

  return normalizeAngle(
    safeCurrent +
    Math.sign(
      difference,
    ) *
    step,
  );
}

function getDirectionBetween(
  observer,
  target,
) {
  return getHexDirection(
    observer,
    target,
  );
}

function isTurretTrackingAction(
  actionType,
) {
  return (
    actionType ===
      UNIT_ACTIONS
        .RECON_BY_FIRE ||
    actionType ===
      UNIT_ACTIONS.FIRE
  );
}

function getCrewObserver(
  unit,
  crewRole,
) {
  return (
    unit.crewObservation
      ?.observers?.[crewRole] ??
    null
  );
}

function getCommanderSight(unit) {
  return (
    unit.crewObservation
      ?.commanderIndependentSight ??
    null
  );
}

function getHunterKiller(unit) {
  return (
    unit.crewObservation
      ?.hunterKiller ??
    null
  );
}

function ensureObserverBasePerformance(
  observer,
) {
  if (!observer) {
    return false;
  }

  const fieldOfView =
    positiveOrDefault(
      observer.baseFieldOfView ??
        observer.fieldOfView,
      Math.PI / 2,
    );

  const range =
    nonNegativeOrDefault(
      observer.baseRange ??
        observer.range,
      1,
    );

  const identificationFactor =
    nonNegativeOrDefault(
      observer
        .baseIdentificationFactor ??
        observer
          .identificationFactor,
      1,
    );

  observer.baseFieldOfView =
    fieldOfView;

  observer.baseRange =
    range;

  observer.baseIdentificationFactor =
    identificationFactor;

  if (
    !Number.isFinite(
      observer.fieldOfView,
    )
  ) {
    observer.fieldOfView =
      fieldOfView;
  }

  if (
    !Number.isFinite(
      observer.range,
    )
  ) {
    observer.range =
      range;
  }

  if (
    !Number.isFinite(
      observer
        .identificationFactor,
    )
  ) {
    observer.identificationFactor =
      identificationFactor;
  }

  return true;
}

function restoreObserverBasePerformance(
  observer,
) {
  if (
    !ensureObserverBasePerformance(
      observer,
    )
  ) {
    return;
  }

  observer.fieldOfView =
    observer.baseFieldOfView;

  observer.range =
    observer.baseRange;

  observer.identificationFactor =
    observer
      .baseIdentificationFactor;
}

function applyObserverPerformance(
  observer,
  factors,
) {
  if (
    !ensureObserverBasePerformance(
      observer,
    )
  ) {
    return;
  }

  observer.fieldOfView =
    observer.baseFieldOfView *
    nonNegativeOrDefault(
      factors?.fieldOfView,
      1,
    );

  observer.range =
    observer.baseRange *
    nonNegativeOrDefault(
      factors?.range,
      1,
    );

  observer.identificationFactor =
    observer
      .baseIdentificationFactor *
    nonNegativeOrDefault(
      factors?.identification,
      1,
    );
}

function clearHunterKillerState(
  unit,
) {
  const hunterKiller =
    getHunterKiller(unit);

  if (!hunterKiller) {
    return;
  }

  hunterKiller.state =
    HUNTER_KILLER_STATES
      .SEARCHING;

  hunterKiller.detectedTargetUnitId =
    null;

  hunterKiller.designatedTargetUnitId =
    null;

  hunterKiller.handedOffTargetUnitId =
    null;
}

function deactivateCommanderVisual(
  unit,
) {
  const commander =
    getCrewObserver(
      unit,
      CREW_ROLES.COMMANDER,
    );

  if (commander) {
    commander.observing =
      false;
  }
}

function deactivateCommanderSight(
  unit,
) {
  const sight =
    getCommanderSight(unit);

  if (sight) {
    sight.active =
      false;

    sight.locked =
      false;

    sight.tracking =
      false;

    sight.targetUnitId =
      null;
  }

  clearHunterKillerState(
    unit,
  );
}

function activateCommanderVisual(
  unit,
  direction,
  turn,
) {
  const commander =
    getCrewObserver(
      unit,
      CREW_ROLES.COMMANDER,
    );

  if (
    !commander ||
    !Number.isFinite(
      direction,
    )
  ) {
    return false;
  }

  restoreObserverBasePerformance(
    commander,
  );

  commander.direction =
    normalizeAngle(
      direction,
    );

  commander.targetDirection =
    commander.direction;

  commander.observing =
    true;

  commander.lastUpdatedTurn =
    turn;

  deactivateCommanderSight(
    unit,
  );

  return true;
}

function isLoaderHatchOpen(
  unit,
) {
  return (
    unit.hatchState ===
    "open"
  );
}

function isLoaderBusy(
  unit,
) {
  return (
    unit.fireControl?.loading ===
    true
  );
}

function getLoaderObservationMode(
  unit,
) {
  if (isLoaderBusy(unit)) {
    return (
      LOADER_OBSERVATION_MODES
        .LOADING
    );
  }

  if (isLoaderHatchOpen(unit)) {
    return (
      LOADER_OBSERVATION_MODES
        .OPEN_HATCH
    );
  }

  return (
    LOADER_OBSERVATION_MODES
      .PERISCOPE
  );
}

function getLoaderPeriscopeDirection(
  unit,
) {
  const turretDirection =
    finiteOrDefault(
      unit.turretDirection ??
        unit.hullDirection,
      0,
    );

  return normalizeAngle(
    turretDirection +
    LOADER_SIDE_OFFSET,
  );
}

function updateLoaderObservation(
  unit,
  turn = null,
) {
  const loader =
    getCrewObserver(
      unit,
      CREW_ROLES.LOADER,
    );

  if (!loader) {
    return;
  }

  const mode =
    getLoaderObservationMode(
      unit,
    );

  loader.observationMode =
    mode;

  applyObserverPerformance(
    loader,
    LOADER_OBSERVATION_FACTORS[
      mode
    ],
  );

  if (
    mode ===
      LOADER_OBSERVATION_MODES
        .OPEN_HATCH &&
    Number.isFinite(
      loader.assignedDirection,
    )
  ) {
    loader.direction =
      normalizeAngle(
        loader.assignedDirection,
      );

    loader.targetDirection =
      loader.direction;
  } else {
    const periscopeDirection =
      getLoaderPeriscopeDirection(
        unit,
      );

    loader.direction =
      periscopeDirection;

    loader.targetDirection =
      periscopeDirection;
  }

  loader.observing =
    true;

  if (turn !== null) {
    loader.lastUpdatedTurn =
      turn;
  }
}

export function updateCommanderSightRotation(
  unit,
  turn = null,
) {
  const sight =
    getCommanderSight(unit);

  if (
    unit.destroyed ||
    !sight?.operational ||
    sight.active !== true
  ) {
    return false;
  }

  const currentDirection =
    finiteOrDefault(
      sight.direction ??
        unit.hullDirection,
      0,
    );

  const targetDirection =
    finiteOrDefault(
      sight.targetDirection,
      currentDirection,
    );

  const rotationRate =
    positiveOrDefault(
      sight.rotationRate,
      DEFAULT_CPS_ROTATION_RATE,
    );

  sight.direction =
    rotateToward(
      currentDirection,
      targetDirection,
      rotationRate,
    );

  sight.locked =
    areDirectionsAligned(
      sight.direction,
      targetDirection,
    );

  if (turn !== null) {
    sight.lastUpdatedTurn =
      turn;
  }

  return true;
}

export function canAssignCrewObservation(
  unit,
  crewRole,
) {
  if (
    unit.destroyed ||
    !getCrewObserver(
      unit,
      crewRole,
    )
  ) {
    return false;
  }

  if (
    crewRole ===
    CREW_ROLES.COMMANDER
  ) {
    return true;
  }

  if (
    crewRole ===
    CREW_ROLES.LOADER
  ) {
    return (
      isLoaderHatchOpen(
        unit,
      ) &&
      !isLoaderBusy(
        unit,
      )
    );
  }

  return false;
}

export function synchronizeCrewObservationDirections(
  unit,
  turn = null,
) {
  const observation =
    unit.crewObservation;

  if (
    unit.destroyed ||
    !observation?.observers
  ) {
    return false;
  }

  const gunner =
    getCrewObserver(
      unit,
      CREW_ROLES.GUNNER,
    );

  const driver =
    getCrewObserver(
      unit,
      CREW_ROLES.DRIVER,
    );

  const turretDirection =
    normalizeAngle(
      finiteOrDefault(
        unit.turretDirection ??
          unit.hullDirection,
        0,
      ),
    );

  const hullDirection =
    normalizeAngle(
      finiteOrDefault(
        unit.hullDirection,
        0,
      ),
    );

  if (gunner) {
    restoreObserverBasePerformance(
      gunner,
    );

    gunner.direction =
      turretDirection;

    gunner.targetDirection =
      turretDirection;

    gunner.observing =
      true;

    gunner.observationMode =
      "turret-coupled";

    if (turn !== null) {
      gunner.lastUpdatedTurn =
        turn;
    }
  }

  if (driver) {
    restoreObserverBasePerformance(
      driver,
    );

    driver.direction =
      hullDirection;

    driver.targetDirection =
      hullDirection;

    driver.observing =
      true;

    driver.observationMode =
      "hull-forward";

    if (turn !== null) {
      driver.lastUpdatedTurn =
        turn;
    }
  }

  updateLoaderObservation(
    unit,
    turn,
  );

  return true;
}

export function setPersistentAction(
  unit,
  action,
  turn = 1,
) {
  if (unit.destroyed) {
    return null;
  }

  unit.action = {
    type:
      action.type ??
      UNIT_ACTIONS.IDLE,

    targetHex:
      action.targetHex
        ? {
            column:
              action.targetHex
                .column,

            row:
              action.targetHex
                .row,
          }
        : null,

    targetUnitId:
      action.targetUnitId ??
      null,

    direction:
      Number.isFinite(
        action.direction,
      )
        ? action.direction
        : null,

    crewRole:
      action.crewRole ??
      null,

    startedTurn:
      turn,

    persistent:
      true,
  };

  unit.command =
    action.label ??
    unit.command;

  if (
    unit.turretControl &&
    isTurretTrackingAction(
      unit.action.type,
    ) &&
    Number.isFinite(
      unit.action.direction,
    )
  ) {
    unlockTurretFromHull(
      unit,
    );

    setTurretTargetDirection(
      unit,
      unit.action.direction,
    );
  }

  return unit.action;
}

export function clearPersistentAction(
  unit,
) {
  unit.action =
    createIdleAction();

  if (!unit.destroyed) {
    unit.command =
      "대기";
  }
}

export function setCrewObservationDirection(
  unit,
  crewRole,
  direction,
  turn = 1,
) {
  const observer =
    getCrewObserver(
      unit,
      crewRole,
    );

  if (
    unit.destroyed ||
    !observer
  ) {
    return false;
  }

  if (
    crewRole ===
      CREW_ROLES.GUNNER ||
    crewRole ===
      CREW_ROLES.DRIVER
  ) {
    synchronizeCrewObservationDirections(
      unit,
      turn,
    );

    unit.command =
      crewRole ===
        CREW_ROLES.GUNNER
        ? "포수 포탑 방향 감시"
        : "조종수 차체 전방 감시";

    return true;
  }

  if (
    !Number.isFinite(
      direction,
    )
  ) {
    return false;
  }

  if (
    crewRole ===
    CREW_ROLES.COMMANDER
  ) {
    const success =
      activateCommanderVisual(
        unit,
        direction,
        turn,
      );

    if (!success) {
      return false;
    }

    unit.command =
      "전차장 육안 감시구역 할당";

    return true;
  }

  if (
    crewRole ===
    CREW_ROLES.LOADER
  ) {
    if (
      !canAssignCrewObservation(
        unit,
        crewRole,
      )
    ) {
      return false;
    }

    restoreObserverBasePerformance(
      observer,
    );

    observer.assignedDirection =
      normalizeAngle(
        direction,
      );

    observer.direction =
      observer.assignedDirection;

    observer.targetDirection =
      observer.assignedDirection;

    observer.observing =
      true;

    observer.observationMode =
      LOADER_OBSERVATION_MODES
        .OPEN_HATCH;

    observer.lastUpdatedTurn =
      turn;

    unit.command =
      "탄약수 감시구역 할당";

    return true;
  }

  return false;
}

export function setCommanderSightDirection(
  unit,
  direction,
) {
  const sight =
    getCommanderSight(
      unit,
    );

  if (
    unit.destroyed ||
    !sight?.operational ||
    !Number.isFinite(
      direction,
    )
  ) {
    return false;
  }

  deactivateCommanderVisual(
    unit,
  );

  clearHunterKillerState(
    unit,
  );

  sight.active =
    true;

  sight.targetDirection =
    normalizeAngle(
      direction,
    );

  sight.targetUnitId =
    null;

  sight.locked =
    false;

  sight.tracking =
    false;

  return true;
}

function isCommanderSightTarget(
  unit,
  targetUnit,
) {
  const sight =
    getCommanderSight(
      unit,
    );

  return (
    sight?.operational ===
      true &&
    sight.active ===
      true &&
    sight.tracking ===
      true &&
    sight.targetUnitId ===
      targetUnit.id
  );
}

function isCommanderSightDetection(
  unit,
  targetUnit,
) {
  return (
    targetUnit.detectedByUnitId ===
      unit.id &&
    targetUnit
      .detectedByCrewRole ===
      "commander-cps"
  );
}

function canDesignateHunterKillerTarget(
  unit,
  targetUnit,
) {
  if (
    !targetUnit ||
    targetUnit.destroyed ||
    targetUnit.side !==
      "enemy"
  ) {
    return false;
  }

  const hasContact =
    (
      targetUnit.detectionStage ??
      DETECTION_STAGES.HIDDEN
    ) >=
    DETECTION_STAGES.CONTACT;

  return (
    hasContact ||
    isCommanderSightTarget(
      unit,
      targetUnit,
    ) ||
    isCommanderSightDetection(
      unit,
      targetUnit,
    )
  );
}

export function designateHunterKillerTarget(
  unit,
  targetUnit,
  hunterKillerStates =
    HUNTER_KILLER_STATES,
) {
  const observation =
    unit.crewObservation;

  const hunterKiller =
    observation?.hunterKiller;

  const sight =
    observation
      ?.commanderIndependentSight;

  if (
    unit.destroyed ||
    !hunterKiller?.enabled ||
    !sight?.operational ||
    !canDesignateHunterKillerTarget(
      unit,
      targetUnit,
    )
  ) {
    return false;
  }

  const targetDirection =
    normalizeAngle(
      getDirectionBetween(
        unit,
        targetUnit,
      ),
    );

  deactivateCommanderVisual(
    unit,
  );

  sight.active =
    true;

  sight.targetDirection =
    targetDirection;

  sight.targetUnitId =
    targetUnit.id;

  sight.locked =
    false;

  sight.tracking =
    true;

  hunterKiller.state =
    hunterKillerStates
      .DESIGNATING;

  hunterKiller.detectedTargetUnitId =
    targetUnit.id;

  hunterKiller.designatedTargetUnitId =
    targetUnit.id;

  hunterKiller.handedOffTargetUnitId =
    null;

  unlockTurretFromHull(
    unit,
  );

  setTurretTargetDirection(
    unit,
    targetDirection,
  );

  return true;
}

function clearHunterKillerTarget(
  hunterKiller,
  sight,
) {
  hunterKiller.state =
    HUNTER_KILLER_STATES
      .SEARCHING;

  hunterKiller.detectedTargetUnitId =
    null;

  hunterKiller.designatedTargetUnitId =
    null;

  hunterKiller.handedOffTargetUnitId =
    null;

  if (sight) {
    sight.active =
      false;

    sight.targetUnitId =
      null;

    sight.locked =
      false;

    sight.tracking =
      false;
  }
}

function updateHunterKillerTargeting(
  unit,
  runtimeScenario,
  hunterKillerStates,
) {
  const hunterKiller =
    getHunterKiller(
      unit,
    );

  const sight =
    getCommanderSight(
      unit,
    );

  if (
    unit.destroyed ||
    !hunterKiller?.enabled
  ) {
    return null;
  }

  const states =
    hunterKillerStates ??
    HUNTER_KILLER_STATES;

  const targetId =
    hunterKiller
      .designatedTargetUnitId;

  if (!targetId) {
    return null;
  }

  const target =
    runtimeScenario.units.find(
      (candidate) =>
        candidate.id ===
          targetId &&
        !candidate.destroyed,
    );

  if (!target) {
    clearHunterKillerTarget(
      hunterKiller,
      sight,
    );

    return null;
  }

  const targetDirection =
    normalizeAngle(
      getDirectionBetween(
        unit,
        target,
      ),
    );

  deactivateCommanderVisual(
    unit,
  );

  if (sight) {
    const targetChanged =
      !areDirectionsAligned(
        sight.targetDirection,
        targetDirection,
      );

    sight.active =
      true;

    sight.targetDirection =
      targetDirection;

    sight.targetUnitId =
      target.id;

    sight.tracking =
      true;

    if (targetChanged) {
      sight.locked =
        false;
    }
  }

  unlockTurretFromHull(
    unit,
  );

  setTurretTargetDirection(
    unit,
    targetDirection,
  );

  return {
    target,
    states,
    hunterKiller,
    sight,
  };
}

function processHunterKillerHandoff(
  unit,
  turn,
  context,
  acceptHunterKillerTarget,
) {
  if (!context) {
    return;
  }

  const {
    target,
    states,
    hunterKiller,
    sight,
  } = context;

  if (
    hunterKiller.state ===
    states.DESIGNATING
  ) {
    if (
      sight?.locked !==
        true ||
      !isTurretAligned(
        unit,
      )
    ) {
      return;
    }

    const accepted =
      acceptHunterKillerTarget?.(
        unit,
        target,
        turn,
      ) ?? false;

    if (!accepted) {
      return;
    }

    hunterKiller.state =
      states.HANDOFF;

    hunterKiller
      .handedOffTargetUnitId =
      target.id;

    return;
  }

  if (
    hunterKiller.state ===
    states.HANDOFF
  ) {
    hunterKiller.state =
      states.TRACKING;
  }
}

export function applyReconByFire(
  runtimeScenario,
  attacker,
  targetHex,
  turn,
) {
  if (
    attacker.destroyed ||
    !targetHex ||
    !Number.isFinite(targetHex.column) ||
    !Number.isFinite(targetHex.row)
  ) {
    return null;
  }

  const direction =
    getDirectionBetween(
      attacker,
      targetHex,
    );

  const action =
    setPersistentAction(
      attacker,
      {
        type:
          UNIT_ACTIONS.RECON_BY_FIRE,
        targetHex,
        direction,
        crewRole:
          CREW_ROLES.GUNNER,
        label:
          "화력수색 목표 지정",
      },
      turn,
    );

  if (!action) {
    return null;
  }

  action.internalState =
    DIRECTED_ACTION_STATES
      .TARGET_DESIGNATED;
  action.operatorRole =
    CREW_ROLES.GUNNER;
  action.executionMethod =
    "main-gun";
  action.executionLimit = 1;
  action.executionCount = 0;

  return action;
}

function updateReconByFireAction(
  runtimeScenario,
  unit,
  turn,
  moving,
  executeDirectedAction,
) {
  const action = unit.action;

  if (
    action?.type !==
      UNIT_ACTIONS.RECON_BY_FIRE ||
    !action.targetHex
  ) {
    return null;
  }

  if (
    action.internalState ===
      DIRECTED_ACTION_STATES.COMPLETED ||
    (action.executionCount ?? 0) >=
      (action.executionLimit ?? 1)
  ) {
    clearPersistentAction(unit);
    return null;
  }

  const direction =
    getDirectionBetween(
      unit,
      action.targetHex,
    );

  action.direction = direction;
  setTurretTargetDirection(unit, direction);

  if (!isTurretAligned(unit)) {
    action.internalState =
      DIRECTED_ACTION_STATES.ALIGNING;
    unit.command =
      "화력수색 방향 정렬 중";
    return null;
  }

  if (
    action.internalState !==
      DIRECTED_ACTION_STATES.READY
  ) {
    action.internalState =
      DIRECTED_ACTION_STATES.READY;
    unit.command =
      "화력수색 실행 준비";
    return null;
  }

  action.internalState =
    DIRECTED_ACTION_STATES.EXECUTING;

  const result =
    executeDirectedAction?.(
      runtimeScenario,
      unit,
      turn,
      {
        actionType:
          UNIT_ACTIONS.RECON_BY_FIRE,
        targetHex:
          action.targetHex,
        executionMethod:
          action.executionMethod,
        moving,
      },
    );

  if (!result?.success) {
    action.internalState =
      DIRECTED_ACTION_STATES.READY;
    unit.command =
      result?.reason ??
      "화력수색 실행 대기";
    return null;
  }

  action.executionCount =
    (action.executionCount ?? 0) + 1;
  action.internalState =
    DIRECTED_ACTION_STATES.COMPLETED;

  const completed = {
    unit,
    actionType:
      UNIT_ACTIONS.RECON_BY_FIRE,
    targetHex: {
      ...action.targetHex,
    },
    executionMethod:
      action.executionMethod,
    result,
  };

  clearPersistentAction(unit);
  return completed;
}

function synchronizeTrackedFireTarget(
  runtimeScenario,
  unit,
  turn,
) {
  const fireControl =
    unit.fireControl;

  if (
    !fireControl?.targetHex ||
    !unit.turretControl
  ) {
    return false;
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

      fireControl.aiming =
        false;

      fireControl.aimStartedTurn =
        null;

      return false;
    }

    fireControl.targetHex = {
      column:
        target.column,

      row:
        target.row,
    };
  }

  const targetDirection =
    getDirectionBetween(
      unit,
      fireControl.targetHex,
    );

  const directionChanged =
    !areDirectionsAligned(
      unit.turretControl
        .targetDirection,
      targetDirection,
    );

  setTurretTargetDirection(
    unit,
    targetDirection,
  );

  if (
    directionChanged &&
    fireControl.fireCommandIssued ===
      true
  ) {
    fireControl.aiming =
      false;

    fireControl.aimStartedTurn =
      null;

    if (
      fireControl.loaded &&
      fireControl.procedureState !==
        FIRE_PROCEDURE_STATES
          .LOADING &&
      fireControl.procedureState !==
        FIRE_PROCEDURE_STATES
          .RELOADING
    ) {
      fireControl.procedureState =
        FIRE_PROCEDURE_STATES
          .TRAVERSING;

      fireControl.procedureTurn =
        turn;

      unit.command =
        "포탑 선회";
    }
  }

  return true;
}

function updateAdjustedFireAction(
  runtimeScenario,
  unit,
  turn,
  moving,
  fireControlFunctions,
) {
  if (
    unit.action?.type !==
      UNIT_ACTIONS.FIRE ||
    unit.fireControl?.state !==
      FIRE_STATES.ADJUST ||
    !unit.fireControl.targetHex
  ) {
    return null;
  }

  const {
    beginReloading,
    registerAdjustedShot,
  } = fireControlFunctions;

  const direction =
    getDirectionBetween(
      unit,
      unit.fireControl
        .targetHex,
    );

  setTurretTargetDirection(
    unit,
    direction,
  );

  const procedureState =
    unit.fireControl
      .procedureState;

  if (
    procedureState ===
      FIRE_PROCEDURE_STATES
        .ADJUSTING ||
    procedureState ===
      FIRE_PROCEDURE_STATES
        .FIRED
  ) {
    beginReloading?.(
      unit,
      turn,
    );

    return null;
  }

  if (
    procedureState !==
    FIRE_PROCEDURE_STATES
      .READY_TO_FIRE
  ) {
    return null;
  }

  const result =
    registerAdjustedShot?.(
      runtimeScenario,
      unit,
      turn,
      {
        moving,
      },
    );

  if (!result?.success) {
    return null;
  }

  beginReloading?.(
    unit,
    turn,
  );

  return {
    unit,
    result,
  };
}

export function processPersistentActions(
  runtimeScenario,
  turn,
  options = {},
) {
  const movingUnitIds =
    options.movingUnitIds ??
    new Set();

  const hunterKillerStates =
    options.hunterKillerStates ??
    HUNTER_KILLER_STATES;

  const fireControlFunctions = {
    updateFireProcedure:
      options.updateFireProcedure,

    beginReloading:
      options.beginReloading,

    registerAdjustedShot:
      options.registerAdjustedShot,

    acceptHunterKillerTarget:
      options.acceptHunterKillerTarget,

    executeDirectedAction:
      options.executeDirectedAction,
  };

  const adjustedShots =
    [];

  const completedDirectedActions =
    [];

  runtimeScenario.units
    .filter(
      (unit) =>
        unit.side ===
          "friendly" &&
        !unit.destroyed,
    )
    .forEach(
      (unit) => {
        const moving =
          movingUnitIds.has(
            unit.id,
          );

        const completedDirectedAction =
          updateReconByFireAction(
            runtimeScenario,
            unit,
            turn,
            moving,
            fireControlFunctions
              .executeDirectedAction,
          );

        if (completedDirectedAction) {
          completedDirectedActions.push(
            completedDirectedAction,
          );
        }

        const hunterKillerContext =
          updateHunterKillerTargeting(
            unit,
            runtimeScenario,
            hunterKillerStates,
          );

        synchronizeTrackedFireTarget(
          runtimeScenario,
          unit,
          turn,
        );

        updateTurretRotation(
          unit,
          {
            moving,
          },
        );

        fireControlFunctions
          .updateFireProcedure?.(
            unit,
            turn,
          );

        synchronizeCrewObservationDirections(
          unit,
          turn,
        );

        updateCommanderSightRotation(
          unit,
          turn,
        );

        processHunterKillerHandoff(
          unit,
          turn,
          hunterKillerContext,
          fireControlFunctions
            .acceptHunterKillerTarget,
        );

        const adjustedShot =
          updateAdjustedFireAction(
            runtimeScenario,
            unit,
            turn,
            moving,
            fireControlFunctions,
          );

        if (adjustedShot) {
          adjustedShots.push(
            adjustedShot,
          );
        }
      },
    );

  return {
    adjustedShots,
    completedDirectedActions,
  };
}
