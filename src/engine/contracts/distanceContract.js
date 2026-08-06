// ============================================================
// ATS PROJECT
// File      : src/engine/contracts/distanceContract.js
// Sprint    : 4
// Purpose   : Single source of truth for battlefield distance units
// ============================================================

export const METERS_PER_HEX = 50;

function assertFiniteNonNegative(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a finite non-negative number.`);
  }
}

export function metersToHexes(meters, { rounding = "exact" } = {}) {
  assertFiniteNonNegative(meters, "meters");
  const raw = meters / METERS_PER_HEX;

  switch (rounding) {
    case "exact":
      return raw;
    case "ceil":
      return Math.ceil(raw);
    case "floor":
      return Math.floor(raw);
    case "round":
      return Math.round(raw);
    default:
      throw new RangeError(`Unsupported rounding mode: ${rounding}`);
  }
}

export function hexesToMeters(hexes) {
  assertFiniteNonNegative(hexes, "hexes");
  return hexes * METERS_PER_HEX;
}

export const TACTICAL_DISTANCE_METERS = Object.freeze({
  CLOSED_HATCH_VISUAL: 100,
  DRIVER_FORWARD_VISUAL: 100,
  OPEN_HATCH_VISUAL: 800,
  COMMANDER_CPS: 1800,
  GUNNER_MAIN_SIGHT: 2000,
});

export const TACTICAL_DISTANCE_HEXES = Object.freeze(
  Object.fromEntries(
    Object.entries(TACTICAL_DISTANCE_METERS).map(([key, meters]) => [
      key,
      metersToHexes(meters),
    ]),
  ),
);
