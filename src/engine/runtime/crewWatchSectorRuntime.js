// ============================================================
// ATS PROJECT
// File      : src/engine/runtime/crewWatchSectorRuntime.js
// Sprint    : 4
// Purpose   : Persistent crew watch-sector assignment and scan runtime
// ============================================================

import { normalizeAngle } from "../mathUtils.js";
import {
  CREW_ROLES,
  CREW_TASK_STATES,
  OBSERVATION_MEANS,
  WATCH_SECTOR_SCAN_SEQUENCE,
  WATCH_SECTOR_STATES,
  DEFAULT_WATCH_SECTOR_ROTATION_DEGREES_PER_SECOND,
  DEFAULT_WATCH_SECTOR_DWELL_SECONDS,
  degreesToRadians,
} from "../contracts/index.js";

const VALID_ROLES = new Set(Object.values(CREW_ROLES));
const VALID_MEANS = new Set(Object.values(OBSERVATION_MEANS));

function angularDelta(from, to) {
  let delta = normalizeAngle(to) - normalizeAngle(from);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function ensureRuntime(unit) {
  if (!unit.crewWatchSectors) unit.crewWatchSectors = {};
  return unit.crewWatchSectors;
}

function observerFor(unit, role) {
  return unit?.crewObservation?.observers?.[role] ?? null;
}

function pointDirection(sector) {
  const point = WATCH_SECTOR_SCAN_SEQUENCE[sector.sequenceIndex];
  if (point === "left") return sector.leftLimit;
  if (point === "right") return sector.rightLimit;
  return sector.centerDirection;
}

function roleBusy(unit, role, observer) {
  if (!observer?.enabled || observer.observing === false) return true;
  if (unit?.destroyed) return true;
  if (unit?.crewHatchActions?.[role]) return true;
  const task = observer.crewTask;
  return task && ![
    CREW_TASK_STATES.IDLE,
    CREW_TASK_STATES.OBSERVING,
    CREW_TASK_STATES.SEARCHING,
    CREW_TASK_STATES.ROTATING,
  ].includes(task);
}

export function assignCrewWatchSector(unit, role, {
  observationMean = null,
  centerDirection,
  halfWidthDegrees = 30,
  rotationDegreesPerSecond = DEFAULT_WATCH_SECTOR_ROTATION_DEGREES_PER_SECOND,
  dwellSeconds = DEFAULT_WATCH_SECTOR_DWELL_SECONDS,
  turn = null,
} = {}) {
  const observer = observerFor(unit, role);
  if (!observer || !VALID_ROLES.has(role) || !Number.isFinite(centerDirection)) {
    return { success: false, reason: "감시구역을 지정할 수 없습니다." };
  }
  if (observationMean !== null && !VALID_MEANS.has(observationMean)) {
    return { success: false, reason: "지원하지 않는 관측 수단입니다." };
  }

  const width = Math.max(0, Number(halfWidthDegrees) || 0);
  const center = normalizeAngle(centerDirection);
  const offset = degreesToRadians(width);
  const sectors = ensureRuntime(unit);
  sectors[role] = {
    role,
    observationMean: observationMean ?? observer.observationMean ?? null,
    centerDirection: center,
    leftLimit: normalizeAngle(center - offset),
    rightLimit: normalizeAngle(center + offset),
    halfWidthDegrees: width,
    sequenceIndex: 0,
    targetDirection: normalizeAngle(center - offset),
    state: WATCH_SECTOR_STATES.ACTIVE,
    rotationRadiansPerSecond: degreesToRadians(Math.max(0, rotationDegreesPerSecond)),
    dwellSeconds: Math.max(0, Number(dwellSeconds) || 0),
    dwellRemainingSeconds: 0,
    assignedTurn: turn,
    lastUpdatedTurn: turn,
    pauseReason: null,
  };
  observer.assignedDirection = center;
  observer.targetDirection = sectors[role].targetDirection;
  observer.crewTask = CREW_TASK_STATES.ROTATING;
  return { success: true, sector: sectors[role] };
}

export function cancelCrewWatchSector(unit, role) {
  const sectors = ensureRuntime(unit);
  if (!sectors[role]) return { success: false, reason: "할당된 감시구역이 없습니다." };
  delete sectors[role];
  const observer = observerFor(unit, role);
  if (observer) {
    observer.assignedDirection = null;
    observer.targetDirection = observer.direction;
    if (observer.crewTask === CREW_TASK_STATES.ROTATING || observer.crewTask === CREW_TASK_STATES.SEARCHING) {
      observer.crewTask = CREW_TASK_STATES.OBSERVING;
    }
  }
  return { success: true };
}

export function advanceCrewWatchSectors(unit, elapsedSeconds = 1, turn = null) {
  const sectors = ensureRuntime(unit);
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const updated = [];

  Object.entries(sectors).forEach(([role, sector]) => {
    const observer = observerFor(unit, role);
    if (!observer) return;

    if (roleBusy(unit, role, observer)) {
      sector.state = WATCH_SECTOR_STATES.PAUSED;
      sector.pauseReason = observer.crewTask ?? "unavailable";
      sector.lastUpdatedTurn = turn;
      return;
    }

    if (sector.state === WATCH_SECTOR_STATES.PAUSED) {
      sector.state = WATCH_SECTOR_STATES.ACTIVE;
      sector.pauseReason = null;
    }

    if (sector.observationMean) observer.observationMean = sector.observationMean;

    if (sector.dwellRemainingSeconds > 0) {
      sector.dwellRemainingSeconds = Math.max(0, sector.dwellRemainingSeconds - elapsed);
      observer.crewTask = CREW_TASK_STATES.SEARCHING;
      if (sector.dwellRemainingSeconds === 0) {
        sector.sequenceIndex = (sector.sequenceIndex + 1) % WATCH_SECTOR_SCAN_SEQUENCE.length;
        sector.targetDirection = pointDirection(sector);
        observer.targetDirection = sector.targetDirection;
      }
      sector.lastUpdatedTurn = turn;
      updated.push(role);
      return;
    }

    const target = sector.targetDirection;
    const delta = angularDelta(observer.direction, target);
    const maxStep = sector.rotationRadiansPerSecond * elapsed;
    if (Math.abs(delta) <= maxStep || maxStep === 0) {
      observer.direction = normalizeAngle(target);
      observer.targetDirection = observer.direction;
      observer.crewTask = CREW_TASK_STATES.SEARCHING;
      sector.dwellRemainingSeconds = sector.dwellSeconds;
      if (sector.dwellSeconds === 0) {
        sector.sequenceIndex = (sector.sequenceIndex + 1) % WATCH_SECTOR_SCAN_SEQUENCE.length;
        sector.targetDirection = pointDirection(sector);
        observer.targetDirection = sector.targetDirection;
      }
    } else {
      observer.direction = normalizeAngle(observer.direction + Math.sign(delta) * maxStep);
      observer.targetDirection = target;
      observer.crewTask = CREW_TASK_STATES.ROTATING;
    }
    sector.lastUpdatedTurn = turn;
    updated.push(role);
  });

  return { success: true, updated, activeCount: Object.keys(sectors).length };
}

export function getCrewWatchSector(unit, role) {
  return ensureRuntime(unit)[role] ?? null;
}
