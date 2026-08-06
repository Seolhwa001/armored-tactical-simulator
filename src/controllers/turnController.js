// ============================================================
// ATS PROJECT
// File      : src/controllers/turnController.js
// Sprint    : 3.9.x
// Revision  : R5
// Build     : 2026-08-05
// Type      : PATCHED FULL REPLACEMENT
// Purpose   : Turn execution with hull-turn movement classification
// ============================================================

import {
  executeDirectedAction,
} from "../engine/fireControl.js";

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
      return result.reason ?? "빗나감";
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

  function getAdjustedShotAmmunition(result) {
    return (
      result?.ammunition ??
      result?.shotResult?.ammunition ??
      ammunitionTypes.HEAT
    );
  }

  function addAdjustedShotFeedback(
    adjustedShot,
  ) {
    const {
      unit,
      result,
    } = adjustedShot;

    const targetHex =
      unit.fireControl?.targetHex;

    if (
      !targetHex ||
      !result?.success
    ) {
      return;
    }

    const firedAmmunition =
      getAdjustedShotAmmunition(
        result,
      );

    addFireEffect(
      state.effects,
      unit,
      targetHex,
      firedAmmunition,
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
        .map(
          (enemy) =>
            enemy.id,
        ),
    );
  }

  function advanceFriendlyMovement(
    processedTurn,
  ) {
    const movingUnitIds =
      new Set();

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

            hexToWorld(
              column,
              row,
            ) {
              return hexToWorld(
                column,
                row,
                hexRadius,
              );
            },
          });

        // 이동뿐 아니라 제자리 선회·이동 중 선회도
        // 기동 상태로 분류하여 기존 사격·감시 페널티가
        // 동일한 처리 주기에서 적용되도록 한다.
        if (
          result.moved ||
          result.turned
        ) {
          movingUnitIds.add(
            unit.id,
          );
        }
      });

    return movingUnitIds;
  }

  function processActions(
    processedTurn,
    movingUnitIds,
  ) {
    const result =
      processPersistentActions(
        state.runtimeScenario,
        processedTurn,
        {
          movingUnitIds,
          hunterKillerStates,
          updateFireProcedure,
          beginReloading,
          registerAdjustedShot,
          acceptHunterKillerTarget,
          executeDirectedAction,
        },
      );

    return {
      adjustedShots:
        Array.isArray(
          result?.adjustedShots,
        )
          ? result.adjustedShots
          : [],

      completedDirectedActions:
        Array.isArray(
          result?.completedDirectedActions,
        )
          ? result.completedDirectedActions
          : [],
    };
  }

  function addDirectedActionFeedback(
    completedAction,
  ) {
    if (
      !completedAction?.unit ||
      !completedAction?.targetHex ||
      !completedAction?.result?.success
    ) {
      return;
    }

    addFireEffect(
      state.effects,
      completedAction.unit,
      completedAction.targetHex,
      completedAction.result.resourceType ??
        ammunitionTypes.HEAT,
      {
        reconByFire: true,
      },
    );

    setMessage(
      "화력수색 실행 완료",
    );
  }

  function addNewContactEffects(
    hiddenBefore,
  ) {
    const newContacts =
      getUnits().filter(
        (enemy) =>
          enemy.side === "enemy" &&
          !enemy.destroyed &&
          enemy.visible &&
          hiddenBefore.has(
            enemy.id,
          ),
      );

    newContacts.forEach(
      (enemy) => {
        addContactEffect(
          state.effects,
          enemy,
        );
      },
    );

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
    const playerUnit =
      getPlayerTank();

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

    const processedTurn =
      state.turn;

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

    actionResult.adjustedShots.forEach(
      addAdjustedShotFeedback,
    );

    actionResult.completedDirectedActions
      .forEach(
        addDirectedActionFeedback,
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

    const fogChanged =
      updateFog(
        state.fog,
        state.terrain,
        getUnits(),
        state.runtimeScenario?.smokeAreas ?? [],
        state.turn,
      );

    if (fogChanged) {
      mapRenderer.invalidateFog();
    }

    updateTurnLabel(
      state.turn,
    );

    state.selectedCommand =
      null;

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

      completedDirectedActions:
        actionResult.completedDirectedActions,

      newContacts,
      movingUnitIds,
      message,
    };
  }

  return {
    executeTurn,
  };
}
