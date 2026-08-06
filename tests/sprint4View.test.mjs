import assert from "node:assert/strict";
import {
  calculateViewHexes,
  getHexLine,
  toHexKey,
} from "../src/engine/view.js";

function makeTerrain(radius = 5) {
  const terrain = new Map();
  for (let row = -radius; row <= radius; row += 1) {
    for (let column = -radius; column <= radius; column += 1) {
      terrain.set(toHexKey(column, row), {
        column,
        row,
        type: "open",
      });
    }
  }
  return terrain;
}

const terrain = makeTerrain();
const eastView = calculateViewHexes({
  origin: { column: 0, row: 0 },
  direction: 0,
  fieldOfView: Math.PI / 3,
  maximumRange: 4,
  terrain,
});

assert.equal(eastView.has("3,0"), true);
assert.equal(eastView.has("-3,0"), false);

terrain.get("1,0").type = "forest";
terrain.get("2,0").type = "forest";
terrain.get("3,0").type = "forest";
const forestView = calculateViewHexes({
  origin: { column: 0, row: 0 },
  direction: 0,
  fieldOfView: Math.PI / 2,
  maximumRange: 5,
  terrain,
  forestVisibleDepth: 2,
});
assert.equal(forestView.has("2,0"), true);
assert.equal(forestView.has("3,0"), false);

const smokeView = calculateViewHexes({
  origin: { column: 0, row: 0 },
  direction: 0,
  fieldOfView: Math.PI / 2,
  maximumRange: 5,
  terrain: makeTerrain(),
  smokeAreas: [{ column: 2, row: 0, radius: 0 }],
});
assert.equal(smokeView.has("2,0"), true);
assert.equal(smokeView.has("3,0"), false);

assert.deepEqual(getHexLine(
  { column: 0, row: 0 },
  { column: 3, row: 0 },
).map((hex) => toHexKey(hex.column, hex.row)), ["0,0", "1,0", "2,0", "3,0"]);

console.log("Sprint 4 View tests passed.");
