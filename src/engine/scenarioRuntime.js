// src/engine/scenarioRuntime.js — 전체 교체, 1~1018행

import {
  createScenario,
  getDefaultScenario,
} from "./scenario.js";

export const DETECTION_STAGES = Object.freeze({
  HIDDEN: 0,
  CONTACT: 1,
  DETECTED: 2,
  IDENTIFIED: 3,
});

export const UNIT_ACTIONS = Object.freeze({
  IDLE: "idle",
  MOVE: "move",
  OBSERVE: "observe",
  RECON: "recon",
  RECON_BY_FIRE: "recon-by-fire",
  FIRE: "fire",
  TURRET_STOW: "turret-stow",
});

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

const DEFAULT_RANDOMIZATION = Object.freeze({
  minimumFriendlyEnemyDistance: 8,
  maximumPlacementAttempts: 300,
});

const TURRET_ALIGNMENT_TOLERANCE =
  Math.PI / 36;

function normalizeAngle(angle) {
  let normalized =
    angle % (Math.PI * 2);

  if (normalized > Math.PI) {
    normalized -=
      Math.PI * 2;
  }

  if (normalized < -Math.PI) {
    normalized +=
      Math.PI * 2;
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
    return normalizeAngle(
      target,
    );
  }

  return normalizeAngle(
    current +
      Math.sign(difference) *
        maximumStep,
  );
}

function getDirectionBetween(
  observer,
  target,
) {
  const deltaColumn =
    target.column -
    observer.column;

  const deltaRow =
    target.row -
    observer.row;

  return Math.atan2(
    deltaRow,
    deltaColumn,
  );
}

function createTurretControl(
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

    aligned:
      true,

    rotating:
      false,

    warning: null,

    movingTrackingFactor:
      settings.movingTrackingFactor,

    movingFirePenalty:
      settings.movingFirePenalty,
  };
}

function createRuntimeUnit(
  unitData,
) {
  const friendly =
    unitData.side ===
    "friendly";

  const isTank =
    unitData.type ===
    "tank";

  const baseConcealment =
    unitData.concealment ??
    0;

  const turretDirection =
    unitData.turretDirection ??
    unitData.hullDirection ??
    0;

  return {
    ...unitData,

    condition: "정상",
    command: "대기",
    destroyed: false,

    destination: null,
    plannedPath: [],
    movementHistory: [],

    hullDirection:
      unitData.hullDirection ??
      0,

    turretDirection,

    direction:
      unitData.hullDirection ??
      0,

    detectionStage: friendly
      ? DETECTION_STAGES.IDENTIFIED
      : DETECTION_STAGES.HIDDEN,

    visible: friendly,
    detected: friendly,
    identified: friendly,

    lastKnownPosition: null,

    detectionConfidence:
      friendly
        ? 100
        : 0,

    baseConcealment,
    concealment:
      baseConcealment,

    temporaryExposure: 0,
    exposedUntilTurn: null,

    hatchState:
      isTank
        ? "open"
        : null,

    sensors: isTank
      ? {
          surroundingRecon:
            unitData
              .surroundingRecon ??
            75,

          directionalObservation:
            unitData
              .directionalObservation ??
            55,
        }
      : {
          surroundingRecon:
            unitData.observation ??
            50,

          directionalObservation:
            unitData.observation ??
            50,
        },

    action: {
      type:
        UNIT_ACTIONS.IDLE,

      targetHex: null,
      targetUnitId: null,
      direction: null,

      startedTurn: 1,
      persistent: true,
    },

    fireControl: isTank
      ? {
          state:
            FIRE_STATES.STOPPED,

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
        }
      : null,

    turretControl: isTank
      ? createTurretControl(
          unitData,
        )
      : null,

    protection: isTank
      ? {
          explosionResistance: 25,
          opticsCondition: "정상",
        }
      : {
          explosionResistance: 5,
          opticsCondition: null,
        },
  };
}

function createRuntimeEvent(
  eventData,
) {
  return {
    ...eventData,

    active: false,
    completed: false,
    triggeredTurn: null,
  };
}

function cloneScenarioSource(
  scenarioId,
) {
  return scenarioId
    ? createScenario(
        scenarioId,
      )
    : getDefaultScenario();
}

export function loadScenario(
  scenarioId = null,
) {
  const source =
    cloneScenarioSource(
      scenarioId,
    );

  return {
    id: source.id,
    name: source.name,

    description:
      source.description,

    objectives: [
      ...source.objectives,
    ],

    units: [
      ...source.playerUnits,
      ...source.enemyUnits,
    ].map(
      createRuntimeUnit,
    ),

    events: (
      source.events ?? []
    ).map(
      createRuntimeEvent,
    ),

    victoryConditions:
      structuredClone(
        source
          .victoryConditions ??
          [],
      ),

    failureConditions:
      structuredClone(
        source
          .failureConditions ??
          [],
      ),

    status: "running",

    turn: 1,
    startedTurn: 1,
    completedTurn: null,
  };
}

export function restartScenario(
  runtimeScenario,
  options = {},
) {
  const restarted =
    loadScenario(
      runtimeScenario.id,
    );

  if (
    Array.isArray(
      options.availableHexes,
    ) &&
    options.availableHexes
      .length > 0
  ) {
    randomizeScenarioPositions(
      restarted,
      options.availableHexes,
      options,
    );
  }

  return restarted;
}

export function getPlayerUnit(
  runtimeScenario,
) {
  return runtimeScenario.units.find(
    (unit) =>
      unit.side ===
        "friendly" &&
      unit.role ===
        "player",
  );
}

export function getFriendlyUnits(
  runtimeScenario,
) {
  return runtimeScenario.units.filter(
    (unit) =>
      unit.side ===
      "friendly",
  );
}

export function getEnemyUnits(
  runtimeScenario,
) {
  return runtimeScenario.units.filter(
    (unit) =>
      unit.side ===
      "enemy",
  );
}

export function getUnitById(
  runtimeScenario,
  unitId,
) {
  return runtimeScenario.units.find(
    (unit) =>
      unit.id ===
      unitId,
  );
}

function offsetToAxial(
  column,
  row,
) {
  return {
    q:
      column -
      (
        row -
        (row & 1)
      ) /
        2,

    r: row,
  };
}

export function getHexDistance(
  first,
  second,
) {
  const a =
    offsetToAxial(
      first.column,
      first.row,
    );

  const b =
    offsetToAxial(
      second.column,
      second.row,
    );

  const deltaQ =
    a.q - b.q;

  const deltaR =
    a.r - b.r;

  return (
    Math.abs(deltaQ) +
    Math.abs(deltaR) +
    Math.abs(
      deltaQ + deltaR,
    )
  ) / 2;
}

function isInsideObservationArc(
  observer,
  target,
  arcRadians =
    Math.PI / 2,
) {
  const actionDirection =
    observer.action
      ?.direction;

  if (
    observer.action?.type !==
      UNIT_ACTIONS.OBSERVE ||
    !Number.isFinite(
      actionDirection,
    )
  ) {
    return false;
  }

  const targetDirection =
    getDirectionBetween(
      observer,
      target,
    );

  const difference =
    Math.abs(
      normalizeAngle(
        targetDirection -
          actionDirection,
      ),
    );

  return (
    difference <=
    arcRadians / 2
  );
}

function getObserverRange(
  observer,
  enemy,
) {
  const defaultRange =
    observer.detectionRange ??
    observer.sensors
      ?.surroundingRecon /
      10 ??
    7;

  let range =
    defaultRange;

  if (
    observer.action?.type ===
    UNIT_ACTIONS.RECON
  ) {
    range +=
      Math.max(
        2,
        observer.sensors
          ?.surroundingRecon /
          25 ??
          2,
      );
  }

  if (
    isInsideObservationArc(
      observer,
      enemy,
    )
  ) {
    range +=
      Math.max(
        3,
        observer.sensors
          ?.directionalObservation /
          18 ??
          3,
      );
  }

  return range;
}

function getEffectiveConcealment(
  enemy,
  turn,
) {
  const exposureActive =
    enemy.exposedUntilTurn !==
      null &&
    enemy.exposedUntilTurn >=
      turn;

  const exposure =
    exposureActive
      ? enemy
          .temporaryExposure ??
        0
      : 0;

  return Math.max(
    0,
    (
      enemy.concealment ??
      0
    ) - exposure,
  );
}

function getDetectionStage(
  observer,
  enemy,
  distance,
  turn,
) {
  const baseRange =
    getObserverRange(
      observer,
      enemy,
    );

  const concealment =
    getEffectiveConcealment(
      enemy,
      turn,
    );

  const concealmentPenalty =
    concealment / 25;

  const effectiveRange =
    Math.max(
      2,
      baseRange -
        concealmentPenalty,
    );

  if (
    distance <=
    Math.max(
      1,
      effectiveRange *
        0.45,
    )
  ) {
    return DETECTION_STAGES.IDENTIFIED;
  }

  if (
    distance <=
    Math.max(
      2,
      effectiveRange *
        0.75,
    )
  ) {
    return DETECTION_STAGES.DETECTED;
  }

  if (
    distance <=
    effectiveRange
  ) {
    return DETECTION_STAGES.CONTACT;
  }

  return DETECTION_STAGES.HIDDEN;
}

export function updateDetection(
  runtimeScenario,
  turn =
    runtimeScenario.turn ??
    1,
) {
  const friendlies =
    getFriendlyUnits(
      runtimeScenario,
    ).filter(
      (unit) =>
        !unit.destroyed,
    );

  const enemies =
    getEnemyUnits(
      runtimeScenario,
    ).filter(
      (unit) =>
        !unit.destroyed,
    );

  enemies.forEach(
    (enemy) => {
      let bestStage =
        DETECTION_STAGES.HIDDEN;

      let bestDistance =
        Infinity;

      friendlies.forEach(
        (observer) => {
          const distance =
            getHexDistance(
              observer,
              enemy,
            );

          const stage =
            getDetectionStage(
              observer,
              enemy,
              distance,
              turn,
            );

          if (
            stage > bestStage ||
            (
              stage ===
                bestStage &&
              distance <
                bestDistance
            )
          ) {
            bestStage =
              stage;

            bestDistance =
              distance;
          }
        },
      );

      enemy.detectionStage =
        bestStage;

      enemy.visible =
        bestStage >=
        DETECTION_STAGES.CONTACT;

      enemy.detected =
        bestStage >=
        DETECTION_STAGES.DETECTED;

      enemy.identified =
        bestStage >=
        DETECTION_STAGES.IDENTIFIED;

      enemy.detectionConfidence = [
        0,
        35,
        70,
        100,
      ][bestStage];

      if (
        bestStage !==
        DETECTION_STAGES.HIDDEN
      ) {
        enemy.lastKnownPosition = {
          column:
            enemy.column,

          row:
            enemy.row,
        };
      }

      if (
        enemy.exposedUntilTurn !==
          null &&
        enemy.exposedUntilTurn <
          turn
      ) {
        enemy.temporaryExposure =
          0;

        enemy.exposedUntilTurn =
          null;
      }
    },
  );

  return enemies;
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
    unlockTurretFromHull(
      unit,
    );

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
    type:
      UNIT_ACTIONS.IDLE,

    targetHex: null,
    targetUnitId: null,
    direction: null,

    startedTurn: null,
    persistent: true,
  };

  unit.command = "대기";
}

function clearTurretTrackingActions(
  unit,
) {
  if (
    unit.action?.type ===
      UNIT_ACTIONS.OBSERVE ||
    unit.action?.type ===
      UNIT_ACTIONS.RECON_BY_FIRE ||
    unit.action?.type ===
      UNIT_ACTIONS.FIRE
  ) {
    clearPersistentAction(
      unit,
    );
  }

  if (
    unit.fireControl
  ) {
    unit.fireControl.state =
      FIRE_STATES.STOPPED;

    unit.fireControl.targetHex =
      null;

    unit.fireControl.targetUnitId =
      null;

    unit.fireControl
      .gunnerAutonomous =
      false;

    unit.fireControl.loading =
      false;
  }
}

export function setTurretMode(
  unit,
  mode,
) {
  if (
    !unit.turretControl ||
    !TURRET_MODE_SETTINGS[
      mode
    ]
  ) {
    return {
      success: false,
      reason:
        "포탑 구동 모드를 변경할 수 없습니다.",
    };
  }

  const settings =
    TURRET_MODE_SETTINGS[
      mode
    ];

  unit.turretControl.mode =
    mode;

  unit.turretControl
    .traverseSpeed =
    settings.traverseSpeed;

  unit.turretControl
    .movingTrackingFactor =
    settings
      .movingTrackingFactor;

  unit.turretControl
    .movingFirePenalty =
    settings
      .movingFirePenalty;

  unit.turretControl.warning =
    null;

  if (
    mode ===
    TURRET_MODES.NORMAL
  ) {
    if (
      !unit.turretControl
        .driveOperational
    ) {
      unit.turretControl.warning =
        "포탑 구동장치 고장";
    }
  }

  if (
    mode ===
    TURRET_MODES.EMERGENCY
  ) {
    if (
      unit.turretControl
        .stabilizerOperational
    ) {
      unit.turretControl.warning =
        "안정화장치 정상 상태에서 비상구동 선택";
    }
  }

  if (
    mode ===
    TURRET_MODES.MANUAL
  ) {
    unit.turretControl.warning =
      "수동구동: 정지 상태에서만 포탑 회전 및 사격 가능";
  }

  updateFireAimStability(
    unit,
    false,
  );

  return {
    success: true,
    warning:
      unit.turretControl
        .warning,
  };
}

export function setTurretTargetDirection(
  unit,
  direction,
) {
  if (
    !unit.turretControl ||
    !Number.isFinite(
      direction,
    )
  ) {
    return false;
  }

  unit.turretControl
    .targetDirection =
    normalizeAngle(
      direction,
    );

  unit.turretControl.aligned =
    isTurretAligned(
      unit,
    );

  unit.turretControl.rotating =
    !unit.turretControl
      .aligned;

  return true;
}

export function unlockTurretFromHull(
  unit,
) {
  if (!unit.turretControl) {
    return false;
  }

  unit.turretControl
    .lockedToHull =
    false;

  return true;
}

export function commandMainGunStow(
  unit,
  turn = 1,
) {
  if (!unit.turretControl) {
    return {
      success: false,
      reason:
        "포탑 제어 기능이 없습니다.",
    };
  }

  clearTurretTrackingActions(
    unit,
  );

  unit.turretControl
    .lockedToHull =
    true;

  unit.turretControl
    .targetDirection =
    normalizeAngle(
      unit.hullDirection ??
        0,
    );

  unit.turretControl.aligned =
    isTurretAligned(
      unit,
      TURRET_ALIGNMENT_TOLERANCE,
    );

  unit.turretControl.rotating =
    !unit.turretControl
      .aligned;

  unit.action = {
    type:
      UNIT_ACTIONS.TURRET_STOW,

    targetHex: null,
    targetUnitId: null,

    direction:
      unit.turretControl
        .targetDirection,

    startedTurn: turn,
    persistent: true,
  };

  unit.command =
    "주포 정위치";

  return {
    success: true,
    completed:
      unit.turretControl
        .aligned,
  };
}

export function isTurretAligned(
  unit,
  tolerance =
    TURRET_ALIGNMENT_TOLERANCE,
) {
  if (!unit.turretControl) {
    return true;
  }

  const difference =
    Math.abs(
      getAngleDifference(
        unit.turretDirection ??
          0,

        unit.turretControl
          .targetDirection ??
          unit.turretDirection ??
          0,
      ),
    );

  return (
    difference <=
    tolerance
  );
}

export function getTurretStatus(
  unit,
) {
  if (!unit.turretControl) {
    return null;
  }

  return {
    mode:
      unit.turretControl.mode,

    driveOperational:
      unit.turretControl
        .driveOperational,

    stabilizerOperational:
      unit.turretControl
        .stabilizerOperational,

    stabilizerAvailable:
      isStabilizerAvailable(
        unit,
      ),

    targetDirection:
      unit.turretControl
        .targetDirection,

    traverseSpeed:
      unit.turretControl
        .traverseSpeed,

    lockedToHull:
      unit.turretControl
        .lockedToHull,

    aligned:
      isTurretAligned(
        unit,
      ),

    rotating:
      unit.turretControl
        .rotating,

    warning:
      unit.turretControl
        .warning,
  };
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

function getTurretTraverseStep(
  unit,
  moving,
) {
  if (!unit.turretControl) {
    return 0;
  }

  const control =
    unit.turretControl;

  if (
    control.mode ===
      TURRET_MODES.NORMAL &&
    !control
      .driveOperational
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
      control
        .movingTrackingFactor;
  }

  return Math.max(
    0,
    step,
  );
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

  if (
    control.lockedToHull
  ) {
    control.targetDirection =
      normalizeAngle(
        unit.hullDirection ??
          0,
      );
  }

  const step =
    getTurretTraverseStep(
      unit,
      moving,
    );

  if (step <= 0) {
    control.aligned =
      isTurretAligned(
        unit,
      );

    control.rotating =
      !control.aligned;

    updateFireAimStability(
      unit,
      moving,
    );

    return {
      rotated: false,
      aligned:
        control.aligned,
      blocked: true,
    };
  }

  const previousDirection =
    unit.turretDirection ??
    0;

  unit.turretDirection =
    moveAngleToward(
      previousDirection,
      control.targetDirection,
      step,
    );

  control.aligned =
    isTurretAligned(
      unit,
    );

  control.rotating =
    !control.aligned;

  if (
    control.lockedToHull &&
    control.aligned
  ) {
    unit.command =
      "주포 정위치";
  }

  updateFireAimStability(
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
  };
}

function updateFireAimStability(
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
    mode ===
    TURRET_MODES.NORMAL
  ) {
    unit.fireControl
      .aimStability =
      isStabilizerAvailable(
        unit,
      )
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
    unit.fireControl
      .aimStability =
      moving
        ? 0.45
        : 0.72;

    return;
  }

  unit.fireControl
    .aimStability =
    moving
      ? 0
      : 0.4;
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

  if (
    !isTurretAligned(
      unit,
    )
  ) {
    return {
      allowed: false,
      reason:
        "포탑 정렬 중",
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
      unit.fireControl
        .aimStability,
  };
}

export function applyReconByFire(
  runtimeScenario,
  attacker,
  targetHex,
  turn,
) {
  unlockTurretFromHull(
    attacker,
  );

  setPersistentAction(
    attacker,
    {
      type:
        UNIT_ACTIONS.RECON_BY_FIRE,

      targetHex,

      direction:
        getDirectionBetween(
          attacker,
          targetHex,
        ),

      label:
        "화력수색",
    },
    turn,
  );

  const affectedEnemies =
    getEnemyUnits(
      runtimeScenario,
    ).filter(
      (enemy) =>
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
          Math.random() *
            31,
        );

      enemy.temporaryExposure =
        Math.max(
          enemy
            .temporaryExposure ??
            0,

          exposure,
        );

      enemy.exposedUntilTurn =
        Math.max(
          enemy
            .exposedUntilTurn ??
            0,

          turn + 2,
        );

      const revealChance =
        Math.min(
          0.9,
          0.3 +
            exposure /
              100,
        );

      if (
        Math.random() <
        revealChance
      ) {
        enemy.detectionStage =
          Math.max(
            enemy
              .detectionStage,

            DETECTION_STAGES.CONTACT,
          );

        enemy.visible = true;

        enemy.lastKnownPosition = {
          column:
            enemy.column,

          row:
            enemy.row,
        };
      }
    },
  );

  return affectedEnemies;
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

  unlockTurretFromHull(
    unit,
  );

  unit.fireControl.ammunition =
    ammunition ??
    unit.fireControl
      .ammunition;

  unit.fireControl.targetHex =
    target
      ? {
          column:
            target.column,

          row:
            target.row,
        }
      : null;

  unit.fireControl.targetUnitId =
    target?.unitId ??
    null;

  unit.fireControl.state =
    FIRE_STATES.READY;

  unit.fireControl.loading =
    true;

  if (target) {
    const direction =
      getDirectionBetween(
        unit,
        target,
      );

    setTurretTargetDirection(
      unit,
      direction,
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
    !unit.fireControl
      .targetHex
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
      reason:
        permission.reason,
    };
  }

  unit.fireControl.state =
    FIRE_STATES.SINGLE;

  unit.fireControl
    .roundsFired += 1;

  unit.fireControl
    .lastFiredTurn =
    turn;

  unit.fireControl
    .gunnerAutonomous =
    false;

  unit.fireControl.loading =
    true;

  unit.command = "쏴";

  return {
    success: true,

    aimStability:
      permission
        .aimStability,
  };
}

export function enableAdjustedFire(
  unit,
  turn,
  options = {},
) {
  if (
    !unit.fireControl ||
    !unit.fireControl
      .targetHex
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
      reason:
        permission.reason,
    };
  }

  unit.fireControl.state =
    FIRE_STATES.ADJUST;

  unit.fireControl
    .roundsFired += 1;

  unit.fireControl
    .lastFiredTurn =
    turn;

  unit.fireControl
    .gunnerAutonomous =
    true;

  unit.fireControl.loading =
    true;

  unit.command =
    "쏴-수정";

  unlockTurretFromHull(
    unit,
  );

  setPersistentAction(
    unit,
    {
      type:
        UNIT_ACTIONS.FIRE,

      targetHex:
        unit.fireControl
          .targetHex,

      targetUnitId:
        unit.fireControl
          .targetUnitId,

      direction:
        getDirectionBetween(
          unit,
          unit.fireControl
            .targetHex,
        ),

      label:
        "쏴-수정",
    },
    turn,
  );

  return {
    success: true,

    aimStability:
      permission
        .aimStability,
  };
}

export function ceaseFire(
  unit,
) {
  if (!unit.fireControl) {
    return false;
  }

  unit.fireControl.state =
    FIRE_STATES.STOPPED;

  unit.fireControl.targetHex =
    null;

  unit.fireControl.targetUnitId =
    null;

  unit.fireControl
    .gunnerAutonomous =
    false;

  unit.fireControl.loading =
    false;

  if (
    unit.action?.type ===
      UNIT_ACTIONS.FIRE ||
    unit.action?.type ===
      UNIT_ACTIONS.RECON_BY_FIRE
  ) {
    clearPersistentAction(
      unit,
    );
  }

  unit.command =
    "사격 그만";

  return true;
}

export function processPersistentActions(
  runtimeScenario,
  turn,
  options = {},
) {
  const movingUnitIds =
    options.movingUnitIds ??
    new Set();

  const friendlies =
    getFriendlyUnits(
      runtimeScenario,
    ).filter(
      (unit) =>
        !unit.destroyed,
    );

  friendlies.forEach(
    (unit) => {
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
          normalizeAngle(
            unit.hullDirection ??
              0,
          );
      }

      if (
        unit.action?.type ===
          UNIT_ACTIONS.OBSERVE &&
        Number.isFinite(
          unit.action.direction,
        )
      ) {
        setTurretTargetDirection(
          unit,
          unit.action.direction,
        );
      }

      if (
        unit.action?.type ===
          UNIT_ACTIONS.RECON_BY_FIRE &&
        unit.action.targetHex
      ) {
        const direction =
          getDirectionBetween(
            unit,
            unit.action
              .targetHex,
          );

        setTurretTargetDirection(
          unit,
          direction,
        );

        applyReconByFire(
          runtimeScenario,
          unit,
          unit.action
            .targetHex,
          turn,
        );
      }

      if (
        unit.action?.type ===
          UNIT_ACTIONS.FIRE &&
        unit.fireControl
          ?.state ===
          FIRE_STATES.ADJUST &&
        unit.fireControl
          .targetHex
      ) {
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

        const permission =
          canTurretFire(
            unit,
            {
              moving,
            },
          );

        if (
          permission.allowed
        ) {
          unit.fireControl
            .roundsFired += 1;

          unit.fireControl
            .lastFiredTurn =
            turn;

          unit.fireControl
            .loading =
            true;
        }
      }

      updateTurretRotation(
        unit,
        {
          moving,
        },
      );
    },
  );
}

function getRandomItem(items) {
  return items[
    Math.floor(
      Math.random() *
        items.length,
    )
  ];
}

function isHexOccupied(
  occupied,
  hex,
) {
  return occupied.has(
    `${hex.column},${hex.row}`,
  );
}

function reserveHex(
  occupied,
  hex,
) {
  occupied.add(
    `${hex.column},${hex.row}`,
  );
}

function getRandomValidHex({
  availableHexes,
  occupied,
  validator,
  maximumAttempts,
}) {
  for (
    let attempt = 0;
    attempt <
    maximumAttempts;
    attempt += 1
  ) {
    const candidate =
      getRandomItem(
        availableHexes,
      );

    if (
      !candidate ||
      isHexOccupied(
        occupied,
        candidate,
      )
    ) {
      continue;
    }

    if (
      validator &&
      !validator(
        candidate,
      )
    ) {
      continue;
    }

    return {
      column:
        candidate.column,

      row:
        candidate.row,
    };
  }

  return (
    availableHexes.find(
      (candidate) =>
        !isHexOccupied(
          occupied,
          candidate,
        ) &&
        (
          !validator ||
          validator(
            candidate,
          )
        ),
    ) ??
    null
  );
}

export function randomizeScenarioPositions(
  runtimeScenario,
  availableHexes,
  options = {},
) {
  const settings = {
    ...DEFAULT_RANDOMIZATION,
    ...options,
  };

  const validHexes =
    availableHexes.filter(
      (hex) =>
        hex &&
        Number.isFinite(
          hex.column,
        ) &&
        Number.isFinite(
          hex.row,
        ) &&
        hex.passable !==
          false,
    );

  if (
    validHexes.length <
    runtimeScenario.units
      .length
  ) {
    throw new Error(
      "객체를 배치할 수 있는 헥스가 부족합니다.",
    );
  }

  const occupied =
    new Set();

  const friendlies =
    getFriendlyUnits(
      runtimeScenario,
    );

  const enemies =
    getEnemyUnits(
      runtimeScenario,
    );

  friendlies.forEach(
    (unit) => {
      const position =
        getRandomValidHex({
          availableHexes:
            validHexes,

          occupied,

          maximumAttempts:
            settings
              .maximumPlacementAttempts,
        });

      if (!position) {
        throw new Error(
          "아군 객체 위치 랜덤화에 실패했습니다.",
        );
      }

      unit.column =
        position.column;

      unit.row =
        position.row;

      unit.destination =
        null;

      unit.plannedPath =
        [];

      unit.movementHistory =
        [];

      reserveHex(
        occupied,
        position,
      );
    },
  );

  enemies.forEach(
    (unit) => {
      const position =
        getRandomValidHex({
          availableHexes:
            validHexes,

          occupied,

          maximumAttempts:
            settings
              .maximumPlacementAttempts,

          validator:
            (candidate) =>
              friendlies.every(
                (friendly) =>
                  getHexDistance(
                    candidate,
                    friendly,
                  ) >=
                  settings
                    .minimumFriendlyEnemyDistance,
              ),
        });

      if (!position) {
        throw new Error(
          "적 객체 위치 랜덤화에 실패했습니다.",
        );
      }

      unit.column =
        position.column;

      unit.row =
        position.row;

      unit.destination =
        null;

      unit.plannedPath =
        [];

      unit.movementHistory =
        [];

      unit.detectionStage =
        DETECTION_STAGES.HIDDEN;

      unit.visible = false;
      unit.detected = false;
      unit.identified = false;

      unit.lastKnownPosition =
        null;

      unit.detectionConfidence =
        0;

      reserveHex(
        occupied,
        position,
      );
    },
  );

  return runtimeScenario;
}

export function isUnitVisible(
  unit,
  developerMode = false,
) {
  return (
    unit.side ===
      "friendly" ||
    developerMode ||
    unit.visible
  );
      }
