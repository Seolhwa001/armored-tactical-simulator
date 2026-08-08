import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const renderer=fs.readFileSync(path.resolve(here,"../src/render/unitRenderer.js"),"utf8");
const mapRenderer=fs.readFileSync(path.resolve(here,"../src/render/mapRenderer.js"),"utf8");
const app=fs.readFileSync(path.resolve(here,"../src/app.js"),"utf8");

assert.ok(renderer.includes("export function drawSelectedObservationOverlay"));
assert.equal(renderer.includes("originOffset"),false);
assert.ok(renderer.includes("[CREW_ROLES.COMMANDER]: 82"));
assert.ok(renderer.includes("[CREW_ROLES.DRIVER]: 130"));
assert.ok(renderer.includes("candidate.id === selectedUnitId"));

const fogIndex=mapRenderer.indexOf("context.drawImage(  \n  fogLayer.canvas");
const overlayIndex=mapRenderer.indexOf("drawOverlayLayer({");
assert.ok(fogIndex >= 0 && overlayIndex > fogIndex,
  "Observation overlay must render after Fog.");

assert.ok(app.includes("drawSelectedObservationOverlay"));
assert.ok(app.includes("drawOverlayLayer(renderer)"));

console.log("Sprint 4 Stage 3D observation render-layer fix tests passed.");
