// src/engine/actions.js — 새 파일, 1~238행

import {
  DETECTION_STAGES,
  getHexDistance,
} from "./detection.js";

import {
  setTurretTargetDirection,
  unlockTurretFromHull,
  updateTurretRotation,
} from "./turretControl.js";

export const UNIT_ACTIONS = Object.freeze({
  IDLE: "idle",
  MOVE: "move",
  OBSERVE: "observe",
  RECON: "recon",
  RECON_BY_FIRE: "recon-by-fire",
  FIRE: "fire",
  TURRET_STOW: "turret-stow",
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

export function setPersistentAction(
  unit,
  action,
  turn = 1,
) {
  unit.action = {
    type:
      action.type ??
      UNIT_ACTIONS.IDLE,

    targetHex:
      action.targetHex
        ? {
            column:
              action.targetHex.column,

            row:
              action.targetHex.row,
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

    startedTurn: turn,
    persistent: true,
  };

  unit.command =
    action.label ??
    unit.command;

  if (
    unit.turretControl &&
    Number.isFinite(
      action.direction,
    )
  ) {
    unlockTurretFromHull(unit);

    setTurretTargetDirection(
      unit,
      action.direction,
    );
  }

  return unit.action;
}

export function clearPersistentAction(
  unit,
) {
  unit.action = {
    type: UNIT_ACTIONS.IDLE,
    targetHex: null,
    targetUnitId: null,
    direction: null,
    startedTurn: null,
    persistent: true,
  };

  unit.command = "대기";
}

export function applyReconByFire(
  runtimeScenario,
  attacker,
  targetHex,
  turn,
) {
  const direction =
    getDirectionBetween(
      attacker,
      targetHex,
    );

  setPersistentAction(
    attacker,
    {
      type:
        UNIT_ACTIONS.RECON_BY_FIRE,

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
          enemy.temporaryExposure ??
            0,
          exposure,
        );

      enemy.exposedUntilTurn =
        Math.max(
          enemy.exposedUntilTurn ??
            0,
          turn + 2,
        );

      const revealChance =
        Math.min(
          0.9,
          0.3 +
            exposure / 100,
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

function updateObservationAction(
  unit,
) {
  if (
    unit.action?.type !==
      UNIT_ACTIONS.OBSERVE ||
    !Number.isFinite(
      unit.action.direction,
    )
  ) {
    return;
  }

  setTurretTargetDirection(
    unit,
    unit.action.direction,
  );
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
  unit,
  turn,
  moving,
  canFire,
) {
  if (
    unit.action?.type !==
      UNIT_ACTIONS.FIRE ||
    unit.fireControl?.state !==
      "adjust" ||
    !unit.fireControl.targetHex
  ) {
    return;
  }

  const direction =
    getDirectionBetween(
      unit,
      unit.fireControl.targetHex,
    );

  setTurretTargetDirection(
    unit,
    direction,
  );

  const permission =
    canFire(
      unit,
      {
        moving,
      },
    );

  if (!permission.allowed) {
    return;
  }

  unit.fireControl.roundsFired += 1;
  unit.fireControl.lastFiredTurn =
    turn;
  unit.fireControl.loading = true;
}

export function processPersistentActions(
  runtimeScenario,
  turn,
  options = {},
) {
  const movingUnitIds =
    options.movingUnitIds ??
    new Set();

  const canFire =
    options.canFire ??
    (() => ({
      allowed: false,
    }));

  runtimeScenario.units
    .filter(
      (unit) =>
        unit.side ===
          "friendly" &&
        !unit.destroyed,
    )
    .forEach((unit) => {
      const moving =
        movingUnitIds.has(
          unit.id,
        );

      if (
        unit.turretControl
          ?.lockedToHull
      ) {
        unit.turretControl
          .targetDirection =
          unit.hullDirection ??
          0;
      }

      updateObservationAction(
        unit,
      );

      updateReconByFireAction(
        runtimeScenario,
        unit,
        turn,
      );

      updateAdjustedFireAction(
        unit,
        turn,
        moving,
        canFire,
      );

      updateTurretRotation(
        unit,
        {
          moving,
        },
      );
    });
}
