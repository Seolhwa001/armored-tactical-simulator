// ============================================================
// ATS PROJECT
// File      : src/engine/crewActions.js
// Sprint    : 3.9.1
// Revision  : R1
// Build     : 2026-08-05
// Type      : NEW FILE
// Purpose   : Crew hatch state actions
// ============================================================

import {
  synchronizeCrewObservationDirections,
} from "./actions.js";

export const HATCH_STATES = Object.freeze({
  OPEN: "open",
  CLOSED: "closed",
});

export function setLoaderHatchState(
  unit,
  hatchState,
  turn = null,
) {
  if (
    !unit ||
    unit.destroyed ||
    !unit.crewObservation
  ) {
    return {
      success: false,
      reason:
        "탄약수 해치를 조작할 수 없습니다.",
    };
  }

  if (
    hatchState !== HATCH_STATES.OPEN &&
    hatchState !== HATCH_STATES.CLOSED
  ) {
    return {
      success: false,
      reason:
        "올바르지 않은 해치 상태입니다.",
    };
  }

  if (
    hatchState === HATCH_STATES.OPEN &&
    unit.fireControl?.loading === true
  ) {
    return {
      success: false,
      reason:
        "장전 중에는 탄약수 해치를 열 수 없습니다.",
    };
  }

  unit.hatchState =
    hatchState;

  synchronizeCrewObservationDirections(
    unit,
    turn,
  );

  unit.command =
    hatchState === HATCH_STATES.OPEN
      ? "탄약수 해치 개방"
      : "탄약수 해치 폐쇄";

  return {
    success: true,
    hatchState,
    message:
      hatchState === HATCH_STATES.OPEN
        ? "탄약수 해치를 열었습니다."
        : "탄약수 해치를 닫았습니다.",
  };
}
