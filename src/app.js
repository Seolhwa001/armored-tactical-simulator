// src/app.js — 전체 교체, 예상 1~560행

import {
  advanceUnitMovement,
  cancelUnitMovement,
  planUnitMovement,
} from "./engine/movement.js";

import {
  getPlayerUnit,
  loadScenario,
  restartScenario,
} from "./engine/scenarioRuntime.js";

import {
  DETECTION_STAGES,
  getHexDistance,
  isUnitVisible,
  updateDetection,
} from "./engine/detection.js";

import {
  applyReconByFire,
  processPersistentActions,
  setPersistentAction,
} from "./engine/actions.js";

import { UNIT_ACTIONS } from "./engine/constants/actionConstants.js";

import {
  HUNTER_KILLER_STATES,
} from "./engine/runtime/runtimeConstants.js";

import {
  AMMUNITION_TYPES,
  acceptHunterKillerTarget,
  beginReloading,
  registerAdjustedShot,
  updateFireProcedure,
} from "./engine/fireControl.js";

import {
  removeExpiredSmokeAreas,
} from "./engine/combat.js";

import {
  getTurretStatus,
} from "./engine/turretControl.js";

import {
  ensureUnitHexesPassable,
  generateTerrain,
  getAvailablePlacementHexes,
} from "./engine/terrainGenerator.js";

import {
  createMapRenderer,
  hexToWorld,
} from "./render/mapRenderer.js";

import {
  drawUnits,
} from "./render/unitRenderer.js";

import {
  createFogState,
  drawFogLayer,
  resetFog,
  updateFog,
} from "./render/fogRenderer.js";

import {
  addContactEffect,
  addFireEffect,
  clearEffects,
  createEffectState,
  drawEffects,
  removeUnitFireEffects,
  startEffectAnimation,
} from "./render/effectRenderer.js";

import {
  drawSmokeAreas,
} from "./render/smokeRenderer.js";

import {
  createCommandPanel,
} from "./ui/commandPanel.js";

import {
  createFirePanel,
} from "./ui/firePanel.js";

import {
  bindApplicationEvents,
} from "./ui/eventBindings.js";

import {
  createGameState,
} from "./state/gameState.js";

import {
  createScenarioController,
} from "./controllers/scenarioController.js";

import {
  createTurnController,
} from "./controllers/turnController.js";

import {
  createMapInputController,
} from "./controllers/mapInputController.js";

import {
  createCommandController,
} from "./controllers/commandController.js";

const HEX_RADIUS = 28;
const MAP_COLUMNS = 18;
const MAP_ROWS = 18;

const TERRAIN_TYPES = Object.freeze({
  open: {
    name: "개활지",
    color: "#263325",
    stroke: "#465747",
    symbol: "",
    movementCost: 1,
    concealment: 5,
    cover: 0,
  },

  grass: {
    name: "초지",
    color: "#35412d",
    stroke: "#53604a",
    symbol: "·",
    movementCost: 1,
    concealment: 10,
    cover: 0,
  },

  forest: {
    name: "숲",
    color: "#173224",
    stroke: "#355443",
    symbol: "♣",
    movementCost: 2,
    concealment: 70,
    cover: 25,
  },

  ridge: {
    name: "능선",
    color: "#474638",
    stroke: "#6f6b59",
    symbol: "⌃",
    movementCost: 2,
    concealment: 15,
    cover: 45,
  },

  road: {
    name: "도로",
    color: "#4a493f",
    stroke: "#737165",
    symbol: "═",
    movementCost: 0.6,
    concealment: 0,
    cover: 0,
  },

  water: {
    name: "하천",
    color: "#183b45",
    stroke: "#315d68",
    symbol: "≈",
    movementCost: Infinity,
    concealment: 0,
    cover: 0,
  },
});

const MOVEMENT_COMMANDS = new Set([
  "normal-move",
  "fire-maneuver",
  "evasive-maneuver",
]);

const TARGET_COMMANDS = new Set([
  ...MOVEMENT_COMMANDS,
  "observation",
  "crew-observation",
  "commander-sight",
  "hunter-killer",
  "recon-by-fire",
  "fire-target",
]);

const elements = {
  menuScreen: document.querySelector(
    "#menu-screen",
  ),

  battleScreen: document.querySelector(
    "#battle-screen",
  ),

  turnLabel: document.querySelector(
    "#turn-label",
  ),

  selectedUnitLabel: document.querySelector(
    "#selected-unit-label",
  ),

  currentCommandLabel: document.querySelector(
    "#current-command-label",
  ),

  unitConditionLabel: document.querySelector(
    "#unit-condition-label",
  ),

  commandOptions: document.querySelector(
    "#command-options",
  ),

  settingsDialog: document.querySelector(
    "#settings-dialog",
  ),

  projectInfoDialog: document.querySelector(
    "#project-info-dialog",
  ),

  difficultySelect: document.querySelector(
    "#difficulty-select",
  ),

  developerModeToggle: document.querySelector(
    "#developer-mode-toggle",
  ),

  canvas: document.querySelector(
    "#battle-map",
  ),

  mapMessage: document.querySelector(
    "#map-message",
  ),
};

if (
  !elements.canvas ||
  !elements.commandOptions ||
  !elements.menuScreen ||
  !elements.battleScreen ||
  !elements.turnLabel ||
  !elements.mapMessage
) {
  throw new Error(
    "ATS 필수 UI 요소를 찾을 수 없습니다.",
  );
}

const state = createGameState({
  createFogState,
  createEffectState,
});

const mapRenderer = createMapRenderer({
  canvas: elements.canvas,
  terrainTypes: TERRAIN_TYPES,
  hexRadius: HEX_RADIUS,
});

let commandPanel = null;
let firePanel = null;
let commandController = null;
let scenarioController = null;
let turnController = null;
let mapInputController = null;

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

function getSelectedUnit() {
  return getPlayerTank();
}

function isUnitMoving(unit) {
  return (
    Boolean(unit?.destination) &&
    Array.isArray(unit.plannedPath) &&
    unit.plannedPath.length > 0
  );
}

function setMessage(message) {
  elements.mapMessage.textContent =
    message ?? "";
}

function getHealthSummary(unit) {
  if (!unit.health) {
    return unit.condition;
  }

  if (unit.destroyed) {
    return "격파";
  }

  return (
    `${unit.condition} / ` +
    `체력 ${unit.health.current}` +
    `/${unit.health.maximum}`
  );
}

function getTurretSummary(unit) {
  const status = getTurretStatus(unit);

  if (!status) {
    return getHealthSummary(unit);
  }

  const modes = {
    normal: "정상구동",
    emergency: "비상구동",
    manual: "수동구동",
  };

  const stabilizer = status.stabilizerAvailable
    ? "안정화 정상"
    : status.stabilizerOperational
      ? "안정화 미사용"
      : "안정화 고장";

  const position = status.lockedToHull
    ? status.aligned
      ? "주포 정위치"
      : "정위치 중"
    : status.aligned
      ? "포탑 정렬"
      : "포탑 회전 중";

  return (
    `${getHealthSummary(unit)} / ` +
    `${modes[status.mode] ?? status.mode} / ` +
    `${stabilizer} / ` +
    position
  );
}

function updateSummary() {
  const unit = getSelectedUnit();

  elements.selectedUnitLabel.textContent =
    unit?.name ?? "자차 없음";

  elements.currentCommandLabel.textContent =
    unit?.command ?? "대기";

  elements.unitConditionLabel.textContent =
    unit
      ? getTurretSummary(unit)
      : "-";
}

function updateTurnLabel(turn) {
  elements.turnLabel.textContent =
    `TURN ${turn}`;
}

function getNeighbors(column, row) {
  const offsets = row % 2 === 0
    ? [
        [-1, 0],
        [1, 0],
        [-1, -1],
        [0, -1],
        [-1, 1],
        [0, 1],
      ]
    : [
        [-1, 0],
        [1, 0],
        [0, -1],
        [1, -1],
        [0, 1],
        [1, 1],
      ];

  return offsets.map(
    ([
      columnOffset,
      rowOffset,
    ]) => ({
      column:
        column + columnOffset,

      row:
        row + rowOffset,
    }),
  );
}

function getMovementCost(column, row) {
  const terrain = state.terrain.get(
    `${column},${row}`,
  );

  return terrain
    ? TERRAIN_TYPES[
        terrain.type
      ].movementCost
    : Infinity;
}

function drawTargetPreview({
  context,
  hexToWorld: convertHex,
}) {
  if (
    !state.selectedHex ||
    !TARGET_COMMANDS.has(
      state.selectedCommand?.id,
    )
  ) {
    return;
  }

  const point = convertHex(
    state.selectedHex.column,
    state.selectedHex.row,
  );

  context.save();

  context.strokeStyle = "#ffd078";
  context.fillStyle =
    "rgba(255, 208, 120, 0.18)";

  context.lineWidth = 3;

  context.beginPath();

  context.arc(
    point.x,
    point.y,
    18,
    0,
    Math.PI * 2,
  );

  context.fill();
  context.stroke();
  context.restore();
}

function render(
  now = performance.now(),
) {
  mapRenderer.render({
    terrain: state.terrain,
    camera: state.camera,
    fog: state.fog,
    developerMode:
      state.developerMode,
    drawFogLayer,
    now,

    drawDynamicLayer(renderer) {
      drawSmokeAreas({
        ...renderer,
        smokeAreas:
          state.runtimeScenario
            ?.smokeAreas ?? [],
        hexRadius: HEX_RADIUS,
      });

      drawUnits({
        ...renderer,
        units: getUnits(),
        selectedUnitId:
          state.selectedUnitId,
        developerMode:
          state.developerMode,
      });

      drawTargetPreview(
        renderer,
      );

      drawEffects({
        ...renderer,
        effectState:
          state.effects,
      });
    },
  });
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

function startEffectLoop() {
  startEffectAnimation(
    state.effects,
    render,
  );
}

commandPanel = createCommandPanel({
  container:
    elements.commandOptions,

  getSelectedUnit,

  getRuntimeScenario:
    () => state.runtimeScenario,

  getTurn:
    () => state.turn,

  onCommandSelected(
    command,
    selectedButton,
  ) {
    commandController
      ?.handleCommandSelection(
        command,
        selectedButton,
      );
  },

  onStateChanged:
    refreshFogAndRender,

  onMessage:
    setMessage,

  onCancelMovement:
    cancelUnitMovement,
});

firePanel = createFirePanel({
  container:
    elements.commandOptions,

  getSelectedUnit,

  getRuntimeScenario:
    () => state.runtimeScenario,

  getTurn:
    () => state.turn,

  isUnitMoving,

  onBeginTargetSelection() {
    commandController
      ?.beginFireTargetSelection();
  },

  onFireEffect(
    unit,
    target,
    ammunition,
  ) {
    addFireEffect(
      state.effects,
      unit,
      target,
      ammunition,
    );

    startEffectLoop();
  },

  onRemoveFireEffects(unitId) {
    removeUnitFireEffects(
      state.effects,
      unitId,
    );
  },

  onStateChanged() {
    updateSummary();
    render();
  },

  onMessage:
    setMessage,
});

commandController =
  createCommandController({
    state,

    commandOptions:
      elements.commandOptions,

    getSelectedUnit,
    commandPanel,
    firePanel,
    setMessage,
    refreshFogAndRender,
    updateSummary,
    render,
  });

scenarioController =
  createScenarioController({
    state,
    mapRenderer,
    terrainTypes:
      TERRAIN_TYPES,
    detectionStages:
      DETECTION_STAGES,
    mapColumns:
      MAP_COLUMNS,
    mapRows:
      MAP_ROWS,
    hexRadius:
      HEX_RADIUS,
    loadScenario,
    restartScenario,
    getPlayerUnit,
    getHexDistance,
    generateTerrain,
    getAvailablePlacementHexes,
    ensureUnitHexesPassable,
    resetFog,
    clearEffects,
    updateDetection,
    updateFog,
    hexToWorld,
    updateSummary,
    turnLabel:
      elements.turnLabel,
  });

mapInputController =
  createMapInputController({
    state,
    canvas:
      elements.canvas,
    mapRenderer,
    terrainTypes:
      TERRAIN_TYPES,
    movementCommands:
      MOVEMENT_COMMANDS,
    unitActions:
      UNIT_ACTIONS,
    ammunitionTypes:
      AMMUNITION_TYPES,
    hexRadius:
      HEX_RADIUS,
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
  });

turnController =
  createTurnController({
    state,
    mapRenderer,
    hexRadius:
      HEX_RADIUS,
    ammunitionTypes:
      AMMUNITION_TYPES,
    unitActions:
      UNIT_ACTIONS,
    hunterKillerStates:
      HUNTER_KILLER_STATES,
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

    refreshCommandPanel(category) {
      commandPanel.refresh(
        category,
      );
    },

    refreshFirePanel() {
      firePanel.render();
    },

    startEffectLoop,
  });

function showScreen(name) {
  const menu =
    name === "menu";

  state.activeScreen =
    name;

  elements.menuScreen.hidden =
    !menu;

  elements.battleScreen.hidden =
    menu;

  if (!menu) {
    requestAnimationFrame(() => {
      mapRenderer.resize();
      scenarioController.centerCamera();
      render();
    });
  }
}

function handleAction(action) {
  if (
    action === "open-battle"
  ) {
    showScreen("battle");
    return;
  }

  if (
    action === "return-menu"
  ) {
    showScreen("menu");
    return;
  }

  if (
    action === "restart-scenario"
  ) {
    scenarioController
      .restartScenario();

    scenarioController
      .centerCamera();

    render();

    setMessage(
      "시나리오를 다시 시작했습니다.",
    );

    return;
  }

  if (
    action === "open-settings"
  ) {
    elements.settingsDialog
      ?.showModal();

    return;
  }

  if (
    action === "open-project-info"
  ) {
    elements.projectInfoDialog
      ?.showModal();

    return;
  }

  if (
    action === "center-camera"
  ) {
    scenarioController
      .centerCamera();

    render();

    return;
  }

  if (
    action === "zoom-in" ||
    action === "zoom-out"
  ) {
    state.camera.zoom = Math.min(
      1.8,
      Math.max(
        0.55,
        state.camera.zoom +
          (
            action === "zoom-in"
              ? 0.15
              : -0.15
          ),
      ),
    );

    scenarioController
      .centerCamera();

    render();

    return;
  }

  if (
    action === "execute-turn"
  ) {
    turnController.executeTurn();
  }
}

bindApplicationEvents({
  canvas:
    elements.canvas,

  difficultySelect:
    elements.difficultySelect,

  developerModeToggle:
    elements.developerModeToggle,

  getActiveScreen:
    () => state.activeScreen,

  getCamera:
    () => state.camera,

  onAction:
    handleAction,

  onCommandCategory(category) {
    commandController
      .selectCategory(category);
  },

  onDifficultyChange(difficulty) {
    state.difficulty =
      difficulty;
  },

  onDeveloperModeChange(enabled) {
    state.developerMode =
      enabled;

    mapRenderer
      .invalidateTerrain();

    mapRenderer
      .invalidateFog();

    render();
  },

  onMapTap(
    clientX,
    clientY,
  ) {
    mapInputController.handleMapTap(
      clientX,
      clientY,
    );
  },

  onCameraMove() {
    render();
  },

  onResize() {
    mapRenderer.resize();

    scenarioController
      .centerCamera();

    render();
  },
});

scenarioController.startScenario();
showScreen("menu");
