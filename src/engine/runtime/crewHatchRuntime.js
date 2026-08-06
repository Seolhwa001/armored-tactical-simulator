// ============================================================
// ATS PROJECT
// File      : src/engine/runtime/crewHatchRuntime.js
// Sprint    : 4
// Purpose   : Persistent commander/loader hatch transition runtime
// ============================================================

import {
  CREW_ROLES,
  CREW_TASK_STATES,
  HATCH_STATES,
  TACTICAL_ACTION_TIME_KEYS,
  DEFAULT_TACTICAL_ACTION_SECONDS,
} from "../contracts/index.js";
import { synchronizeCrewVision } from "./crewVisionRuntime.js";

const HATCH_ROLES = new Set([
  CREW_ROLES.COMMANDER,
  CREW_ROLES.LOADER,
]);

function ensureRuntime(unit) {
  if (!unit.crewHatchActions) {
    unit.crewHatchActions = {
      [CREW_ROLES.COMMANDER]: null,
      [CREW_ROLES.LOADER]: null,
    };
  }
  return unit.crewHatchActions;
}

function getDuration(targetState, timings) {
  const key = targetState === HATCH_STATES.OPEN
    ? TACTICAL_ACTION_TIME_KEYS.HATCH_OPEN
    : TACTICAL_ACTION_TIME_KEYS.HATCH_CLOSE;
  return Math.max(0, Number(timings?.[key] ?? DEFAULT_TACTICAL_ACTION_SECONDS[key]));
}

function setObserverBusy(unit, role, busy) {
  const observer = unit.crewObservation?.observers?.[role];
  if (!observer) return;
  observer.observing = !busy;
  observer.crewTask = busy ? CREW_TASK_STATES.OPERATING_HATCH : CREW_TASK_STATES.OBSERVING;
}

export function beginCrewHatchTransition(unit, role, targetState, {
  turn = null,
  timings = DEFAULT_TACTICAL_ACTION_SECONDS,
} = {}) {
  if (!unit || unit.destroyed || !HATCH_ROLES.has(role) || !unit.crewHatches) {
    return { success: false, reason: "해치를 조작할 수 없습니다." };
  }
  if (targetState !== HATCH_STATES.OPEN && targetState !== HATCH_STATES.CLOSED) {
    return { success: false, reason: "올바르지 않은 해치 상태입니다." };
  }
  if (role === CREW_ROLES.LOADER && targetState === HATCH_STATES.OPEN && unit.fireControl?.loading) {
    return { success: false, reason: "장전 중에는 탄약수 해치를 열 수 없습니다." };
  }

  const actions = ensureRuntime(unit);
  const current = unit.crewHatches[role];
  if (current === targetState && !actions[role]) {
    return { success: true, completed: true, unchanged: true, hatchState: current };
  }

  const durationSeconds = getDuration(targetState, timings);
  const transitionalState = targetState === HATCH_STATES.OPEN
    ? HATCH_STATES.OPENING
    : HATCH_STATES.CLOSING;

  unit.crewHatches[role] = transitionalState;
  actions[role] = {
    role,
    targetState,
    durationSeconds,
    remainingSeconds: durationSeconds,
    startedTurn: turn,
    lastUpdatedTurn: turn,
  };
  setObserverBusy(unit, role, true);

  if (durationSeconds === 0) {
    return advanceCrewHatchTransitions(unit, 0, turn);
  }

  return {
    success: true,
    completed: false,
    role,
    hatchState: transitionalState,
    targetState,
    remainingSeconds: durationSeconds,
  };
}

export function advanceCrewHatchTransitions(unit, elapsedSeconds = 1, turn = null) {
  const actions = ensureRuntime(unit);
  const completed = [];
  const safeElapsed = Math.max(0, Number(elapsedSeconds) || 0);

  for (const role of HATCH_ROLES) {
    const action = actions[role];
    if (!action) continue;

    action.remainingSeconds = Math.max(0, action.remainingSeconds - safeElapsed);
    action.lastUpdatedTurn = turn;
    if (action.remainingSeconds > 0) continue;

    unit.crewHatches[role] = action.targetState;
    actions[role] = null;
    setObserverBusy(unit, role, false);
    completed.push({ role, hatchState: action.targetState });
  }

  if (completed.length > 0) {
    // Legacy field remains loader-compatible until old UI paths are removed.
    unit.hatchState = unit.crewHatches[CREW_ROLES.LOADER] ?? unit.hatchState;
    synchronizeCrewVision(unit);
  }

  return { success: true, completed, pending: Object.values(actions).filter(Boolean).length };
}

export function cancelCrewHatchTransition(unit, role) {
  const actions = ensureRuntime(unit);
  if (!actions[role]) return { success: false, reason: "진행 중인 해치 조작이 없습니다." };

  const current = unit.crewHatches[role];
  unit.crewHatches[role] = current === HATCH_STATES.OPENING
    ? HATCH_STATES.CLOSED
    : HATCH_STATES.OPEN;
  actions[role] = null;
  setObserverBusy(unit, role, false);
  synchronizeCrewVision(unit);
  return { success: true, hatchState: unit.crewHatches[role] };
}
