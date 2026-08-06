import assert from 'node:assert/strict';
import {
  calculateViewHexes,
  toHexKey,
} from '../src/engine/view.js';

function makeTerrain(entries) {
  return new Map(entries.map((entry) => [
    toHexKey(entry.column, entry.row),
    { type: 'open', elevation: 0, ...entry },
  ]));
}

const terrain = makeTerrain([
  { column: 0, row: 0, elevation: 10 },
  { column: 1, row: 0, elevation: 10.6 },
  { column: 2, row: 0, elevation: 10 },
  { column: 0, row: -1, elevation: 10 },
  { column: 1, row: -1, elevation: 10 },
]);

const view = calculateViewHexes({
  origin: { column: 0, row: 0 },
  direction: 0,
  fieldOfView: Math.PI * 2,
  maximumRange: 3,
  terrain,
});

assert.equal(view.has(toHexKey(1, 0)), true, 'blocking ridge hex remains visible');
assert.equal(view.has(toHexKey(2, 0)), false, 'ridge blocks the hex behind it');
assert.equal(view.has(toHexKey(1, -1)), true, 'level terrain remains visible');

console.log('Sprint 4 View elevation tests passed.');
