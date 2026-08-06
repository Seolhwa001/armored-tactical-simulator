// src/engine/runtime/runtimeConstants.js — 새 파일, 1~17행

export const CREW_ROLES = Object.freeze({
  COMMANDER: "commander",
  GUNNER: "gunner",
  DRIVER: "driver",
  LOADER: "loader",
});

export const HUNTER_KILLER_STATES = Object.freeze({
  SEARCHING: "searching",
  TARGET_FOUND: "target-found",
  DESIGNATING: "designating",
  HANDOFF: "handoff",
  TRACKING: "tracking",
});
