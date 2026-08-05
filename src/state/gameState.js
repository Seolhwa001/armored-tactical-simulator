// ============================================================
// ATS PROJECT
// File      : src/state/gameState.js
// Sprint    : 3.9.1
// Revision  : R2
// Build     : 2026-08-05
// Type      : FULL REPLACEMENT
// Purpose   : Shared application state with isolated debug selection
// ============================================================

export function createGameState({
  createFogState,
  createEffectState,
} = {}) {
  if (
    typeof createFogState !==
      "function" ||
    typeof createEffectState !==
      "function"
  ) {
    throw new TypeError(
      "createGameState에는 createFogState와 createEffectState가 필요합니다.",
    );
  }

  return {
    runtimeScenario:
      null,

    terrain:
      new Map(),

    turn:
      1,

    activeScreen:
      "menu",

    activeCategory:
      null,

    playerUnitId:
      null,

    selectedUnitId:
      null,

    debugSelectedUnitId:
      null,

    selectedCommand:
      null,

    selectedHex:
      null,

    difficulty:
      "standard",

    developerMode:
      false,

    fog:
      createFogState(),

    effects:
      createEffectState(),

    camera: {
      x: 0,
      y: 0,
      zoom: 1,

      dragging: false,
      pointerId: null,

      lastX: 0,
      lastY: 0,

      downX: 0,
      downY: 0,

      moved: false,
    },
  };
}
