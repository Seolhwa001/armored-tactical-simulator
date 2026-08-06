// ============================================================
// ATS PROJECT
// File      : src/engine/runtime/contactReportQueue.js
// Sprint    : 4
// Purpose   : Runtime-owned crew report event queue
// ============================================================

let reportSequence = 0;

export const CONTACT_REPORT_TYPES = Object.freeze({
  NEW_CONTACT: "new-contact",
  CONTACT_UPDATED: "contact-updated",
  CONFIDENCE_CHANGED: "confidence-changed",
  URGENT_THREAT: "urgent-threat",
  CONTACT_LOST: "contact-lost",
});

export function createContactReportQueue() {
  return [];
}

export function enqueueContactReport(queue, {
  type,
  contactId,
  observerRole = null,
  turn = null,
  time = null,
  message = null,
  urgent = false,
  acknowledged = false,
} = {}) {
  if (!Array.isArray(queue)) {
    throw new TypeError("A valid Contact report queue is required.");
  }
  if (!type || !contactId) {
    throw new TypeError("Contact report type and contactId are required.");
  }

  reportSequence += 1;
  const report = {
    id: `contact-report-${reportSequence}`,
    type,
    contactId,
    observerRole,
    turn,
    time,
    message,
    urgent: Boolean(urgent),
    acknowledged: Boolean(acknowledged),
  };

  queue.push(report);
  return report;
}

export function acknowledgeContactReport(queue, reportId) {
  if (!Array.isArray(queue)) return null;
  const report = queue.find((item) => item.id === reportId);
  if (!report) return null;
  report.acknowledged = true;
  return report;
}

export function getPendingContactReports(queue) {
  if (!Array.isArray(queue)) return [];
  return queue.filter((report) => report.acknowledged !== true);
}
