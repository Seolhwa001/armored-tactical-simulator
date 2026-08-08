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

const mapRenderer =
  fs.readFileSync(
    path.resolve(
      here,
      "../src/render/mapRenderer.js",
    ),
    "utf8",
  );

assert.ok(
  renderer.includes("drawView: true"),
  "Hex View must remain in the normal dynamic render path.",
);

assert.ok(
  renderer.includes("drawDirection: false"),
  "Direction labels must not be drawn below Fog.",
);

assert.ok(
  renderer.includes("drawView: false"),
  "Overlay must not duplicate Hex View.",
);

assert.ok(
  renderer.includes("drawDirection: true"),
  "Direction UI must render in the overlay layer.",
);

assert.equal(
  renderer.includes("originOffset"),
  false,
  "Every observer direction line must begin at the vehicle center.",
);

const fogIndex =
  mapRenderer.indexOf(
    "context.drawImage(  \n  fogLayer.canvas",
  );

const overlayIndex =
  mapRenderer.indexOf(
    "drawOverlayLayer({",
  );

assert.ok(
  fogIndex >= 0 &&
  overlayIndex > fogIndex,
  "Direction overlay must render after Fog.",
);

console.log(
  "Sprint 4 Stage 3D Render Fix 2 tests passed.",
);
