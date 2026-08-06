// ============================================================
// ATS PROJECT
// File      : src/engine/contracts/contactContract.js
// Sprint    : 4
// Purpose   : Player-known contact data contract
// ============================================================

export const CONTACT_CONFIDENCE = Object.freeze({
  VERY_HIGH: "very-high",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  VERY_LOW: "very-low",
});

export const CONTACT_DISPLAY_STATES = Object.freeze({
  HIDDEN: "hidden",
  SUSPECTED: "suspected",
  REPORTED: "reported",
  CONFIRMED: "confirmed",
  LOST: "lost",
});

export const CONTACT_CLASSIFICATIONS = Object.freeze({
  TANK: "tank",
  ARMORED_VEHICLE: "armored-vehicle",
  INFANTRY: "infantry",
  MASS_INFANTRY: "mass-infantry",
  ANTI_TANK_WEAPON: "anti-tank-weapon",
  AIRCRAFT: "aircraft",
  UNKNOWN: "unknown",
  SUSPECTED_TANK: "suspected-tank",
  SUSPECTED_ARMORED_VEHICLE: "suspected-armored-vehicle",
  SUSPECTED_INFANTRY: "suspected-infantry",
});

let contactSequence = 0;

export function createContactId() {
  contactSequence += 1;
  return `contact-${contactSequence}`;
}

export function createContact({
  id = createContactId(),
  actualUnitId = null,
  estimatedHex = null,
  estimatedDirection = null,
  estimatedDistanceMeters = null,
  classification = CONTACT_CLASSIFICATIONS.UNKNOWN,
  confidence = CONTACT_CONFIDENCE.LOW,
  firstObserverRole = null,
  latestObserverRole = firstObserverRole,
  lastObservedTurn = null,
  lastObservedTime = null,
  displayState = CONTACT_DISPLAY_STATES.SUSPECTED,
  positionErrorMeters = 0,
  reported = false,
  urgentThreat = false,
} = {}) {
  return {
    id,
    actualUnitId,
    estimatedHex,
    estimatedDirection,
    estimatedDistanceMeters,
    classification,
    confidence,
    firstObserverRole,
    latestObserverRole,
    lastObservedTurn,
    lastObservedTime,
    displayState,
    positionErrorMeters,
    reported,
    urgentThreat,
  };
}

export function updateContact(contact, patch = {}) {
  if (!contact?.id) {
    throw new TypeError("A valid contact is required.");
  }

  return {
    ...contact,
    ...patch,
    id: contact.id,
  };
}
