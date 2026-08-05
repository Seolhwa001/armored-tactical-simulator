// ============================================================
// ATS PROJECT
// File      : src/engine/mathUtils.js
// Sprint    : 3.9.1
// Revision  : R1
// Build     : 2026-08-05
// Type      : NEW FILE
// Purpose   : Shared finite-number and angle normalization utilities
// ============================================================

const FULL_ROTATION =
  Math.PI * 2;

export function finiteOrDefault(
  value,
  fallback,
) {
  return Number.isFinite(value)
    ? value
    : fallback;
}

export function normalizeAngle(
  angle,
) {
  let normalized =
    finiteOrDefault(
      angle,
      0,
    ) %
    FULL_ROTATION;

  if (normalized > Math.PI) {
    normalized -=
      FULL_ROTATION;
  }

  if (normalized < -Math.PI) {
    normalized +=
      FULL_ROTATION;
  }

  return normalized;
}
