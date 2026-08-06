// ============================================================
// ATS PROJECT
// File      : src/engine/contracts/actionTimeContract.js
// Sprint    : 4
// Purpose   : Adjustable time keys for persistent tactical actions
// ============================================================

export const TACTICAL_ACTION_TIME_KEYS = Object.freeze({
  HATCH_OPEN: "hatch-open",
  HATCH_CLOSE: "hatch-close",
  CPS_ROTATE: "cps-rotate",
  COMMANDER_MACHINE_GUN_ROTATE: "commander-machine-gun-rotate",
  LOADER_MACHINE_GUN_ROTATE: "loader-machine-gun-rotate",
  TURRET_ROTATE: "turret-rotate",
  WATCH_DIRECTION_MOVE: "watch-direction-move",
  TARGET_SEARCH: "target-search",
  TARGET_IDENTIFY: "target-identify",
  AIM: "aim",
  LOAD: "load",
  ABORT_LOAD: "abort-load",
  MACHINE_GUN_FIRE: "machine-gun-fire",
  MAIN_GUN_FIRE: "main-gun-fire",
});

// Initial values are deliberately centralized and adjustable. Existing
// Sprint 3.9.1 action timings remain authoritative until Phase 5 migration.
export const DEFAULT_TACTICAL_ACTION_SECONDS = Object.freeze({
  [TACTICAL_ACTION_TIME_KEYS.HATCH_OPEN]: 1,
  [TACTICAL_ACTION_TIME_KEYS.HATCH_CLOSE]: 1,
  [TACTICAL_ACTION_TIME_KEYS.CPS_ROTATE]: 1,
  [TACTICAL_ACTION_TIME_KEYS.COMMANDER_MACHINE_GUN_ROTATE]: 1,
  [TACTICAL_ACTION_TIME_KEYS.LOADER_MACHINE_GUN_ROTATE]: 1,
  [TACTICAL_ACTION_TIME_KEYS.TURRET_ROTATE]: 1,
  [TACTICAL_ACTION_TIME_KEYS.WATCH_DIRECTION_MOVE]: 1,
  [TACTICAL_ACTION_TIME_KEYS.TARGET_SEARCH]: 1,
  [TACTICAL_ACTION_TIME_KEYS.TARGET_IDENTIFY]: 1,
  [TACTICAL_ACTION_TIME_KEYS.AIM]: 1,
  [TACTICAL_ACTION_TIME_KEYS.LOAD]: 1,
  [TACTICAL_ACTION_TIME_KEYS.ABORT_LOAD]: 1,
  [TACTICAL_ACTION_TIME_KEYS.MACHINE_GUN_FIRE]: 1,
  [TACTICAL_ACTION_TIME_KEYS.MAIN_GUN_FIRE]: 1,
});
