import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here =
  path.dirname(
    fileURLToPath(import.meta.url),
  );

const files = [
  "../src/engine/actions.js",
  "../src/engine/fireControl.js",
  "../src/ui/firePanel.js",
];

const source =
  files
    .map((file) =>
      fs.readFileSync(
        path.resolve(here, file),
        "utf8",
      ),
    )
    .join("\n");

assert.equal(
  source.includes("procedureDiagnostics"),
  false,
);

assert.equal(
  source.includes("진단 · 이동"),
  false,
);

console.log(
  "Sprint 4 temporary procedure diagnostics cleanup test passed.",
);
