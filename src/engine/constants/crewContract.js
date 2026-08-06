// ============================================================
// ATS PROJECT
// File      : src/engine/contracts/crewContract.js
// Sprint    : 4
// Purpose   : Shared crew roles, observation means and task states
// ============================================================

export const CREW_ROLES = Object.freeze({
  COMMANDER: "commander",
  GUNNER: "gunner",
  LOADER: "loader",
  DRIVER: "driver",
});

export const OBSERVATION_MEANS = Object.freeze({
  COMMANDER_VISUAL: "commander-visual",
  COMMANDER_CLOSED_HATCH: "commander-closed-hatch",
  COMMANDER_CPS: "commander-cps",
  GUNNER_MAIN_SIGHT: "gunner-main-sight",
  LOADER_VISUAL: "loader-visual",
  LOADER_CLOSED_HATCH: "loader-closed-hatch",
  DRIVER_FORWARD: "driver-forward",
});

export const HATCH_STATES = Object.freeze({
  OPEN: "open",
  CLOSED: "closed",
  OPENING: "opening",
  CLOSING: "closing",
});

export const CREW_TASK_STATES = Object.freeze({
  IDLE: "idle",
  OBSERVING: "observing",
  ROTATING: "rotating",
  SEARCHING: "searching",
  IDENTIFYING: "identifying",
  AIMING: "aiming",
  LOADING: "loading",
  FIRING: "firing",
  OPERATING_HATCH: "operating-hatch",
  UNAVAILABLE: "unavailable",
});

export const COMMAND_EXECUTION_STATES = Object.freeze({
  NONE: "none",
  QUEUED: "queued",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  FAILED: "failed",
});
