// ============================================================
// ATS PROJECT
// File      : src/engine/contracts/watchSectorContract.js
// Sprint    : 4
// Purpose   : Shared watch-sector widths and scan lifecycle values
// ============================================================

export const WATCH_SECTOR_WIDTHS_DEGREES = Object.freeze({
  NARROW: 15,
  NORMAL: 30,
  WIDE: 45,
});

export const WATCH_SECTOR_SCAN_POINTS = Object.freeze({
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
});

export const WATCH_SECTOR_SCAN_SEQUENCE = Object.freeze([
  WATCH_SECTOR_SCAN_POINTS.LEFT,
  WATCH_SECTOR_SCAN_POINTS.CENTER,
  WATCH_SECTOR_SCAN_POINTS.RIGHT,
  WATCH_SECTOR_SCAN_POINTS.CENTER,
]);

export const WATCH_SECTOR_STATES = Object.freeze({
  INACTIVE: "inactive",
  ACTIVE: "active",
  PAUSED: "paused",
});

export const DEFAULT_WATCH_SECTOR_ROTATION_DEGREES_PER_SECOND = 30;
export const DEFAULT_WATCH_SECTOR_DWELL_SECONDS = 1;
