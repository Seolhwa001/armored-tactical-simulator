// ============================================================
// ATS PROJECT
// File      : src/engine/procedureCore.js
// Sprint    : 4
// Stage     : 2A - Generic Procedure Core
// Purpose   : Generic, turn-persistent procedure state machine.
//             No View/Fog/Detection/Contact/UI dependency.
// ============================================================

export const PROCEDURE_CORE_STATES = Object.freeze({
  IDLE: "idle",
  COMMAND: "command",
  PREPARE: "prepare",
  READY: "ready",
  EXECUTE: "execute",
  END: "end",
});

const VALID_TRANSITIONS = Object.freeze({
  [PROCEDURE_CORE_STATES.IDLE]: new Set([
    PROCEDURE_CORE_STATES.COMMAND,
  ]),
  [PROCEDURE_CORE_STATES.COMMAND]: new Set([
    PROCEDURE_CORE_STATES.PREPARE,
    PROCEDURE_CORE_STATES.END,
  ]),
  [PROCEDURE_CORE_STATES.PREPARE]: new Set([
    PROCEDURE_CORE_STATES.COMMAND,
    PROCEDURE_CORE_STATES.READY,
    PROCEDURE_CORE_STATES.END,
  ]),
  [PROCEDURE_CORE_STATES.READY]: new Set([
    PROCEDURE_CORE_STATES.COMMAND,
    PROCEDURE_CORE_STATES.PREPARE,
    PROCEDURE_CORE_STATES.EXECUTE,
    PROCEDURE_CORE_STATES.END,
  ]),
  [PROCEDURE_CORE_STATES.EXECUTE]: new Set([
    PROCEDURE_CORE_STATES.COMMAND,
    PROCEDURE_CORE_STATES.PREPARE,
    PROCEDURE_CORE_STATES.END,
  ]),
  [PROCEDURE_CORE_STATES.END]: new Set([
    PROCEDURE_CORE_STATES.IDLE,
    PROCEDURE_CORE_STATES.COMMAND,
  ]),
});

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function clampProgress(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function createProcedureCore({ turn = null } = {}) {
  return {
    state: PROCEDURE_CORE_STATES.IDLE,
    active: false,
    startedTurn: null,
    updatedTurn: finiteOrNull(turn),
    revision: 0,
    pendingAction: null,
    actionProgress: 0,
    lastEndReason: null,
    lastTransition: null,
  };
}

export function canTransitionProcedureCore(core, nextState) {
  if (
    !core ||
    !Object.values(PROCEDURE_CORE_STATES).includes(nextState)
  ) {
    return false;
  }

  if (core.state === nextState) {
    return true;
  }

  return VALID_TRANSITIONS[core.state]?.has(nextState) === true;
}

export function transitionProcedureCore(
  core,
  nextState,
  {
    turn = null,
    pendingAction = undefined,
    actionProgress = undefined,
    reason = null,
  } = {},
) {
  if (!canTransitionProcedureCore(core, nextState)) {
    return false;
  }

  const previousState = core.state;

  core.state = nextState;
  core.active =
    nextState !== PROCEDURE_CORE_STATES.IDLE &&
    nextState !== PROCEDURE_CORE_STATES.END;

  if (
    core.active &&
    core.startedTurn === null &&
    Number.isFinite(turn)
  ) {
    core.startedTurn = turn;
  }

  if (Number.isFinite(turn)) {
    core.updatedTurn = turn;
  }

  if (pendingAction !== undefined) {
    core.pendingAction = pendingAction;
  }

  if (actionProgress !== undefined) {
    core.actionProgress = clampProgress(actionProgress);
  }

  if (nextState === PROCEDURE_CORE_STATES.END) {
    core.pendingAction = null;
    core.actionProgress = 0;
    core.lastEndReason = reason ?? "ended";
  }

  if (nextState === PROCEDURE_CORE_STATES.IDLE) {
    core.startedTurn = null;
    core.pendingAction = null;
    core.actionProgress = 0;
  }

  core.revision += 1;
  core.lastTransition = {
    from: previousState,
    to: nextState,
    turn: finiteOrNull(turn),
    reason,
  };

  return true;
}

export function beginProcedureCore(
  core,
  { turn = null, pendingAction = "command" } = {},
) {
  return transitionProcedureCore(
    core,
    PROCEDURE_CORE_STATES.COMMAND,
    {
      turn,
      pendingAction,
      actionProgress: 0,
    },
  );
}

export function prepareProcedureCore(
  core,
  {
    turn = null,
    pendingAction = "prepare",
    actionProgress = 0,
  } = {},
) {
  return transitionProcedureCore(
    core,
    PROCEDURE_CORE_STATES.PREPARE,
    {
      turn,
      pendingAction,
      actionProgress,
    },
  );
}

export function markProcedureCoreReady(
  core,
  { turn = null } = {},
) {
  return transitionProcedureCore(
    core,
    PROCEDURE_CORE_STATES.READY,
    {
      turn,
      pendingAction: null,
      actionProgress: 1,
    },
  );
}

export function executeProcedureCore(
  core,
  { turn = null, pendingAction = "execute" } = {},
) {
  return transitionProcedureCore(
    core,
    PROCEDURE_CORE_STATES.EXECUTE,
    {
      turn,
      pendingAction,
      actionProgress: 0,
    },
  );
}

export function reviseProcedureCore(
  core,
  { turn = null, pendingAction = "revision" } = {},
) {
  if (
    !core ||
    core.state === PROCEDURE_CORE_STATES.IDLE ||
    core.state === PROCEDURE_CORE_STATES.END
  ) {
    return false;
  }

  return transitionProcedureCore(
    core,
    PROCEDURE_CORE_STATES.COMMAND,
    {
      turn,
      pendingAction,
      actionProgress: 0,
      reason: "revision",
    },
  );
}

export function cancelProcedureCore(
  core,
  { turn = null, reason = "cancelled" } = {},
) {
  if (!core || core.state === PROCEDURE_CORE_STATES.IDLE) {
    return false;
  }

  return transitionProcedureCore(
    core,
    PROCEDURE_CORE_STATES.END,
    { turn, reason },
  );
}

export function resetProcedureCore(
  core,
  { turn = null } = {},
) {
  if (!core || core.state !== PROCEDURE_CORE_STATES.END) {
    return false;
  }

  return transitionProcedureCore(
    core,
    PROCEDURE_CORE_STATES.IDLE,
    {
      turn,
      reason: "reset",
    },
  );
}

export function advanceProcedureCoreTurn(core, turn) {
  if (!core || !Number.isFinite(turn)) {
    return false;
  }

  core.updatedTurn = turn;
  return true;
}

export function updateProcedureCoreProgress(
  core,
  {
    turn = null,
    actionProgress,
    pendingAction = undefined,
  } = {},
) {
  if (
    !core ||
    core.state === PROCEDURE_CORE_STATES.IDLE ||
    core.state === PROCEDURE_CORE_STATES.END ||
    !Number.isFinite(actionProgress)
  ) {
    return false;
  }

  core.actionProgress = clampProgress(actionProgress);

  if (pendingAction !== undefined) {
    core.pendingAction = pendingAction;
  }

  if (Number.isFinite(turn)) {
    core.updatedTurn = turn;
  }

  return true;
}
