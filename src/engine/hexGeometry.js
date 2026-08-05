// ============================================================
// ATS PROJECT
// File      : src/engine/hexGeometry.js
// Sprint    : 3.9.1
// Revision  : R1
// Build     : 2026-08-05
// Type      : NEW FILE
// Purpose   : Shared odd-row hex geometry calculations
// ============================================================

const HEX_HORIZONTAL_SPACING =
  Math.sqrt(3);

const HEX_VERTICAL_SPACING =
  1.5;

function finiteOrDefault(
  value,
  fallback,
) {
  return Number.isFinite(value)
    ? value
    : fallback;
}

export function getHexCenter(
  column,
  row,
) {
  const safeColumn =
    finiteOrDefault(column, 0);

  const safeRow =
    finiteOrDefault(row, 0);

  return {
    x:
      safeColumn *
        HEX_HORIZONTAL_SPACING +
      (
        safeRow % 2 === 0
          ? 0
          : HEX_HORIZONTAL_SPACING / 2
      ),

    y:
      safeRow *
      HEX_VERTICAL_SPACING,
  };
}

export function getHexDirection(
  start,
  end,
) {
  const startPoint =
    getHexCenter(
      start?.column,
      start?.row,
    );

  const endPoint =
    getHexCenter(
      end?.column,
      end?.row,
    );

  return Math.atan2(
    endPoint.y - startPoint.y,
    endPoint.x - startPoint.x,
  );
}
