// ============================================================
// ATS PROJECT
// File      : src/engine/procedureViewModel.js
// Sprint    : 4
// Stage     : 2C - Procedure Runtime/UI ownership cleanup
// Purpose   : Read-only projection of Runtime-owned procedure state.
// ============================================================

import {
  PROCEDURE_CORE_STATES,
} from "./procedureCore.js";

const CORE_LABELS = Object.freeze({
  [PROCEDURE_CORE_STATES.IDLE]: "대기",
  [PROCEDURE_CORE_STATES.COMMAND]: "명령",
  [PROCEDURE_CORE_STATES.PREPARE]: "준비",
  [PROCEDURE_CORE_STATES.READY]: "준비 완료",
  [PROCEDURE_CORE_STATES.EXECUTE]: "실행",
  [PROCEDURE_CORE_STATES.END]: "종료",
});

function roundPercent(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(
    Math.min(1, Math.max(0, value)) * 100,
  );
}

export function createProcedureViewModel(fireControl) {
  const procedure = fireControl?.procedure ?? null;
  const core = procedure?.core ?? null;

  return Object.freeze({
    legacyState:
      procedure?.state ??
      fireControl?.procedureState ??
      null,

    coreState:
      core?.state ?? null,

    coreLabel:
      CORE_LABELS[core?.state] ??
      core?.state ??
      "없음",

    coreProgressPercent:
      roundPercent(core?.actionProgress),

    active:
      procedure?.active === true,

    updatedTurn:
      Number.isFinite(procedure?.updatedTurn)
        ? procedure.updatedTurn
        : null,

    startedTurn:
      Number.isFinite(procedure?.startedTurn)
        ? procedure.startedTurn
        : null,

    pendingAction:
      core?.pendingAction ?? null,

    lastEndReason:
      core?.lastEndReason ??
      procedure?.lastEndReason ??
      null,
  });
}
