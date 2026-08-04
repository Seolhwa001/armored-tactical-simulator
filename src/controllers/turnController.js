// src/controllers/turnController.js — 신규 파일, 예상 1~230행

export function createTurnController({
  state,
  mapRenderer,
  hexRadius,
  ammunitionTypes,
  unitActions,
  hunterKillerStates,
  hexToWorld,
  advanceUnitMovement,
  processPersistentActions,
  updateFireProcedure,
  beginReloading,
  registerAdjustedShot,
  acceptHunterKillerTarget,
  removeExpiredSmokeAreas,
  updateDetection,
  updateFog,
  addFireEffect,
  addContactEffect,
  getPlayerUnit,
  setMessage,
  updateSummary,
  updateTurnLabel,
  refreshCommandPanel,
  refreshFirePanel,
  startEffectLoop,
}) {
  function getUnits() {
    return state.runtimeScenario?.units ?? [];
  }

  function getPlayerTank() {
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

  function formatShotResult(result) {
    if (!result) {
      return "발사";
    }

    if (result.smokeCreated) {
      return "연막 형성";
    }

    if (!result.hit) {
      return result.reason;
    }

    if (result.destroyed) {
      return `명중 / 피해 ${result.damage} / 격파`;
    }

    const remainingHealth =
      result.remainingHealth !== null &&
      result.remainingHealth !== undefined
        ? ` / 잔여 체력 ${result.remainingHealth}`
        : "";

    return (
      `명중 / 피해 ${result.damage}` +
      remainingHealth
    );
  }

  function addAdjustedShotFeedback(
    adjustedShot,
  ) {
    const { unit, result } =
      adjustedShot;

    const targetHex =
      unit.fireControl?.targetHex;

    if (!targetHex) {
      return;
    }

    addFireEffect(
      state.effects,
      unit,
      targetHex,
      unit.fireControl.ammunition,
    );

    setMessage(
      `쏴-수정: ${formatShotResult(
        result.shotResult,
      )}`,
    );
  }

  function collectInitiallyHiddenEnemies() {
    return new Set(
      getUnits()
        .filter(
          (enemy) =>
            enemy.side === "enemy" &&
            !enemy.visible &&
            !enemy.destroyed,
        )
        .map((enemy) => enemy.id),
    );
  }

  function advanceFriendlyMovement(
    processedTurn,
  ) {
    const movingUnitIds = new Set();

    getUnits()
      .filter(
        (unit) =>
          unit.side === "friendly" &&
          !unit.destroyed,
      )
      .forEach((unit) => {
        const result =
          advanceUnitMovement({
            unit,
            turn: processedTurn,

            hexToWorld: (
              column,
              row,
            ) =>
              hexToWorld(
                column,
                row,
                hexRadius,
              ),
          });

        if (result.moved) {
          movingUnitIds.add(unit.id);
        }
      });

    return movingUnitIds;
  }

  function processActions(
    processedTurn,
    movingUnitIds,
  ) {
    return processPersistentActions(
      state.runtimeScenario,
      processedTurn,
      {
        movingUnitIds,
        hunterKillerStates,
        updateFireProcedure,
        beginReloading,
        registerAdjustedShot,
        acceptHunterKillerTarget,
      },
    );
  }

  function addReconByFireEffects() {
    getUnits()
      .filter(
        (unit) =>
          unit.side === "friendly" &&
          !unit.destroyed &&
          unit.action?.type ===
            unitActions.RECON_BY_FIRE &&
          unit.action.targetHex,
      )
      .forEach((unit) => {
        addFireEffect(
          state.effects,
          unit,
          unit.action.targetHex,
          ammunitionTypes.HEAT,
          {
            reconByFire: true,
          },
        );
      });
  }

  function addNewContactEffects(
    hiddenBefore,
  ) {
    const newContacts = getUnits().filter(
      (enemy) =>
        enemy.side === "enemy" &&
        !enemy.destroyed &&
        enemy.visible &&
        hiddenBefore.has(enemy.id),
    );

    newContacts.forEach((enemy) => {
      addContactEffect(
        state.effects,
        enemy,
      );
    });

    return newContacts;
  }

  function refreshPanels() {
    if (
      state.activeCategory === "fire" ||
      state.activeCategory === "combat"
    ) {
      refreshFirePanel();
      return;
    }

    if (state.activeCategory) {
      refreshCommandPanel(
        state.activeCategory,
      );
    }
  }

  function executeTurn() {
    const playerUnit = getPlayerTank();

    if (
      !playerUnit ||
      playerUnit.destroyed
    ) {
      const message =
        "자차가 격파되어 턴을 실행할 수 없습니다.";

      setMessage(message);

      return {
        success: false,
        processedTurn: null,
        adjustedShots: [],
        newContacts: [],
        message,
      };
    }

    const processedTurn = state.turn;

    const hiddenBefore =
      collectInitiallyHiddenEnemies();

    const movingUnitIds =
      advanceFriendlyMovement(
        processedTurn,
      );

    const actionResult =
      processActions(
        processedTurn,
        movingUnitIds,
      );

    addReconByFireEffects();

    actionResult.adjustedShots.forEach(
      addAdjustedShotFeedback,
    );

    state.turn += 1;
    state.runtimeScenario.turn =
      state.turn;

    removeExpiredSmokeAreas(
      state.runtimeScenario,
      state.turn,
    );

    updateDetection(
      state.runtimeScenario,
      state.turn,
    );

    const newContacts =
      addNewContactEffects(
        hiddenBefore,
      );

    const fogChanged = updateFog(
      state.fog,
      state.terrain,
      getUnits(),
    );

    if (fogChanged) {
      mapRenderer.invalidateFog();
    }

    updateTurnLabel(state.turn);

    state.selectedCommand = null;

    updateSummary();
    refreshPanels();

    const message =
      `TURN ${processedTurn} 처리 완료`;

    if (
      actionResult.adjustedShots
        .length === 0
    ) {
      setMessage(message);
    }

    startEffectLoop();

    return {
      success: true,
      processedTurn,
      adjustedShots:
        actionResult.adjustedShots,
      newContacts,
      movingUnitIds,
      message,
    };
  }

  return {
    executeTurn,
  };
}
