// ============================================================
// ATS PROJECT
// File      : src/engine/contracts/visionContract.js
// Sprint    : 4
// Purpose   : Shared crew vision profiles and directional defaults
// ============================================================

import { TACTICAL_DISTANCE_HEXES } from "./distanceContract.js";
import { OBSERVATION_MEANS } from "./crewContract.js";

export const VISION_RANGE_MODES = Object.freeze({
  ABSOLUTE_HEXES: "absolute-hexes",
  LEGACY_MULTIPLIER: "legacy-multiplier",
});

export const VISION_ANGLES_DEGREES = Object.freeze({
  COMMANDER_OPEN_VISUAL: 90,
  COMMANDER_CLOSED_VISUAL: 30,
  COMMANDER_CPS: 10,
  GUNNER_MAIN_SIGHT: 8,
  LOADER_OPEN_VISUAL: 90,
  LOADER_CLOSED_VISUAL: 30,
  DRIVER_FORWARD: 45,
});

export const VISION_DIRECTION_OFFSETS_DEGREES = Object.freeze({
  COMMANDER_CLOSED_FROM_TURRET: 90,
  LOADER_FROM_TURRET: -90,
  DRIVER_FROM_HULL: 0,
  GUNNER_FROM_TURRET: 0,
});

export const CREW_VISION_PROFILES = Object.freeze({
  [OBSERVATION_MEANS.COMMANDER_VISUAL]: Object.freeze({
    rangeHexes: TACTICAL_DISTANCE_HEXES.OPEN_HATCH_VISUAL,
    fieldOfViewDegrees: VISION_ANGLES_DEGREES.COMMANDER_OPEN_VISUAL,
    rangeMode: VISION_RANGE_MODES.ABSOLUTE_HEXES,
  }),
  [OBSERVATION_MEANS.COMMANDER_CLOSED_HATCH]: Object.freeze({
    rangeHexes: TACTICAL_DISTANCE_HEXES.CLOSED_HATCH_VISUAL,
    fieldOfViewDegrees: VISION_ANGLES_DEGREES.COMMANDER_CLOSED_VISUAL,
    rangeMode: VISION_RANGE_MODES.ABSOLUTE_HEXES,
  }),
  [OBSERVATION_MEANS.COMMANDER_CPS]: Object.freeze({
    rangeHexes: TACTICAL_DISTANCE_HEXES.COMMANDER_CPS,
    fieldOfViewDegrees: VISION_ANGLES_DEGREES.COMMANDER_CPS,
    rangeMode: VISION_RANGE_MODES.ABSOLUTE_HEXES,
  }),
  [OBSERVATION_MEANS.GUNNER_MAIN_SIGHT]: Object.freeze({
    rangeHexes: TACTICAL_DISTANCE_HEXES.GUNNER_MAIN_SIGHT,
    fieldOfViewDegrees: VISION_ANGLES_DEGREES.GUNNER_MAIN_SIGHT,
    rangeMode: VISION_RANGE_MODES.ABSOLUTE_HEXES,
  }),
  [OBSERVATION_MEANS.LOADER_VISUAL]: Object.freeze({
    rangeHexes: TACTICAL_DISTANCE_HEXES.OPEN_HATCH_VISUAL,
    fieldOfViewDegrees: VISION_ANGLES_DEGREES.LOADER_OPEN_VISUAL,
    rangeMode: VISION_RANGE_MODES.ABSOLUTE_HEXES,
  }),
  [OBSERVATION_MEANS.LOADER_CLOSED_HATCH]: Object.freeze({
    rangeHexes: TACTICAL_DISTANCE_HEXES.CLOSED_HATCH_VISUAL,
    fieldOfViewDegrees: VISION_ANGLES_DEGREES.LOADER_CLOSED_VISUAL,
    rangeMode: VISION_RANGE_MODES.ABSOLUTE_HEXES,
  }),
  [OBSERVATION_MEANS.DRIVER_FORWARD]: Object.freeze({
    rangeHexes: TACTICAL_DISTANCE_HEXES.DRIVER_FORWARD_VISUAL,
    fieldOfViewDegrees: VISION_ANGLES_DEGREES.DRIVER_FORWARD,
    rangeMode: VISION_RANGE_MODES.ABSOLUTE_HEXES,
  }),
});

export function degreesToRadians(degrees) {
  if (!Number.isFinite(degrees)) {
    throw new TypeError("degrees must be finite.");
  }
  return degrees * Math.PI / 180;
}
