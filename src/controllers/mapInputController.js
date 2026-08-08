// ============================================================
// ATS PROJECT
// File      : src/controllers/mapInputController.js
// Sprint    : 3.9.1
// Revision  : R11
// Build     : 2026-08-05
// Type      : FULL REPLACEMENT
// Purpose   : Map input with isolated developer inspection and detection-first fog refresh
// ============================================================

import {
  getHexDirection,
} from "../engine/hexGeometry.js";

const DETECTION_STAGE_LABELS =
  Object.freeze({
    0: "HIDDEN",
    1: "CONTACT",
    2: "DETECTED",
    3: "IDENTIFIED",
  });

const DETECTION_CREW_ROLE_LABELS =
  Object.freeze({
    commander:
      "전차장",

    gunner:
      "포수",

    driver:
      "조종수",

    loader:
      "탄약수",

    "commander-cps":
      "CPS",

    "recon-by-fire":
      "화력수색",
  });

export function createMapInputController({
  state,
  canvas,
  mapRenderer,
  terrainTypes,
  movementCommands,
  unitActions,
  ammunitionTypes,
  hexRadius,
  hexToWorld,
  getSelectedUnit,
  getHealthSummary,
  getNeighbors,
  getMovementCost,
  planUnitMovement,
  setPersistentAction,
  applyReconByFire,
  isUnitVisible,
  updateDetection,
  updateFog,
  addFireEffect,
  addContactEffect,
  firePanel,
  setMessage,
  updateSummary,
  render,
  startEffectLoop,
}) {
  function getUnits() {
    return (
      state.runtimeScenario
        ?.units ?? []
    );
  }

  function getUnitById(unitId) {
    if (!unitId) {
      return null;
    }

    return (
      getUnits().find(
        (unit) =>
          unit.id === unitId,
      ) ??
      null
    );
  }

  function getUnitDisplayName(unit) {
    if (!unit) {
      return "없음";
    }

    return (
      unit.name ??
      unit.id ??
      "없음"
    );
  }

  function getDetectionStageLabel(
    unit,
  ) {
    const detectionStage =
      unit.detectionStage;

    return (
      DETECTION_STAGE_LABELS[
        detectionStage
      ] ??
      `UNKNOWN(${detectionStage ?? "-"})`
    );
  }

  function getDetectionCrewRoleLabel(
    unit,
  ) {
    const crewRole =
      unit.detectedByCrewRole;

    if (!crewRole) {
      return "없음";
    }

    return (
      DETECTION_CREW_ROLE_LABELS[
        crewRole
      ] ??
      crewRole
    );
  }

  function getDetectionUnitLabel(unit) {
    const detectionUnit =
      getUnitById(
        unit.detectedByUnitId,
      );

    return getUnitDisplayName(
      detectionUnit,
    );
  }

  function getDetectionConfidenceLabel(
    unit,
  ) {
    const confidence =
      Number.isFinite(
        unit.detectionConfidence,
      )
        ? Math.max(
            0,
            Math.min(
              100,
              unit.detectionConfidence,
            ),
          )
        : 0;

    return `${confidence}%`;
  }

  function getTemporaryExposureValue(
    unit,
  ) {
    if (
      !Number.isFinite(
        unit.temporaryExposure,
      )
    ) {
      return 0;
    }

    return Math.max(
      0,
      unit.temporaryExposure,
    );
  }

  function isTemporaryExposureActive(
    unit,
  ) {
    const exposure =
      getTemporaryExposureValue(
        unit,
      );

    return (
      exposure > 0 &&
      Number.isFinite(
        unit.exposedUntilTurn,
      ) &&
      unit.exposedUntilTurn >=
        state.turn
    );
  }

  function getTemporaryExposureLabel(
    unit,
  ) {
    if (
      !isTemporaryExposureActive(
        unit,
      )
    ) {
      return "없음";
    }

    return (
      `+${getTemporaryExposureValue(
        unit,
      )} / TURN ` +
      `${unit.exposedUntilTurn}까지`
    );
  }

  function createDeveloperDetectionMessage(
    unit,
  ) {
    return [
      `탐지 단계 ${getDetectionStageLabel(
        unit,
      )}`,

      `탐지 신뢰도 ${getDetectionConfidenceLabel(
        unit,
      )}`,

      `탐지 차량 ${getDetectionUnitLabel(
        unit,
      )}`,

      `탐지 승무원 ${getDetectionCrewRoleLabel(
        unit,
      )}`,

      `화력수색 노출 ${getTemporaryExposureLabel(
        unit,
      )}`,
    ].join(" | ");
  }

  function refreshFogAndRender() {
    updateDetection(
      state.runtimeScenario,
      state.turn,
    );

    const changed =
      updateFog(
        state.fog,
        state.terrain,
        getUnits(),
        state.runtimeScenario?.smokeAreas ?? [],
        state.turn,
      );

    if (changed) {
      mapRenderer
        .invalidateFog();
    }

    updateSummary();
    render();
  }

  function calculateDirection(
    from,
    to,
  ) {
    return getHexDirection(
      from,
      to,
    );
  }

  function handleMovementTarget(
    unit,
    command,
    hex,
  ) {
    if (unit.destroyed) {
      setMessage(
        "격파된 전차는 이동할 수 없습니다.",
      );

      return;
    }

    const result =
      planUnitMovement({
        unit,

        destination:
          hex,

        getNeighbors,
        getMovementCost,
      });

    if (!result.success) {
      setMessage(
        result.reason,
      );

      return;
    }

    setPersistentAction(
      unit,
      {
        type:
          unitActions.MOVE,

        targetHex:
          hex,

        label:
          command.label,
      },
      state.turn,
    );

    setMessage(
      `${command.label}: ${unit.plannedPath.length}개 헥스 이동로 설정`,
    );
  }

  function handleObservationTarget(
    unit,
    command,
    hex,
  ) {
    const direction =
      calculateDirection(
        unit,
        hex,
      );

    if (
      typeof command.onTarget ===
      "function"
    ) {
      command.onTarget({
        unit,
        hex,
        direction,

        turn:
          state.turn,
      });

      return;
    }

    setPersistentAction(
      unit,
      {
        type:
          unitActions.OBSERVE,

        targetHex:
          hex,

        direction,

        crewRole:
          command.crewRole ??
          null,

        label:
          command.label ??
          "감시",
      },
      state.turn,
    );

    setMessage(
      `${command.label ?? "감시"} 방향 지정: ${hex.column}, ${hex.row}`,
    );
  }

  function handleReconByFireTarget(
    unit,
    hex,
  ) {
    const action =
      applyReconByFire(
        state.runtimeScenario,
        unit,
        hex,
        state.turn,
      );

    if (!action) {
      setMessage(
        "화력수색 목표를 지정하지 못했습니다.",
      );
      return;
    }

    setMessage(
      `화력수색 목표 지정: ${hex.column}, ${hex.row}`,
    );

    updateSummary();
    render();
  }

  function findVisibleEnemyAtHex(
    hex,
  ) {
    return getUnits().find(
      (candidate) =>
        candidate.side ===
          "enemy" &&
        !candidate.destroyed &&
        candidate.column ===
          hex.column &&
        candidate.row ===
          hex.row &&
        isUnitVisible(
          candidate,
          state.developerMode,
        ),
    );
  }

  function handleHunterKillerTarget(
    unit,
    hex,
  ) {
    const target =
      findVisibleEnemyAtHex(
        hex,
      );

    if (!target) {
      setMessage(
        "헌터킬러로 지정할 탐지 표적이 없습니다.",
      );

      return;
    }

    if (
      typeof state.selectedCommand
        ?.onTarget ===
      "function"
    ) {
      state.selectedCommand
        .onTarget({
          unit,

          targetUnit:
            target,

          hex,

          turn:
            state.turn,
        });

      return;
    }

    setMessage(
      "헌터킬러 표적 지정 기능이 연결되지 않았습니다.",
    );
  }

  function handleFireTarget(hex) {
    const enemy =
      findVisibleEnemyAtHex(
        hex,
      );

    firePanel.setTarget(
      hex,
      enemy?.id ??
      null,
    );
  }

  function showTerrainInformation(
    hex,
  ) {
    const terrain =
      state.terrain.get(
        `${hex.column},${hex.row}`,
      );

    if (!terrain) {
      render();

      return false;
    }

    const type =
      terrainTypes[
        terrain.type
      ];

    const movementCost =
      Number.isFinite(
        type.movementCost,
      )
        ? type.movementCost
        : "통행불가";

    setMessage(
      `지형 ${type.name} | 고도 ${terrain.elevation}m | 이동 ${movementCost} | 은폐 ${type.concealment}% | 엄폐 ${type.cover}%`,
    );

    return true;
  }

  function handleHexSelection(hex) {
    if (
      !hex ||
      !Number.isFinite(
        hex.column,
      ) ||
      !Number.isFinite(
        hex.row,
      )
    ) {
      return;
    }

    const unit =
      getSelectedUnit();

    state.selectedHex = {
      column:
        hex.column,

      row:
        hex.row,
    };

    if (!unit) {
      render();

      return;
    }

    if (unit.destroyed) {
      state.selectedCommand =
        null;

      setMessage(
        "자차가 격파되어 명령을 실행할 수 없습니다.",
      );

      updateSummary();
      render();

      return;
    }

    const command =
      state.selectedCommand;

    if (
      movementCommands.has(
        command?.id,
      )
    ) {
      handleMovementTarget(
        unit,
        command,
        state.selectedHex,
      );
    } else if (
      command?.id ===
        "observation" ||
      command?.id ===
        "crew-observation" ||
      command?.id ===
        "commander-sight"
    ) {
      handleObservationTarget(
        unit,
        command,
        state.selectedHex,
      );
    } else if (
      command?.id ===
      "hunter-killer"
    ) {
      handleHunterKillerTarget(
        unit,
        state.selectedHex,
      );
    } else if (
      command?.id ===
      "recon-by-fire"
    ) {
      handleReconByFireTarget(
        unit,
        state.selectedHex,
      );
    } else if (
      command?.id ===
      "fire-target"
    ) {
      handleFireTarget(
        state.selectedHex,
      );
    } else if (
      !showTerrainInformation(
        state.selectedHex,
      )
    ) {
      return;
    }

    state.selectedCommand =
      null;

    refreshFogAndRender();

    if (
      state.activeCategory ===
        "fire" ||
      state.activeCategory ===
        "combat"
    ) {
      firePanel.render();
    }
  }

  function worldToHex(
    worldX,
    worldY,
  ) {
    let nearest =
      null;

    let distance =
      Infinity;

    state.terrain.forEach(
      (hex) => {
        const point =
          hexToWorld(
            hex.column,
            hex.row,
            hexRadius,
          );

        const current =
          Math.hypot(
            worldX -
              point.x,

            worldY -
              point.y,
          );

        if (
          current <
          distance
        ) {
          distance =
            current;

          nearest =
            hex;
        }
      },
    );

    return distance <=
      hexRadius
      ? nearest
      : null;
  }

  function getTappedUnit(
    worldX,
    worldY,
  ) {
    return getUnits().find(
      (unit) => {
        if (
          unit.destroyed ||
          !isUnitVisible(
            unit,
            state.developerMode,
          )
        ) {
          return false;
        }

        const point =
          hexToWorld(
            unit.column,
            unit.row,
            hexRadius,
          );

        return (
          Math.hypot(
            worldX -
              point.x,

            worldY -
              point.y,
          ) <= 30
        );
      },
    );
  }

  function getNormalUnitMessage(
    tappedUnit,
  ) {
    const playerUnit =
      getSelectedUnit();

    if (
      tappedUnit.id ===
      playerUnit?.id
    ) {
      return (
        `${playerUnit.name} / ` +
        `${getHealthSummary(
          playerUnit,
        )}`
      );
    }

    if (
      tappedUnit.side ===
      "enemy"
    ) {
      return tappedUnit.identified
        ? (
            `${tappedUnit.name ?? tappedUnit.id} 접촉`
          )
        : "미확인 적 접촉";
    }

    return (
      `${tappedUnit.name ?? tappedUnit.id} 위치`
    );
  }

  function showTappedUnitInformation(
    tappedUnit,
  ) {
    if (state.developerMode) {
      state.debugSelectedUnitId =
        tappedUnit.id;
    }

    const normalMessage =
      getNormalUnitMessage(
        tappedUnit,
      );

    if (
      state.developerMode &&
      tappedUnit.side ===
        "enemy"
    ) {
      setMessage(
        `${normalMessage} | ${createDeveloperDetectionMessage(
          tappedUnit,
        )}`,
      );
    } else {
      setMessage(
        normalMessage,
      );
    }

    updateSummary();
    render();
  }

  function handleMapTap(
    clientX,
    clientY,
  ) {
    const rectangle =
      canvas
        .getBoundingClientRect();

    const world = {
      x:
        (
          clientX -
          rectangle.left -
          state.camera.x
        ) /
        state.camera.zoom,

      y:
        (
          clientY -
          rectangle.top -
          state.camera.y
        ) /
        state.camera.zoom,
    };

    const tappedUnit =
      getTappedUnit(
        world.x,
        world.y,
      );

    const tappedHex =
      tappedUnit
        ? {
            column:
              tappedUnit.column,

            row:
              tappedUnit.row,
          }
        : worldToHex(
            world.x,
            world.y,
          );

    if (
      state.selectedCommand
        ?.needsTarget
    ) {
      if (tappedHex) {
        handleHexSelection(
          tappedHex,
        );
      }

      return;
    }

    if (tappedUnit) {
      showTappedUnitInformation(
        tappedUnit,
      );

      return;
    }

    if (tappedHex) {
      handleHexSelection(
        tappedHex,
      );
    }
  }

  return {
    handleMapTap,
    handleHexSelection,
  };
}
