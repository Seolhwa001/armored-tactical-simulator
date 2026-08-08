import assert from 'node:assert/strict';
import { updateDetection, DETECTION_STAGES } from '../src/engine/detection.js';
import { getHexDirection } from '../src/engine/hexGeometry.js';

function makeTerrain() {
  const terrain = new Map();
  for (let column = 0; column <= 3; column += 1) {
    terrain.set(`${column},0`, {
      column,
      row: 0,
      type: 'open',
      elevation: 10,
    });
  }
  return terrain;
}

function makeObserver(role) {
  const direction = getHexDirection(
    { column: 0, row: 0 },
    { column: 2, row: 0 },
  );

  return {
    id: `observer-${role}`,
    side: 'friendly',
    destroyed: false,
    column: 0,
    row: 0,
    hullDirection: direction,
    sensors: {
      visualRange: 10,
      identificationRange: 6,
    },
    crewObservation: {
      observers: {
        commander: { enabled: false, observing: false },
        gunner: {
          enabled: role === 'gunner',
          observing: role === 'gunner',
          direction,
          fieldOfView: Math.PI / 3,
          range: 1,
          identificationFactor: 1,
        },
        driver: {
          enabled: role === 'driver',
          observing: role === 'driver',
          direction,
          fieldOfView: Math.PI / 3,
          range: 1,
          identificationFactor: 1,
        },
        loader: { enabled: false, observing: false },
      },
      commanderIndependentSight: {
        operational: false,
        active: false,
      },
    },
  };
}

function makeEnemy() {
  return {
    id: 'enemy-1',
    side: 'enemy',
    destroyed: false,
    column: 2,
    row: 0,
    concealment: 0,
    detectionStage: DETECTION_STAGES.HIDDEN,
    temporaryExposure: 0,
    exposedUntilTurn: null,
  };
}

for (const role of ['gunner', 'driver']) {
  const enemy = makeEnemy();
  const runtimeScenario = {
    turn: 1,
    terrain: makeTerrain(),
    smokeAreas: [],
    units: [makeObserver(role), enemy],
  };

  updateDetection(runtimeScenario, 1);

  assert.ok(
    enemy.detectionStage >= DETECTION_STAGES.CONTACT,
    `${role} view detects an enemy inside its valid View`,
  );
  assert.equal(enemy.detectedByCrewRole, role);
}

console.log('Sprint 4 crew Detection tests passed.');
