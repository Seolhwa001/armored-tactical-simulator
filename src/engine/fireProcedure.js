// ============================================================
// ATS PROJECT
// File      : src/engine/fireProcedure.js
// Sprint    : 4
// Stage     : 1 - Fire Procedure minimum contract
// Purpose   : Runtime-owned Fire Procedure contract independent
//             from Detection / Contact implementation.
// ============================================================

import {
  PROCEDURE_CORE_STATES,
  advanceProcedureCoreTurn,
  beginProcedureCore,
  cancelProcedureCore,
  createProcedureCore,
  prepareProcedureCore,
  transitionProcedureCore,
} from "./procedureCore.js";

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

export const TARGET_REFERENCE_SOURCES = Object.freeze({
  MOCK: "mock",
  CONTACT: "contact",
  TERRAIN: "terrain",
});


function getCoreStateForFireState(state) {
  switch (state) {
    case FIRE_PROCEDURE_STATES.STOPPED:
      return PROCEDURE_CORE_STATES.IDLE;

    case FIRE_PROCEDURE_STATES.TARGET_DESIGNATED:
    case FIRE_PROCEDURE_STATES.FIRE_COMMAND:
      return PROCEDURE_CORE_STATES.COMMAND;

    case FIRE_PROCEDURE_STATES.LOADING:
    case FIRE_PROCEDURE_STATES.TRAVERSING:
    case FIRE_PROCEDURE_STATES.AIMING:
    case FIRE_PROCEDURE_STATES.RELOADING:
    case FIRE_PROCEDURE_STATES.ADJUSTING:
      return PROCEDURE_CORE_STATES.PREPARE;

    case FIRE_PROCEDURE_STATES.READY_TO_FIRE:
      return PROCEDURE_CORE_STATES.READY;

    case FIRE_PROCEDURE_STATES.FIRED:
      return PROCEDURE_CORE_STATES.EXECUTE;

    default:
      return null;
  }
}

function synchronizeProcedureCore(
  procedure,
  fireState,
  turn = null,
) {
  const core = procedure?.core;
  const nextCoreState = getCoreStateForFireState(fireState);

  if (!core || !nextCoreState) {
    return false;
  }

  if (core.state === nextCoreState) {
    if (Number.isFinite(turn)) {
      advanceProcedureCoreTurn(core, turn);
    }
    return true;
  }

  if (
    core.state === PROCEDURE_CORE_STATES.IDLE &&
    nextCoreState === PROCEDURE_CORE_STATES.COMMAND
  ) {
    return beginProcedureCore(core, { turn });
  }

  if (
    nextCoreState === PROCEDURE_CORE_STATES.PREPARE &&
    core.state !== PROCEDURE_CORE_STATES.END
  ) {
    if (core.state === PROCEDURE_CORE_STATES.IDLE) {
      beginProcedureCore(core, { turn });
    }

    return prepareProcedureCore(core, { turn });
  }

  if (nextCoreState === PROCEDURE_CORE_STATES.IDLE) {
    advanceProcedureCoreTurn(core, turn);
    return true;
  }

  return transitionProcedureCore(
    core,
    nextCoreState,
    { turn },
  );
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function clonePosition(position) {
  if (
    !position ||
    !Number.isFinite(position.column) ||
    !Number.isFinite(position.row)
  ) {
    return null;
  }

  return {
    column: position.column,
    row: position.row,
  };
}

export function createTargetReference({
  id = null,
  source = TARGET_REFERENCE_SOURCES.MOCK,
  position = null,
  direction = null,
  distance = null,
  estimatedType = "unknown",
  confidence = null,
  valid = true,
} = {}) {
  return {
    id,
    source,
    position: clonePosition(position),
    direction: finiteOrNull(direction),
    distance: finiteOrNull(distance),
    estimatedType,
    confidence,
    valid: valid === true,
  };
}

export function createMockTargetReference(options = {}) {
  return createTargetReference({
    id: options.id ?? "mock-target",
    source: TARGET_REFERENCE_SOURCES.MOCK,
    position: options.position ?? { column: 0, row: 0 },
    direction: options.direction ?? 0,
    distance: options.distance ?? 1,
    estimatedType: options.estimatedType ?? "unknown",
    confidence: options.confidence ?? "high",
    valid: options.valid ?? true,
  });
}

export function isValidTargetReference(target) {
  return Boolean(
    target?.valid === true &&
    target.position &&
    Number.isFinite(target.position.column) &&
    Number.isFinite(target.position.row),
  );
}

export function createWeaponState({
  weaponId = "main-gun",
  ammunition = null,
  loadedAmmunition = null,
  loadingAmmunition = null,
  loaded = false,
  loading = false,
  available = true,
  ammunitionRemaining = null,
} = {}) {
  return {
    weaponId,
    ammunition,
    loadedAmmunition,
    loadingAmmunition,
    loaded: loaded === true,
    loading: loading === true,
    available: available === true,
    ammunitionRemaining:
      Number.isFinite(ammunitionRemaining)
        ? Math.max(0, ammunitionRemaining)
        : null,
  };
}

export function createCrewState({
  assignedCrewRole = null,
  available = true,
  currentTask = null,
  targetConfirmed = false,
  aiming = false,
  loading = false,
} = {}) {
  return {
    assignedCrewRole,
    available: available === true,
    currentTask,
    targetConfirmed: targetConfirmed === true,
    aiming: aiming === true,
    loading: loading === true,
  };
}

export function createTurnTimeState({
  currentTurn = null,
  actionProgress = 0,
  pendingAction = null,
} = {}) {
  return {
    currentTurn:
      Number.isFinite(currentTurn)
        ? currentTurn
        : null,
    actionProgress:
      Number.isFinite(actionProgress)
        ? Math.max(0, actionProgress)
        : 0,
    pendingAction,
  };
}

export function createFireProcedure({
  turn = null,
} = {}) {
  return {
    state: FIRE_PROCEDURE_STATES.STOPPED,
    core: createProcedureCore({ turn }),
    startedTurn: null,
    updatedTurn:
      Number.isFinite(turn) ? turn : null,
    active: false,

    target: null,
    targetQueue: [],

    weapon: createWeaponState(),
    crew: createCrewState(),
    time: createTurnTimeState({ currentTurn: turn }),

    fireMode: null,
    roundsUsed: 0,
    lastEndReason: null,
  };
}

export function setFireProcedureState(
  procedure,
  state,
  turn = null,
) {
  if (!procedure || !Object.values(FIRE_PROCEDURE_STATES).includes(state)) {
    return false;
  }

  procedure.state = state;
  procedure.active = state !== FIRE_PROCEDURE_STATES.STOPPED;

  if (
    procedure.active &&
    procedure.startedTurn === null &&
    Number.isFinite(turn)
  ) {
    procedure.startedTurn = turn;
  }

  if (Number.isFinite(turn)) {
    procedure.updatedTurn = turn;
    procedure.time.currentTurn = turn;
  }

  synchronizeProcedureCore(
    procedure,
    state,
    turn,
  );

  return true;
}

export function setFireProcedureTarget(
  procedure,
  target,
  turn = null,
) {
  if (!procedure || !isValidTargetReference(target)) {
    return false;
  }

  procedure.target = createTargetReference(target);
  setFireProcedureState(
    procedure,
    FIRE_PROCEDURE_STATES.TARGET_DESIGNATED,
    turn,
  );
  return true;
}

export function advanceFireProcedureTurn(
  procedure,
  turn,
) {
  if (!procedure || !Number.isFinite(turn)) {
    return false;
  }

  // Stage 1 contract: a turn change updates time only. It must never
  // clear the target, current state, queue or progress by itself.
  procedure.updatedTurn = turn;
  procedure.time.currentTurn = turn;
  advanceProcedureCoreTurn(
    procedure.core,
    turn,
  );
  return true;
}

export function endFireProcedure(
  procedure,
  reason = "cease-fire",
  turn = null,
) {
  if (!procedure) {
    return false;
  }

  procedure.active = false;
  procedure.state = FIRE_PROCEDURE_STATES.STOPPED;
  procedure.target = null;
  procedure.targetQueue = [];
  procedure.fireMode = null;
  procedure.lastEndReason = reason;

  if (
    procedure.core?.state !== PROCEDURE_CORE_STATES.IDLE &&
    procedure.core?.state !== PROCEDURE_CORE_STATES.END
  ) {
    cancelProcedureCore(
      procedure.core,
      {
        turn,
        reason,
      },
    );
  }

  if (Number.isFinite(turn)) {
    procedure.updatedTurn = turn;
    procedure.time.currentTurn = turn;
  }

  return true;
}
