// src/engine/factories/actionFactory.js — 새 파일, 1~15행

import { UNIT_ACTIONS } from "../constants/actionConstants.js";

export function createIdleAction() {
  return {
    type: UNIT_ACTIONS.IDLE,
    targetHex: null,
    targetUnitId: null,
    direction: null,
    crewRole: null,
    startedTurn: null,
    persistent: true,
  };
}
