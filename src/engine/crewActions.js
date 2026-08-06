// ============================================================
// ATS PROJECT
// File      : src/engine/crewActions.js
// Sprint    : 4
// Purpose   : Crew hatch commands backed by persistent Runtime actions
// ============================================================

import { CREW_ROLES, HATCH_STATES } from "./contracts/index.js";
import { beginCrewHatchTransition } from "./runtime/crewHatchRuntime.js";

export { HATCH_STATES };

export function setCrewHatchState(unit, role, hatchState, turn = null) {
  const result = beginCrewHatchTransition(unit, role, hatchState, { turn });
  if (!result.success) return result;

  unit.command = hatchState === HATCH_STATES.OPEN
    ? `${role === CREW_ROLES.COMMANDER ? "전차장" : "탄약수"} 해치 개방 중`
    : `${role === CREW_ROLES.COMMANDER ? "전차장" : "탄약수"} 해치 폐쇄 중`;

  return {
    ...result,
    message: result.completed
      ? "해치 상태가 이미 적용되어 있습니다."
      : hatchState === HATCH_STATES.OPEN
        ? "해치 개방을 시작했습니다."
        : "해치 폐쇄를 시작했습니다.",
  };
}

export function setLoaderHatchState(unit, hatchState, turn = null) {
  return setCrewHatchState(unit, CREW_ROLES.LOADER, hatchState, turn);
}

export function setCommanderHatchState(unit, hatchState, turn = null) {
  return setCrewHatchState(unit, CREW_ROLES.COMMANDER, hatchState, turn);
}
