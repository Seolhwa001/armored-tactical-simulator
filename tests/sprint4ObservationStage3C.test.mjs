import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here =
  path.dirname(
    fileURLToPath(import.meta.url),
  );

const renderer =
  fs.readFileSync(
    path.resolve(
      here,
      "../src/render/unitRenderer.js",
    ),
    "utf8",
  );

const mapInput =
  fs.readFileSync(
    path.resolve(
      here,
      "../src/controllers/mapInputController.js",
    ),
    "utf8",
  );

for (const label of [
  "전차장",
  "포수",
  "조종수",
  "탄약수",
  "CPS",
]) {
  assert.ok(
    renderer.includes(label),
    `Missing observer direction label: ${label}`,
  );
}

assert.ok(
  renderer.includes(
    "drawObservationDirectionIndicator",
  ),
);

assert.ok(
  renderer.includes(
    "candidate.id === selectedUnitId",
  ),
  "Observation overlays should be limited to the selected unit.",
);

assert.ok(
  mapInput.includes(
    "고도 ${terrain.elevation}m",
  ),
);

assert.ok(
  mapInput.includes(
    "이동 ${movementCost}",
  ),
);

console.log(
  "Sprint 4 Observation Stage 3C UI tests passed.",
);
