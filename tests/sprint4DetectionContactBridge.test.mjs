import assert from "node:assert/strict";

import {
  CONTACT_CONFIDENCE,
  CONTACT_DISPLAY_STATES,
} from "../src/engine/contracts/contactContract.js";

import {
  createContactStore,
  getContactByActualUnitId,
} from "../src/engine/runtime/contactStore.js";

import {
  CONTACT_REPORT_TYPES,
  createContactReportQueue,
} from "../src/engine/runtime/contactReportQueue.js";

import {
  synchronizeDetectedEnemyContact,
} from "../src/engine/runtime/detectionContactBridge.js";

const runtimeScenario = {
  turn: 3,
  contacts: createContactStore(),
  contactReports: createContactReportQueue(),
};

const enemy = {
  id: "enemy-test-1",
  type: "tank",
  column: 4,
  row: 2,
  hullDirection: 0,
};

const first = synchronizeDetectedEnemyContact({
  runtimeScenario,
  enemy,
  stage: 1,
  observerRole: "commander",
  distanceHexes: 6,
  turn: 3,
});

assert.ok(first);
assert.equal(first.actualUnitId, enemy.id);
assert.equal(first.estimatedDistanceMeters, 300);
assert.equal(first.confidence, CONTACT_CONFIDENCE.LOW);
assert.equal(first.displayState, CONTACT_DISPLAY_STATES.REPORTED);
assert.equal(runtimeScenario.contactReports.length, 1);
assert.equal(runtimeScenario.contactReports[0].type, CONTACT_REPORT_TYPES.NEW_CONTACT);

const second = synchronizeDetectedEnemyContact({
  runtimeScenario,
  enemy,
  stage: 3,
  observerRole: "gunner",
  distanceHexes: 5,
  turn: 4,
});

assert.equal(second.id, first.id);
assert.equal(second.confidence, CONTACT_CONFIDENCE.HIGH);
assert.equal(second.displayState, CONTACT_DISPLAY_STATES.CONFIRMED);
assert.equal(second.classification, "tank");
assert.equal(runtimeScenario.contactReports.length, 2);
assert.equal(runtimeScenario.contactReports[1].type, CONTACT_REPORT_TYPES.CONFIDENCE_CHANGED);
assert.equal(getContactByActualUnitId(runtimeScenario.contacts, enemy.id)?.id, first.id);

synchronizeDetectedEnemyContact({
  runtimeScenario,
  enemy,
  stage: 3,
  observerRole: "gunner",
  distanceHexes: 5,
  turn: 4,
});
assert.equal(runtimeScenario.contactReports.length, 2);

console.log("Sprint 4 Detection Contact bridge tests passed.");
