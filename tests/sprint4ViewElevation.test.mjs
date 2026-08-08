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

const clearTerrain = makeTerrain([
  { column: 0, row: 0, elevation: 10 },
  { column: 1, row: 0, elevation: 10.6 },
  { column: 2, row: 0, elevation: 10 },
]);

const clearView = calculateViewHexes({
  origin: { column: 0, row: 0 },
  direction: 0,
  fieldOfView: Math.PI * 2,
  maximumRange: 3,
  terrain: clearTerrain,
});

assert.equal(
  clearView.has(toHexKey(2, 0)),
  true,
  'a 0.6m rise does not block a 2.5m-high observer sight line',
);

const ridgeTerrain = makeTerrain([
  { column: 0, row: 0, elevation: 10 },
  { column: 1, row: 0, elevation: 13.2 },
  { column: 2, row: 0, elevation: 10 },
]);

const ridgeView = calculateViewHexes({
  origin: { column: 0, row: 0 },
  direction: 0,
  fieldOfView: Math.PI * 2,
  maximumRange: 3,
  terrain: ridgeTerrain,
});

assert.equal(ridgeView.has(toHexKey(1, 0)), true, 'ridge hex remains visible');
assert.equal(ridgeView.has(toHexKey(2, 0)), false, 'ridge above sight line blocks the hex behind it');

console.log('Sprint 4 View elevation tests passed.');
