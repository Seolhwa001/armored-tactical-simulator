// ============================================================
// ATS PROJECT
// File      : src/engine/runtime/detectionContactBridge.js
// Sprint    : 4
// Purpose   : Convert legacy Detection results into Runtime Contacts
// ============================================================

import {
  CONTACT_CLASSIFICATIONS,
  CONTACT_CONFIDENCE,
  CONTACT_DISPLAY_STATES,
} from "../contracts/contactContract.js";

import {
  getContactByActualUnitId,
  upsertContactByActualUnitId,
} from "./contactStore.js";

import {
  CONTACT_REPORT_TYPES,
  enqueueContactReport,
} from "./contactReportQueue.js";

import {
  hexesToMeters,
} from "../contracts/distanceContract.js";

const STAGE_CONTACT = 1;
const STAGE_DETECTED = 2;
const STAGE_IDENTIFIED = 3;

function getIdentifiedClassification(enemy) {
  const type = enemy?.type;

  if (type === "tank") {
    return CONTACT_CLASSIFICATIONS.TANK;
  }

  if (
    type === "armored-vehicle" ||
    type === "apc" ||
    type === "ifv"
  ) {
    return CONTACT_CLASSIFICATIONS.ARMORED_VEHICLE;
  }

  if (type === "atgm-team") {
    return CONTACT_CLASSIFICATIONS.ANTI_TANK_WEAPON;
  }

  if (type === "aircraft") {
    return CONTACT_CLASSIFICATIONS.AIRCRAFT;
  }

  if (
    type === "infantry" ||
    type === "artillery-observer"
  ) {
    return CONTACT_CLASSIFICATIONS.INFANTRY;
  }

  return CONTACT_CLASSIFICATIONS.UNKNOWN;
}

function getClassification(enemy, stage) {
  if (stage >= STAGE_IDENTIFIED) {
    return getIdentifiedClassification(enemy);
  }

  if (stage >= STAGE_DETECTED) {
    if (enemy?.type === "tank") {
      return CONTACT_CLASSIFICATIONS.SUSPECTED_TANK;
    }

    if (
      enemy?.type === "armored-vehicle" ||
      enemy?.type === "apc" ||
      enemy?.type === "ifv"
    ) {
      return CONTACT_CLASSIFICATIONS.SUSPECTED_ARMORED_VEHICLE;
    }

    if (
      enemy?.type === "infantry" ||
      enemy?.type === "artillery-observer" ||
      enemy?.type === "atgm-team"
    ) {
      return CONTACT_CLASSIFICATIONS.SUSPECTED_INFANTRY;
    }
  }

  return CONTACT_CLASSIFICATIONS.UNKNOWN;
}

function getConfidence(stage) {
  return stage >= STAGE_DETECTED
    ? CONTACT_CONFIDENCE.HIGH
    : CONTACT_CONFIDENCE.LOW;
}

function getDisplayState(stage) {
  if (stage >= STAGE_IDENTIFIED) {
    return CONTACT_DISPLAY_STATES.CONFIRMED;
  }

  if (stage >= STAGE_CONTACT) {
    return CONTACT_DISPLAY_STATES.REPORTED;
  }

  return CONTACT_DISPLAY_STATES.HIDDEN;
}

function buildReportMessage(observerRole, classification, distanceMeters) {
  const reporter = observerRole ?? "승무원";
  const distanceText = Number.isFinite(distanceMeters)
    ? ` ${Math.round(distanceMeters)}미터`
    : "";

  return `${reporter}: ${classification}${distanceText}, 접촉!`;
}

export function synchronizeDetectedEnemyContact({
  runtimeScenario,
  enemy,
  stage,
  observerRole = null,
  distanceHexes = null,
  turn = runtimeScenario?.turn ?? null,
  time = null,
  urgentThreat = false,
} = {}) {
  const store = runtimeScenario?.contacts;
  const queue = runtimeScenario?.contactReports;

  if (
    !store ||
    !enemy?.id ||
    !Number.isFinite(stage) ||
    stage < STAGE_CONTACT
  ) {
    return null;
  }

  const previous = getContactByActualUnitId(store, enemy.id);
  const confidence = getConfidence(stage);
  const classification = getClassification(enemy, stage);
  const distanceMeters = Number.isFinite(distanceHexes)
    ? hexesToMeters(distanceHexes)
    : null;

  const contact = upsertContactByActualUnitId(store, enemy.id, {
    estimatedHex: {
      column: enemy.column,
      row: enemy.row,
    },
    estimatedDirection: enemy.direction ?? enemy.hullDirection ?? null,
    estimatedDistanceMeters: distanceMeters,
    classification,
    confidence,
    firstObserverRole: previous?.firstObserverRole ?? observerRole,
    latestObserverRole: observerRole,
    lastObservedTurn: turn,
    lastObservedTime: time,
    displayState: getDisplayState(stage),
    positionErrorMeters: 0,
    reported: true,
    urgentThreat: Boolean(urgentThreat),
  });

  if (!Array.isArray(queue)) {
    return contact;
  }

  let reportType = null;

  if (!previous) {
    reportType = CONTACT_REPORT_TYPES.NEW_CONTACT;
  } else if (
    previous.confidence !== contact.confidence
  ) {
    reportType = CONTACT_REPORT_TYPES.CONFIDENCE_CHANGED;
  } else if (
    previous.classification !== contact.classification ||
    previous.estimatedHex?.column !== contact.estimatedHex?.column ||
    previous.estimatedHex?.row !== contact.estimatedHex?.row
  ) {
    reportType = CONTACT_REPORT_TYPES.CONTACT_UPDATED;
  }

  if (urgentThreat) {
    reportType = CONTACT_REPORT_TYPES.URGENT_THREAT;
  }

  if (reportType) {
    enqueueContactReport(queue, {
      type: reportType,
      contactId: contact.id,
      observerRole,
      turn,
      time,
      urgent: Boolean(urgentThreat),
      message: buildReportMessage(
        observerRole,
        classification,
        distanceMeters,
      ),
    });
  }

  return contact;
}
