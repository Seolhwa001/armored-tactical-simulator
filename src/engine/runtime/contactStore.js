// ============================================================
// ATS PROJECT
// File      : src/engine/runtime/contactStore.js
// Sprint    : 4
// Purpose   : Runtime-owned Contact storage and update API
// ============================================================

import {
  createContact,
  updateContact,
} from "../contracts/contactContract.js";

export function createContactStore() {
  return {
    byId: Object.create(null),
    byActualUnitId: Object.create(null),
    order: [],
  };
}

function requireStore(store) {
  if (!store?.byId || !store?.byActualUnitId || !Array.isArray(store?.order)) {
    throw new TypeError("A valid Contact store is required.");
  }
  return store;
}

export function getContactById(store, contactId) {
  requireStore(store);
  return contactId ? store.byId[contactId] ?? null : null;
}

export function getContactByActualUnitId(store, actualUnitId) {
  requireStore(store);
  if (!actualUnitId) return null;
  const contactId = store.byActualUnitId[actualUnitId];
  return contactId ? getContactById(store, contactId) : null;
}

export function listContacts(store) {
  requireStore(store);
  return store.order
    .map((contactId) => store.byId[contactId])
    .filter(Boolean);
}

export function addContact(store, contactData = {}) {
  requireStore(store);

  const contact = contactData?.id
    ? createContact(contactData)
    : createContact(contactData);

  if (store.byId[contact.id]) {
    throw new Error(`Contact already exists: ${contact.id}`);
  }

  if (contact.actualUnitId) {
    const existingId = store.byActualUnitId[contact.actualUnitId];
    if (existingId) {
      throw new Error(
        `Actual unit is already linked to Contact: ${contact.actualUnitId}`,
      );
    }
    store.byActualUnitId[contact.actualUnitId] = contact.id;
  }

  store.byId[contact.id] = contact;
  store.order.push(contact.id);
  return contact;
}

export function patchContact(store, contactId, patch = {}) {
  requireStore(store);
  const current = getContactById(store, contactId);
  if (!current) return null;

  const previousActualUnitId = current.actualUnitId;
  const next = updateContact(current, patch);
  const nextActualUnitId = next.actualUnitId;

  if (previousActualUnitId && previousActualUnitId !== nextActualUnitId) {
    delete store.byActualUnitId[previousActualUnitId];
  }

  if (nextActualUnitId) {
    const linkedId = store.byActualUnitId[nextActualUnitId];
    if (linkedId && linkedId !== contactId) {
      throw new Error(`Actual unit is already linked to Contact: ${nextActualUnitId}`);
    }
    store.byActualUnitId[nextActualUnitId] = contactId;
  }

  store.byId[contactId] = next;
  return next;
}

export function upsertContactByActualUnitId(store, actualUnitId, contactData = {}) {
  requireStore(store);
  if (!actualUnitId) {
    throw new TypeError("actualUnitId is required for Contact upsert.");
  }

  const existing = getContactByActualUnitId(store, actualUnitId);
  if (existing) {
    return patchContact(store, existing.id, {
      ...contactData,
      actualUnitId,
    });
  }

  return addContact(store, {
    ...contactData,
    actualUnitId,
  });
}

export function removeContact(store, contactId) {
  requireStore(store);
  const contact = getContactById(store, contactId);
  if (!contact) return false;

  delete store.byId[contactId];
  if (contact.actualUnitId) {
    delete store.byActualUnitId[contact.actualUnitId];
  }
  store.order = store.order.filter((id) => id !== contactId);
  return true;
}
