// src/engine/actions.js — 전체 교체, 예상 1~327행

import { UNIT_ACTIONS } from "./constants/actionConstants.js";
import { createIdleAction } from "./factories/actionFactory.js";
import {
  DETECTION_STAGES,
  getHexDistance,
} from "./detection.js";
import {
  isTurretAligned,
  setTurretTargetDirection,
  unlockTurretFromHull,
  updateTurretRotation,
} from "./turretControl.js";

export { UNIT_ACTIONS };

const FIRE_STATES = Object.freeze({
  ADJUST: "adjust",
});

const FIRE_PROCEDURE_STATES = Object.freeze({
  READY_TO_FIRE: "ready-to-fire",
  FIRED: "fired",
  ADJUSTING: "adjusting",
});

function getDirectionBetween(observer, target) {
  return Math.atan2(
    target.row - observer.row,
    target.column - observer.column,
  );
}

function isTurretTrackingAction(actionType) {
  return (
    actionType === UNIT_ACTIONS.RECON_BY_FIRE ||
    actionType === UNIT_ACTIONS.FIRE
  );
}

export function setPersistentAction(unit, action, turn = 1) {
  if (unit.destroyed) {
    return null;
  }

  unit.action = {
    type: action.type ?? UNIT_ACTIONS.IDLE,
    targetHex: action.targetHex
      ? {
          column: action.targetHex.column,
          row: action.targetHex.row,
        }
      : null,
    targetUnitId: action.targetUnitId ?? null,
    direction: Number.isFinite(action.direction)
      ? action.direction
      : null,
    crewRole: action.crewRole ?? null,
    startedTurn: turn,
    persistent: true,
  };

  unit.command = action.label ?? unit.command;

  if (
    unit.turretControl &&
    isTurretTrackingAction(unit.action.type) &&
    Number.isFinite(unit.action.direction)
  ) {
    unlockTurretFromHull(unit);
    setTurretTargetDirection(unit, unit.action.direction);
  }

  return unit.action;
}

export function clearPersistentAction(unit) {
  unit.action = createIdleAction();

  if (!unit.destroyed) {
    unit.command = "대기";
  }
}

export function setCrewObservationDirection(
  unit,
  crewRole,
  direction,
  turn = 1,
) {
  const observation = unit.crewObservation;
  const crew = observation?.observers?.[crewRole];

  if (
    unit.destroyed ||
    !crew ||
    !Number.isFinite(direction)
  ) {
    return false;
  }

  observation.activeCrewRole = crewRole;
  crew.direction = direction;

  unit.action = {
    type: UNIT_ACTIONS.OBSERVE,
    targetHex: null,
    targetUnitId: null,
    direction,
    crewRole,
    startedTurn: turn,
    persistent: true,
  };

  unit.command = `${crewRole} 감시`;

  return true;
}

export function setCommanderSightDirection(unit, direction) {
  const sight =
    unit.crewObservation?.commanderIndependentSight;

  if (
    unit.destroyed ||
    !sight?.operational ||
    !Number.isFinite(direction)
  ) {
    return false;
  }

  sight.direction = direction;
  sight.locked = false;
  sight.tracking = false;
  sight.targetUnitId = null;

  return true;
}

function isCommanderSightTarget(unit, targetUnit) {
  const sight =
    unit.crewObservation?.commanderIndependentSight;

  return (
    sight?.operational === true &&
    sight.tracking === true &&
    sight.targetUnitId === targetUnit.id
  );
}

function isCommanderSightDetection(unit, targetUnit) {
  return (
    targetUnit.detectedByUnitId === unit.id &&
    targetUnit.detectedByCrewRole === "commander-cps"
  );
}

function canDesignateHunterKillerTarget(unit, targetUnit) {
  if (
    !targetUnit ||
    targetUnit.destroyed ||
    targetUnit.side !== "enemy"
  ) {
    return false;
  }

  const hasContact =
    (targetUnit.detectionStage ?? DETECTION_STAGES.HIDDEN) >=
    DETECTION_STAGES.CONTACT;

  return (
    hasContact ||
    isCommanderSightTarget(unit, targetUnit) ||
    isCommanderSightDetection(unit, targetUnit)
  );
}

export function designateHunterKillerTarget(
  unit,
  targetUnit,
  hunterKillerStates,
) {
  const observation = unit.crewObservation;
  const hunterKiller = observation?.hunterKiller;
  const sight = observation?.commanderIndependentSight;

  if (
    unit.destroyed ||
    !hunterKiller?.enabled ||
    !sight?.operational ||
    !hunterKillerStates ||
    !canDesignateHunterKillerTarget(unit, targetUnit)
  ) {
    return false;
  }

  const direction = getDirectionBetween(unit, targetUnit);

  sight.direction = direction;
  sight.targetUnitId = targetUnit.id;
  sight.locked = true;
  sight.tracking = true;

  hunterKiller.state = hunterKillerStates.DESIGNATING;
  hunterKiller.detectedTargetUnitId = targetUnit.id;
  hunterKiller.designatedTargetUnitId = targetUnit.id;
  hunterKiller.handedOffTargetUnitId = null;

  unlockTurretFromHull(unit);
  setTurretTargetDirection(unit, direction);

  return true;
}

function clearHunterKillerTarget(
  hunterKiller,
  sight,
  hunterKillerStates,
) {
  hunterKiller.state = hunterKillerStates.SEARCHING;
  hunterKiller.detectedTargetUnitId = null;
  hunterKiller.designatedTargetUnitId = null;
  hunterKiller.handedOffTargetUnitId = null;

  if (sight) {
    sight.targetUnitId = null;
    sight.locked = false;
    sight.tracking = false;
  }
}

function updateHunterKiller(
  unit,
  runtimeScenario,
  turn,
  hunterKillerStates,
  acceptHunterKillerTarget,
) {
  const observation = unit.crewObservation;
  const hunterKiller = observation?.hunterKiller;
  const sight = observation?.commanderIndependentSight;

  if (
    unit.destroyed ||
    !hunterKiller?.enabled ||
    !hunterKillerStates
  ) {
    return;
  }

  const targetId = hunterKiller.designatedTargetUnitId;

  const target = runtimeScenario.units.find(
    (candidate) =>
      candidate.id === targetId &&
      !candidate.destroyed,
  );

  if (!target) {
    clearHunterKillerTarget(
      hunterKiller,
      sight,
      hunterKillerStates,
    );

    return;
  }

  const direction = getDirectionBetween(unit, target);

  if (sight) {
    sight.direction = direction;
    sight.targetUnitId = target.id;
    sight.locked = true;
    sight.tracking = true;
  }

  unlockTurretFromHull(unit);
  setTurretTargetDirection(unit, direction);

  if (
    hunterKiller.state ===
    hunterKillerStates.DESIGNATING
  ) {
    if (!isTurretAligned(unit)) {
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
      hunterKillerStates.HANDOFF;

    hunterKiller.handedOffTargetUnitId =
      target.id;

    return;
  }

  if (
    hunterKiller.state ===
    hunterKillerStates.HANDOFF
  ) {
    hunterKiller.state =
      hunterKillerStates.TRACKING;
  }
}

export function applyReconByFire(
  runtimeScenario,
  attacker,
  targetHex,
  turn,
) {
  if (attacker.destroyed) {
    return [];
  }

  const direction =
    getDirectionBetween(
      attacker,
      targetHex,
    );

  setPersistentAction(
    attacker,
    {
      type: UNIT_ACTIONS.RECON_BY_FIRE,
      targetHex,
      direction,
      label: "화력수색",
    },
    turn,
  );

  const affectedEnemies =
    runtimeScenario.units.filter(
      (enemy) =>
        enemy.side === "enemy" &&
        !enemy.destroyed &&
        getHexDistance(
          enemy,
          targetHex,
        ) <= 1,
    );

  affectedEnemies.forEach(
    (enemy) => {
      const exposure =
        25 +
        Math.floor(
          Math.random() * 31,
        );

      enemy.temporaryExposure =
        Math.max(
          enemy.temporaryExposure ?? 0,
          exposure,
        );

      enemy.exposedUntilTurn =
        Math.max(
          enemy.exposedUntilTurn ?? 0,
          turn + 2,
        );

      const revealChance =
        Math.min(
          0.9,
          0.3 + exposure / 100,
        );

      if (
        Math.random() <
        revealChance
      ) {
        enemy.detectionStage =
          Math.max(
            enemy.detectionStage,
            DETECTION_STAGES.CONTACT,
          );

        enemy.visible = true;

        enemy.lastKnownPosition = {
          column: enemy.column,
          row: enemy.row,
        };
      }
    },
  );

  return affectedEnemies;
}

function updateReconByFireAction(
  runtimeScenario,
  unit,
  turn,
) {
  if (
    unit.action?.type !==
      UNIT_ACTIONS.RECON_BY_FIRE ||
    !unit.action.targetHex
  ) {
    return;
  }

  const direction =
    getDirectionBetween(
      unit,
      unit.action.targetHex,
    );

  setTurretTargetDirection(
    unit,
    direction,
  );

  applyReconByFire(
    runtimeScenario,
    unit,
    unit.action.targetHex,
    turn,
  );
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
      unit.fireControl.targetHex,
    );

  setTurretTargetDirection(
    unit,
    direction,
  );

  const procedureState =
    unit.fireControl.procedureState;

  if (
    procedureState ===
      FIRE_PROCEDURE_STATES.ADJUSTING ||
    procedureState ===
      FIRE_PROCEDURE_STATES.FIRED
  ) {
    beginReloading?.(
      unit,
      turn,
    );

    return null;
  }

  if (
    procedureState !==
    FIRE_PROCEDURE_STATES.READY_TO_FIRE
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
    null;

  const fireControlFunctions = {
    updateFireProcedure:
      options.updateFireProcedure,

    beginReloading:
      options.beginReloading,

    registerAdjustedShot:
      options.registerAdjustedShot,

    acceptHunterKillerTarget:
      options.acceptHunterKillerTarget,
  };

  const adjustedShots = [];

  runtimeScenario.units
    .filter(
      (unit) =>
        unit.side === "friendly" &&
        !unit.destroyed,
    )
    .forEach((unit) => {
      const moving =
        movingUnitIds.has(
          unit.id,
        );

      updateHunterKiller(
        unit,
        runtimeScenario,
        turn,
        hunterKillerStates,
        fireControlFunctions
          .acceptHunterKillerTarget,
      );

      updateReconByFireAction(
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
    });

  return {
    adjustedShots,
  };
}
