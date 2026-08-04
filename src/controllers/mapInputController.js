// src/controllers/mapInputController.js — 신규 파일, 예상 1~350행

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
    return state.runtimeScenario?.units ?? [];
  }

  function refreshFogAndRender() {
    const changed = updateFog(
      state.fog,
      state.terrain,
      getUnits(),
    );

    if (changed) {
      mapRenderer.invalidateFog();
    }

    updateDetection(
      state.runtimeScenario,
      state.turn,
    );

    updateSummary();
    render();
  }

  function calculateDirection(from, to) {
    const start = hexToWorld(
      from.column,
      from.row,
      hexRadius,
    );

    const end = hexToWorld(
      to.column,
      to.row,
      hexRadius,
    );

    return Math.atan2(
      end.y - start.y,
      end.x - start.x,
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

    const result = planUnitMovement({
      unit,
      destination: hex,
      getNeighbors,
      getMovementCost,
    });

    if (!result.success) {
      setMessage(result.reason);
      return;
    }

    setPersistentAction(
      unit,
      {
        type: unitActions.MOVE,
        targetHex: hex,
        label: command.label,
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
    const direction = calculateDirection(
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
        turn: state.turn,
      });

      return;
    }

    setPersistentAction(
      unit,
      {
        type: unitActions.OBSERVE,
        targetHex: hex,
        direction,
        crewRole:
          command.crewRole ?? null,
        label:
          command.label ?? "감시",
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
    const hiddenBefore = new Set(
      getUnits()
        .filter(
          (enemy) =>
            enemy.side === "enemy" &&
            !enemy.visible,
        )
        .map((enemy) => enemy.id),
    );

    const affected = applyReconByFire(
      state.runtimeScenario,
      unit,
      hex,
      state.turn,
    );

    addFireEffect(
      state.effects,
      unit,
      hex,
      ammunitionTypes.HEAT,
      {
        reconByFire: true,
      },
    );

    updateDetection(
      state.runtimeScenario,
      state.turn,
    );

    affected.forEach((enemy) => {
      if (
        hiddenBefore.has(enemy.id) &&
        enemy.visible
      ) {
        addContactEffect(
          state.effects,
          enemy,
        );
      }
    });

    setMessage(
      `화력수색 시작: ${hex.column}, ${hex.row}`,
    );

    startEffectLoop();
  }

  function findVisibleEnemyAtHex(hex) {
    return getUnits().find(
      (candidate) =>
        candidate.side === "enemy" &&
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
      findVisibleEnemyAtHex(hex);

    if (!target) {
      setMessage(
        "헌터킬러로 지정할 탐지 표적이 없습니다.",
      );

      return;
    }

    if (
      typeof state.selectedCommand
        ?.onTarget === "function"
    ) {
      state.selectedCommand.onTarget({
        unit,
        targetUnit: target,
        hex,
        turn: state.turn,
      });

      return;
    }

    setMessage(
      "헌터킬러 표적 지정 기능이 연결되지 않았습니다.",
    );
  }

  function handleFireTarget(hex) {
    const enemy =
      findVisibleEnemyAtHex(hex);

    firePanel.setTarget(
      hex,
      enemy?.id ?? null,
    );
  }

  function showTerrainInformation(hex) {
    const terrain = state.terrain.get(
      `${hex.column},${hex.row}`,
    );

    if (!terrain) {
      render();
      return false;
    }

    const type =
      terrainTypes[terrain.type];

    setMessage(
      `${type.name} | 고도 ${terrain.elevation}m | 은폐 ${type.concealment}% | 엄폐 ${type.cover}%`,
    );

    return true;
  }

  function handleHexSelection(hex) {
    if (
      !hex ||
      !Number.isFinite(hex.column) ||
      !Number.isFinite(hex.row)
    ) {
      return;
    }

    const unit = getSelectedUnit();

    state.selectedHex = {
      column: hex.column,
      row: hex.row,
    };

    if (!unit) {
      render();
      return;
    }

    if (unit.destroyed) {
      state.selectedCommand = null;

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
      command?.id === "observation" ||
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
      command?.id === "hunter-killer"
    ) {
      handleHunterKillerTarget(
        unit,
        state.selectedHex,
      );
    } else if (
      command?.id === "recon-by-fire"
    ) {
      handleReconByFireTarget(
        unit,
        state.selectedHex,
      );
    } else if (
      command?.id === "fire-target"
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

    state.selectedCommand = null;

    refreshFogAndRender();

    if (
      state.activeCategory === "fire" ||
      state.activeCategory === "combat"
    ) {
      firePanel.render();
    }
  }

  function worldToHex(
    worldX,
    worldY,
  ) {
    let nearest = null;
    let distance = Infinity;

    state.terrain.forEach((hex) => {
      const point = hexToWorld(
        hex.column,
        hex.row,
        hexRadius,
      );

      const current = Math.hypot(
        worldX - point.x,
        worldY - point.y,
      );

      if (current < distance) {
        distance = current;
        nearest = hex;
      }
    });

    return distance <= hexRadius
      ? nearest
      : null;
  }

  function getTappedUnit(
    worldX,
    worldY,
  ) {
    return getUnits().find((unit) => {
      if (
        unit.destroyed ||
        !isUnitVisible(
          unit,
          state.developerMode,
        )
      ) {
        return false;
      }

      const point = hexToWorld(
        unit.column,
        unit.row,
        hexRadius,
      );

      return (
        Math.hypot(
          worldX - point.x,
          worldY - point.y,
        ) <= 30
      );
    });
  }

  function showTappedUnitInformation(
    tappedUnit,
  ) {
    const playerUnit =
      getSelectedUnit();

    if (
      tappedUnit.id ===
      playerUnit?.id
    ) {
      setMessage(
        `${playerUnit.name} / ${getHealthSummary(playerUnit)}`,
      );
    } else if (
      tappedUnit.side === "enemy"
    ) {
      setMessage(
        tappedUnit.identified
          ? `${tappedUnit.name ?? tappedUnit.id} 접촉`
          : "미확인 적 접촉",
      );
    } else {
      setMessage(
        `${tappedUnit.name ?? tappedUnit.id} 위치`,
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
      canvas.getBoundingClientRect();

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

    const tappedHex = tappedUnit
      ? {
          column: tappedUnit.column,
          row: tappedUnit.row,
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
