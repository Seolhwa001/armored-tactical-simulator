// ============================================================
// ATS PROJECT
// File      : src/controllers/scenarioController.js
// Sprint    : 3.9.1
// Revision  : R3
// Build     : 2026-08-05
// Type      : FULL REPLACEMENT
// Purpose   : Scenario initialization and initial crew synchronization
// ============================================================

export function createScenarioController({
  state,
  mapRenderer,
  terrainTypes,
  detectionStages,
  mapColumns,
  mapRows,
  hexRadius,
  loadScenario,
  restartScenario: restartRuntimeScenario,
  getPlayerUnit,
  getHexDistance,
  generateTerrain,
  getAvailablePlacementHexes,
  ensureUnitHexesPassable,
  synchronizeCrewObservationDirections,
  resetFog,
  clearEffects,
  updateDetection,
  updateFog,
  hexToWorld,
  updateSummary,
  turnLabel,
}) {
  function getUnits() {
    return state.runtimeScenario?.units ?? [];
  }

  function getSelectedUnit() {
    if (!state.runtimeScenario) {
      return null;
    }

    const playerUnit = getPlayerUnit(
      state.runtimeScenario,
    );

    if (
      !playerUnit ||
      playerUnit.id !== state.playerUnitId
    ) {
      return null;
    }

    return playerUnit;
  }

  function chooseRandomHex(
    available,
    occupied,
    validator = () => true,
  ) {
    const candidates = available.filter(
      (hex) =>
        !occupied.has(
          `${hex.column},${hex.row}`,
        ) &&
        validator(hex),
    );

    const selected =
      candidates[
        Math.floor(
          Math.random() *
            candidates.length,
        )
      ];

    if (!selected) {
      throw new Error(
        "객체 랜덤 배치에 실패했습니다.",
      );
    }

    occupied.add(
      `${selected.column},${selected.row}`,
    );

    return selected;
  }

  function randomizeUnitPositions() {
    const available =
      getAvailablePlacementHexes(
        state.terrain,
        terrainTypes,
      );

    const occupied = new Set();

    const friendlies =
      getUnits().filter(
        (unit) =>
          unit.side === "friendly",
      );

    const enemies =
      getUnits().filter(
        (unit) =>
          unit.side === "enemy",
      );

    friendlies.forEach((unit) => {
      Object.assign(
        unit,
        chooseRandomHex(
          available,
          occupied,
        ),
      );
    });

    enemies.forEach((unit) => {
      Object.assign(
        unit,
        chooseRandomHex(
          available,
          occupied,
          (hex) =>
            friendlies.every(
              (friendly) =>
                getHexDistance(
                  hex,
                  friendly,
                ) >= 8,
            ),
        ),
      );

      unit.detectionStage =
        detectionStages.HIDDEN;

      unit.visible = false;
      unit.detected = false;
      unit.identified = false;
      unit.lastKnownPosition = null;

      unit.detectedByUnitId =
        null;

      unit.detectedByCrewRole =
        null;

      unit.detectionConfidence =
        0;
    });
  }

  function synchronizeInitialCrewObservation() {
    if (
      typeof synchronizeCrewObservationDirections !==
      "function"
    ) {
      return;
    }

    getUnits()
      .filter(
        (unit) =>
          unit.type === "tank" &&
          !unit.destroyed &&
          unit.crewObservation,
      )
      .forEach((unit) => {
        synchronizeCrewObservationDirections(
          unit,
          state.turn,
        );
      });
  }

  function initializeScenario({
    restart = false,
  } = {}) {
    state.terrain = generateTerrain({
      columns: mapColumns,
      rows: mapRows,
    });

    state.runtimeScenario =
      restart &&
      state.runtimeScenario
        ? restartRuntimeScenario(
            state.runtimeScenario,
          )
        : loadScenario();

    state.runtimeScenario.smokeAreas =
      [];

    randomizeUnitPositions();

    ensureUnitHexesPassable(
      state.terrain,
      getUnits(),
    );

    state.turn = 1;

    state.runtimeScenario.turn =
      state.turn;

    const playerUnit = getPlayerUnit(
      state.runtimeScenario,
    );

    state.playerUnitId =
      playerUnit?.id ?? null;

    state.selectedUnitId =
      state.playerUnitId;

    state.debugSelectedUnitId =
      state.selectedUnitId;

    state.selectedCommand = null;
    state.selectedHex = null;

    synchronizeInitialCrewObservation();

    resetFog(state.fog);
    clearEffects(state.effects);

    updateDetection(
      state.runtimeScenario,
      state.turn,
    );

    updateFog(
      state.fog,
      state.terrain,
      getUnits(),
    );

    mapRenderer.invalidateTerrain();
    mapRenderer.invalidateFog();

    if (turnLabel) {
      turnLabel.textContent =
        "TURN 1";
    }

    updateSummary();

    return state.runtimeScenario;
  }

  function centerCamera() {
    const unit = getSelectedUnit();

    if (!unit) {
      return false;
    }

    const viewport =
      mapRenderer.getViewportSize();

    const point = hexToWorld(
      unit.column,
      unit.row,
      hexRadius,
    );

    state.camera.x =
      viewport.width / 2 -
      point.x *
        state.camera.zoom;

    state.camera.y =
      viewport.height / 2 -
      point.y *
        state.camera.zoom;

    return true;
  }

  function startScenario() {
    return initializeScenario({
      restart: false,
    });
  }

  function restartScenario() {
    return initializeScenario({
      restart: true,
    });
  }

  return {
    startScenario,
    restartScenario,
    centerCamera,
  };
}
