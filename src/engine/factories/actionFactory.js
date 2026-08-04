import { UNIT_ACTIONS } from "../constants/actionConstants.js";

export function createIdleAction({
  startedTurn = null,
} = {}) {
  return {
    type: UNIT_ACTIONS.IDLE,
    targetHex: null,
    targetUnitId: null,
    direction: null,
    crewRole: null,
    startedTurn,
    persistent: true,
  };
}
