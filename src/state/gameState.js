// src/state/gameState.js — 새 파일, 예상 1~43행

export function createGameState({
  createFogState,
  createEffectState,
} = {}) {
  if (
    typeof createFogState !== "function" ||
    typeof createEffectState !== "function"
  ) {
    throw new TypeError(
      "createGameState에는 createFogState와 createEffectState가 필요합니다.",
    );
  }

  return {
    runtimeScenario: null,
    terrain: new Map(),

    turn: 1,
    activeScreen: "menu",
    activeCategory: null,

    playerUnitId: null,
    selectedUnitId: null,
    selectedCommand: null,
    selectedHex: null,

    difficulty: "standard",
    developerMode: false,

    fog: createFogState(),
    effects: createEffectState(),

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
