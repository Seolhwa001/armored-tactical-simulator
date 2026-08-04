// src/engine/runtime/unitFactory.js — 새 파일, 전체 코드

import { DETECTION_STAGES } from "../detection.js";
import { createFireControl } from "../fireControl.js";
import { createTurretControl } from "../turretControl.js";
import { createIdleAction } from "../factories/actionFactory.js";
import { createCrewObservation } from "./crewFactory.js";
import { createRuntimeHealth } from "./healthFactory.js";
import { createRuntimeProtection } from "./protectionFactory.js";
import { createRuntimeSensors } from "./sensorFactory.js";

export function createRuntimeUnit(unitData) {
  const friendly =
    unitData.side === "friendly";

  const isTank =
    unitData.type === "tank";

  const hullDirection =
    unitData.hullDirection ?? 0;

  const turretDirection =
    unitData.turretDirection ??
    hullDirection;

  const baseConcealment =
    unitData.concealment ?? 0;

  return {
    ...unitData,

    condition: "정상",
    command: "대기",
    destroyed: false,

    destination: null,
    plannedPath: [],
    movementHistory: [],

    hullDirection,
    turretDirection,
    direction: hullDirection,

    detectionStage: friendly
      ? DETECTION_STAGES.IDENTIFIED
      : DETECTION_STAGES.HIDDEN,

    visible: friendly,
    detected: friendly,
    identified: friendly,

    lastKnownPosition: null,

    detectionConfidence:
      friendly ? 100 : 0,

    baseConcealment,
    concealment: baseConcealment,

    temporaryExposure: 0,
    exposedUntilTurn: null,

    hatchState:
      isTank ? "open" : null,

    sensors: createRuntimeSensors({
      unitData,
      unitType: unitData.type,
    }),

    crewObservation: isTank
      ? createCrewObservation({
          hullDirection,
        })
      : null,

    action: createIdleAction({
      startedTurn: 1,
    }),

    fireControl: isTank
      ? createFireControl()
      : null,

    turretControl: isTank
      ? createTurretControl(unitData)
      : null,

    protection:
      createRuntimeProtection({
        unitData,
        unitType: unitData.type,
      }),

    health: createRuntimeHealth({
      unitData,
      unitType: unitData.type,
    }),
  };
}
