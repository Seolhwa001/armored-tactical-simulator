// ============================================================
// ATS PROJECT
// File      : src/engine/contracts/fireProcedureContract.js
// Sprint    : 4
// Purpose   : Persistent fire procedure command contract
// ============================================================

export const FIRE_PROCEDURE_STAGES = Object.freeze({
  IDLE: "idle",
  WARNING_ORDER: "warning-order",
  WEAPON_AMMUNITION: "weapon-ammunition",
  TARGET_SELECTION: "target-selection",
  FIRE_MODE: "fire-mode",
  AMMUNITION_LIMIT: "ammunition-limit",
  EXECUTING: "executing",
  PAUSED: "paused",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

export const FIRE_MODES = Object.freeze({
  FIRE: "fire",
  FIRE_AND_ADJUST: "fire-and-adjust",
});

export const FIRE_PROCEDURE_TERMINATION_REASONS = Object.freeze({
  CEASE_FIRE: "cease-fire",
  AMMUNITION_LIMIT_REACHED: "ammunition-limit-reached",
  TARGETS_COMPLETED: "targets-completed",
  AMMUNITION_DEPLETED: "ammunition-depleted",
  WEAPON_UNAVAILABLE: "weapon-unavailable",
  CREW_UNAVAILABLE: "crew-unavailable",
  REPLACED_BY_NEW_COMMAND: "replaced-by-new-command",
  CANCELLED: "cancelled",
});

export const MACHINE_GUN_BURST_ROUNDS = 10;

export function createFireProcedureState({ id = null } = {}) {
  return {
    id,
    stage: FIRE_PROCEDURE_STAGES.IDLE,
    warningOrderRole: null,
    warningOrderDelegated: false,
    weaponId: null,
    ammunitionType: null,
    weaponAmmunitionDelegated: false,
    targetClassification: null,
    targetQueue: [],
    currentTargetIndex: 0,
    fireMode: null,
    totalAmmunitionLimit: null,
    perTargetAmmunitionLimit: null,
    ammunitionUsed: 0,
    currentTargetAmmunitionUsed: 0,
    progressSeconds: 0,
    terminationReason: null,
  };
}
