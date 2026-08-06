import assert from "node:assert/strict";

import {
  METERS_PER_HEX,
  metersToHexes,
  hexesToMeters,
  TACTICAL_DISTANCE_HEXES,
  CREW_ROLES,
  OBSERVATION_MEANS,
  CONTACT_CONFIDENCE,
  CONTACT_CLASSIFICATIONS,
  createContact,
  updateContact,
  FIRE_PROCEDURE_STAGES,
  FIRE_MODES,
  MACHINE_GUN_BURST_ROUNDS,
  createFireProcedureState,
} from "../src/engine/contracts/index.js";

assert.equal(METERS_PER_HEX, 50);
assert.equal(metersToHexes(100), 2);
assert.equal(metersToHexes(800), 16);
assert.equal(metersToHexes(1800), 36);
assert.equal(metersToHexes(2000), 40);
assert.equal(hexesToMeters(2), 100);
assert.equal(TACTICAL_DISTANCE_HEXES.COMMANDER_CPS, 36);
assert.equal(TACTICAL_DISTANCE_HEXES.GUNNER_MAIN_SIGHT, 40);

assert.equal(CREW_ROLES.COMMANDER, "commander");
assert.equal(OBSERVATION_MEANS.COMMANDER_CPS, "commander-cps");
assert.equal(CONTACT_CONFIDENCE.HIGH, "high");
assert.equal(CONTACT_CLASSIFICATIONS.UNKNOWN, "unknown");

const contact = createContact({ actualUnitId: "enemy-1" });
assert.match(contact.id, /^contact-/);
assert.equal(contact.actualUnitId, "enemy-1");
assert.equal(contact.confidence, CONTACT_CONFIDENCE.LOW);
const updated = updateContact(contact, { confidence: CONTACT_CONFIDENCE.HIGH });
assert.equal(updated.id, contact.id);
assert.equal(updated.confidence, CONTACT_CONFIDENCE.HIGH);

const fireProcedure = createFireProcedureState({ id: "fp-1" });
assert.equal(fireProcedure.stage, FIRE_PROCEDURE_STAGES.IDLE);
assert.equal(fireProcedure.fireMode, null);
assert.equal(FIRE_MODES.FIRE_AND_ADJUST, "fire-and-adjust");
assert.equal(MACHINE_GUN_BURST_ROUNDS, 10);

console.log("Sprint 4 common contract tests passed.");
