import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const mapInput = fs.readFileSync(
  path.resolve(here, "../src/controllers/mapInputController.js"),
  "utf8",
);
const renderer = fs.readFileSync(
  path.resolve(here, "../src/render/unitRenderer.js"),
  "utf8",
);

assert.ok(
  mapInput.includes("getTerrainInformationText"),
  "Terrain info must be reusable for unit and hex selection.",
);

assert.ok(
  mapInput.includes("? ` | ${terrainInformation}`"),
  "Own-unit information must include terrain information.",
);

assert.ok(
  mapInput.includes("isUnitVisible(\n          candidate,\n          false,"),
  "Developer visibility must not grant normal fire-target knowledge.",
);

assert.equal(
  mapInput.includes("isUnitVisible(\n          candidate,\n          state.developerMode,"),
  false,
  "Target lookup must not use developerMode visibility.",
);

assert.ok(
  renderer.includes("originOffset"),
  "Crew direction lines need separated origins.",
);

assert.ok(
  renderer.includes("context.fillRect("),
  "Crew labels need readable background badges.",
);

assert.ok(
  renderer.includes("observer.observing === true"),
  "View fill remains tied to active observation.",
);

console.log("Sprint 4 Observation Stage 3D consistency tests passed.");
