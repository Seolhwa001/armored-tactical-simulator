import assert from "node:assert/strict";

import {
  CONTACT_CONFIDENCE,
  CONTACT_DISPLAY_STATES,
} from "../src/engine/contracts/contactContract.js";

import {
  addContact,
  createContactStore,
  getContactByActualUnitId,
  getContactById,
  listContacts,
  patchContact,
  removeContact,
  upsertContactByActualUnitId,
} from "../src/engine/runtime/contactStore.js";

import {
  CONTACT_REPORT_TYPES,
  acknowledgeContactReport,
  createContactReportQueue,
  enqueueContactReport,
  getPendingContactReports,
} from "../src/engine/runtime/contactReportQueue.js";

const store = createContactStore();
const created = addContact(store, {
  id: "contact-test-1",
  actualUnitId: "enemy-1",
  confidence: CONTACT_CONFIDENCE.LOW,
  displayState: CONTACT_DISPLAY_STATES.REPORTED,
});

assert.equal(getContactById(store, created.id), created);
assert.equal(getContactByActualUnitId(store, "enemy-1")?.id, created.id);
assert.equal(listContacts(store).length, 1);

const updated = patchContact(store, created.id, {
  confidence: CONTACT_CONFIDENCE.HIGH,
  estimatedHex: { q: 3, r: 4 },
});
assert.equal(updated.confidence, CONTACT_CONFIDENCE.HIGH);
assert.deepEqual(updated.estimatedHex, { q: 3, r: 4 });

const upserted = upsertContactByActualUnitId(store, "enemy-1", {
  latestObserverRole: "gunner",
});
assert.equal(upserted.id, created.id);
assert.equal(listContacts(store).length, 1);
assert.equal(upserted.latestObserverRole, "gunner");

const queue = createContactReportQueue();
const report = enqueueContactReport(queue, {
  type: CONTACT_REPORT_TYPES.NEW_CONTACT,
  contactId: created.id,
  observerRole: "gunner",
  turn: 2,
  urgent: true,
});
assert.equal(getPendingContactReports(queue).length, 1);
assert.equal(acknowledgeContactReport(queue, report.id)?.acknowledged, true);
assert.equal(getPendingContactReports(queue).length, 0);

assert.equal(removeContact(store, created.id), true);
assert.equal(getContactByActualUnitId(store, "enemy-1"), null);
assert.equal(listContacts(store).length, 0);

console.log("Sprint 4 Contact Runtime tests passed.");
