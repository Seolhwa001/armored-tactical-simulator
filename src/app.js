// src/app.js — 전체 교체

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
  UNIT_ACTIONS,
  applyReconByFire,
  processPersistentActions,
  setPersistentAction,
} from "./engine/actions.js";

import {
  AMMUNITION_TYPES,
  FIRE_STATES,
} from "./engine/fireControl.js";

import {
  canTurretFire,
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
  createCommandPanel,
} from "./ui/commandPanel.js";

import {
  createFirePanel,
} from "./ui/firePanel.js";

import {
  bindApplicationEvents,
} from "./ui/eventBindings.js";

const HEX_RADIUS = 28;
const MAP_COLUMNS = 18;
const MAP_ROWS = 18;

const TERRAIN_TYPES = {
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
};

const MOVEMENT_COMMANDS = new Set([
  "normal-move",
  "fire-maneuver",
  "evasive-maneuver",
  "retreat",
  "change-position",
]);

const TARGET_COMMANDS = new Set([
  ...MOVEMENT_COMMANDS,
  "observation",
  "recon-by-fire",
  "fire-target",
]);

const elements = {
  menuScreen:
    document.querySelector(
      "#menu-screen",
    ),

  battleScreen:
    document.querySelector(
      "#battle-screen",
    ),

  turnLabel:
    document.querySelector(
      "#turn-label",
    ),

  selectedUnitLabel:
    document.querySelector(
      "#selected-unit-label",
    ),

  currentCommandLabel:
    document.querySelector(
      "#current-command-label",
    ),

  unitConditionLabel:
    document.querySelector(
      "#unit-condition-label",
    ),

  commandOptions:
    document.querySelector(
      "#command-options",
    ),

  settingsDialog:
    document.querySelector(
      "#settings-dialog",
    ),

  projectInfoDialog:
    document.querySelector(
      "#project-info-dialog",
    ),

  difficultySelect:
    document.querySelector(
      "#difficulty-select",
    ),

  developerModeToggle:
    document.querySelector(
      "#developer-mode-toggle",
    ),

  canvas:
    document.querySelector(
      "#battle-map",
    ),

  mapMessage:
    document.querySelector(
      "#map-message",
    ),
};

if (
  !elements.canvas ||
  !elements.commandOptions
) {
  throw new Error(
    "ATS 필수 UI 요소를 찾을 수 없습니다.",
  );
}

const state = {
  runtimeScenario: null,
  terrain: new Map(),

  turn: 1,
  activeScreen: "menu",
  activeCategory: null,

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

const mapRenderer =
  createMapRenderer({
    canvas: elements.canvas,
    terrainTypes:
      TERRAIN_TYPES,
    hexRadius: HEX_RADIUS,
  });

let commandPanel;
let firePanel;

function getUnits() {
  return (
    state.runtimeScenario
      ?.units ??
    []
  );
}

function getSelectedUnit() {
  return getUnits().find(
    (unit) =>
      unit.id ===
      state.selectedUnitId,
  );
}

function isUnitMoving(unit) {
  return (
    Boolean(unit.destination) &&
    Array.isArray(
      unit.plannedPath,
    ) &&
    unit.plannedPath.length > 0
  );
}

function setMessage(message) {
  elements.mapMessage.textContent =
    message;
}

function getTurretSummary(unit) {
  const status =
    getTurretStatus(unit);

  if (!status) {
    return unit.condition;
  }

  const modes = {
    normal: "정상구동",
    emergency: "비상구동",
    manual: "수동구동",
  };

  const stabilizer =
    status.stabilizerAvailable
      ? "안정화 정상"
      : status
          .stabilizerOperational
        ? "안정화 미사용"
        : "안정화 고장";

  const position =
    status.lockedToHull
      ? status.aligned
        ? "주포 정위치"
        : "정위치 중"
      : status.aligned
        ? "포탑 정렬"
        : "포탑 회전 중";

  return (
    `${modes[status.mode]} / ` +
    `${stabilizer} / ` +
    position
  );
}

function updateSummary() {
  const unit =
    getSelectedUnit();

  elements.selectedUnitLabel.textContent =
    unit?.name ??
    "없음";

  elements.currentCommandLabel.textContent =
    unit?.command ??
    "대기";

  elements.unitConditionLabel.textContent =
    unit
      ? getTurretSummary(unit)
      : "-";
}

function getNeighbors(
  column,
  row,
) {
  const offsets =
    row % 2 === 0
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
        column +
        columnOffset,

      row:
        row +
        rowOffset,
    }),
  );
}

function getMovementCost(
  column,
  row,
) {
  const terrain =
    state.terrain.get(
      `${column},${row}`,
    );

  return terrain
    ? TERRAIN_TYPES[
        terrain.type
      ].movementCost
    : Infinity;
}

function randomizeUnitPositions() {
  const available =
    getAvailablePlacementHexes(
      state.terrain,
      TERRAIN_TYPES,
    );

  const occupied =
    new Set();

  const friendlies =
    getUnits().filter(
      (unit) =>
        unit.side ===
        "friendly",
    );

  const enemies =
    getUnits().filter(
      (unit) =>
        unit.side ===
        "enemy",
    );

  function chooseHex(
    validator = () => true,
  ) {
    const candidates =
      available.filter(
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

  friendlies.forEach((unit) => {
    Object.assign(
      unit,
      chooseHex(),
    );
  });

  enemies.forEach((unit) => {
    Object.assign(
      unit,
      chooseHex(
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
      DETECTION_STAGES.HIDDEN;

    unit.visible = false;
    unit.detected = false;
    unit.identified = false;
    unit.lastKnownPosition =
      null;
  });
}

function initializeScenario(
  restart = false,
) {
  state.terrain =
    generateTerrain({
      columns: MAP_COLUMNS,
      rows: MAP_ROWS,
    });

  state.runtimeScenario =
    restart &&
    state.runtimeScenario
      ? restartScenario(
          state.runtimeScenario,
        )
      : loadScenario();

  randomizeUnitPositions();

  ensureUnitHexesPassable(
    state.terrain,
    getUnits(),
  );

  state.turn = 1;
  state.runtimeScenario.turn = 1;

  state.selectedUnitId =
    getPlayerUnit(
      state.runtimeScenario,
    )?.id ??
    null;

  state.selectedCommand =
    null;

  state.selectedHex =
    null;

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

  elements.turnLabel.textContent =
    "TURN 1";

  updateSummary();
}

function centerCamera() {
  const unit =
    getSelectedUnit() ??
    getPlayerUnit(
      state.runtimeScenario,
    );

  if (!unit) {
    return;
  }

  const viewport =
    mapRenderer.getViewportSize();

  const point =
    hexToWorld(
      unit.column,
      unit.row,
      HEX_RADIUS,
    );

  state.camera.x =
    viewport.width / 2 -
    point.x *
      state.camera.zoom;

  state.camera.y =
    viewport.height / 2 -
    point.y *
      state.camera.zoom;
}

function drawTargetPreview({
  context,
  hexToWorld:
    convertHex,
}) {
  if (
    !state.selectedHex ||
    !TARGET_COMMANDS.has(
      state.selectedCommand?.id,
    )
  ) {
    return;
  }

  const point =
    convertHex(
      state.selectedHex.column,
      state.selectedHex.row,
    );

  context.save();

  context.strokeStyle =
    "#ffd078";

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

    drawDynamicLayer:
      (renderer) => {
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
  const changed =
    updateFog(
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

function calculateDirection(
  from,
  to,
) {
  const start =
    hexToWorld(
      from.column,
      from.row,
      HEX_RADIUS,
    );

  const end =
    hexToWorld(
      to.column,
      to.row,
      HEX_RADIUS,
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
  const result =
    planUnitMovement({
      unit,
      destination: hex,
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
        UNIT_ACTIONS.MOVE,

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
  hex,
) {
  setPersistentAction(
    unit,
    {
      type:
        UNIT_ACTIONS.OBSERVE,

      targetHex: hex,

      direction:
        calculateDirection(
          unit,
          hex,
        ),

      label: "감시",
    },
    state.turn,
  );

  setMessage(
    `감시 방향 지정: ${hex.column}, ${hex.row}`,
  );
}

function startEffectLoop() {
  startEffectAnimation(
    state.effects,
    render,
  );
}

function handleReconByFireTarget(
  unit,
  hex,
) {
  const hiddenBefore =
    new Set(
      getUnits()
        .filter(
          (enemy) =>
            enemy.side ===
              "enemy" &&
            !enemy.visible,
        )
        .map(
          (enemy) =>
            enemy.id,
        ),
    );

  const affected =
    applyReconByFire(
      state.runtimeScenario,
      unit,
      hex,
      state.turn,
    );

  addFireEffect(
    state.effects,
    unit,
    hex,
    AMMUNITION_TYPES.HEAT,
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
      hiddenBefore.has(
        enemy.id,
      ) &&
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
    column: hex.column,
    row: hex.row,
  };

  if (
    !unit ||
    unit.side !== "friendly"
  ) {
    render();
    return;
  }

  const command =
    state.selectedCommand;

  if (
    MOVEMENT_COMMANDS.has(
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
    "observation"
  ) {
    handleObservationTarget(
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
    const enemy =
      getUnits().find(
        (candidate) =>
          candidate.side ===
            "enemy" &&
          candidate.column ===
            state.selectedHex
              .column &&
          candidate.row ===
            state.selectedHex
              .row &&
          isUnitVisible(
            candidate,
            state.developerMode,
          ),
      );

    firePanel.setTarget(
      state.selectedHex,
      enemy?.id ??
        null,
    );

    setMessage(
      `사격 목표 지정: ${state.selectedHex.column}, ${state.selectedHex.row}`,
    );
  } else {
    const terrain =
      state.terrain.get(
        `${state.selectedHex.column},${state.selectedHex.row}`,
      );

    if (!terrain) {
      render();
      return;
    }

    const type =
      TERRAIN_TYPES[
        terrain.type
      ];

    setMessage(
      `${type.name} | 고도 ${terrain.elevation}m | 은폐 ${type.concealment}% | 엄폐 ${type.cover}%`,
    );
  }

  state.selectedCommand =
    null;

  refreshFogAndRender();

  if (
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
  let nearest = null;
  let distance = Infinity;

  state.terrain.forEach((hex) => {
    const point =
      hexToWorld(
        hex.column,
        hex.row,
        HEX_RADIUS,
      );

    const current =
      Math.hypot(
        worldX - point.x,
        worldY - point.y,
      );

    if (current < distance) {
      distance = current;
      nearest = hex;
    }
  });

  return distance <=
    HEX_RADIUS
    ? nearest
    : null;
}

function handleMapTap(
  clientX,
  clientY,
) {
  const rectangle =
    elements.canvas
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
    getUnits().find(
      (unit) => {
        if (
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
            HEX_RADIUS,
          );

        return (
          Math.hypot(
            world.x - point.x,
            world.y - point.y,
          ) <= 30
        );
      },
    );

  if (
    state.selectedCommand
      ?.needsTarget
  ) {
    const targetHex =
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

    if (targetHex) {
      handleHexSelection(
        targetHex,
      );
    }

    return;
  }

  if (tappedUnit) {
    state.selectedUnitId =
      tappedUnit.id;

    state.selectedCommand =
      null;

    firePanel.reset();

    updateSummary();
    render();

    return;
  }

  const hex =
    worldToHex(
      world.x,
      world.y,
    );

  if (hex) {
    handleHexSelection(hex);
  }
}

function executeTurn() {
  const hiddenBefore =
    new Set(
      getUnits()
        .filter(
          (enemy) =>
            enemy.side ===
              "enemy" &&
            !enemy.visible,
        )
        .map(
          (enemy) =>
            enemy.id,
        ),
    );

  const movingUnitIds =
    new Set();

  getUnits()
    .filter(
      (unit) =>
        unit.side ===
        "friendly",
    )
    .forEach((unit) => {
      const result =
        advanceUnitMovement({
          unit,
          turn: state.turn,

          hexToWorld:
            (column, row) =>
              hexToWorld(
                column,
                row,
                HEX_RADIUS,
              ),
        });

      if (result.moved) {
        movingUnitIds.add(
          unit.id,
        );
      }
    });

  processPersistentActions(
    state.runtimeScenario,
    state.turn,
    {
      movingUnitIds,
      canFire:
        canTurretFire,
    },
  );

  getUnits()
    .filter(
      (unit) =>
        unit.side ===
        "friendly",
    )
    .forEach((unit) => {
      if (
        unit.action?.type ===
          UNIT_ACTIONS.RECON_BY_FIRE &&
        unit.action.targetHex
      ) {
        addFireEffect(
          state.effects,
          unit,
          unit.action.targetHex,
          AMMUNITION_TYPES.HEAT,
          {
            reconByFire: true,
          },
        );
      }

      if (
        unit.fireControl?.state ===
          FIRE_STATES.ADJUST &&
        unit.fireControl.targetHex &&
        canTurretFire(
          unit,
          {
            moving:
              movingUnitIds.has(
                unit.id,
              ),
          },
        ).allowed
      ) {
        addFireEffect(
          state.effects,
          unit,
          unit.fireControl.targetHex,
          unit.fireControl.ammunition,
        );
      }
    });

  state.turn += 1;
  state.runtimeScenario.turn =
    state.turn;

  updateDetection(
    state.runtimeScenario,
    state.turn,
  );

  getUnits()
    .filter(
      (enemy) =>
        enemy.side ===
          "enemy" &&
        enemy.visible &&
        hiddenBefore.has(
          enemy.id,
        ),
    )
    .forEach((enemy) =>
      addContactEffect(
        state.effects,
        enemy,
      ),
    );

  const fogChanged =
    updateFog(
      state.fog,
      state.terrain,
      getUnits(),
    );

  if (fogChanged) {
    mapRenderer.invalidateFog();
  }

  elements.turnLabel.textContent =
    `TURN ${state.turn}`;

  state.selectedCommand =
    null;

  updateSummary();

  if (
    state.activeCategory ===
    "combat"
  ) {
    firePanel.render();
  } else if (
    state.activeCategory
  ) {
    commandPanel.refresh(
      state.activeCategory,
    );
  }

  setMessage(
    `TURN ${state.turn - 1} 처리 완료`,
  );

  startEffectLoop();
}

function handleCommandSelection(
  command,
  selectedButton,
) {
  const unit =
    getSelectedUnit();

  if (
    !unit ||
    unit.side !== "friendly"
  ) {
    return;
  }

  if (
    command.id === "recon"
  ) {
    commandPanel.activateRecon();
    refreshFogAndRender();
    return;
  }

  state.selectedCommand =
    command;

  elements.commandOptions
    .querySelectorAll(
      ".command-option",
    )
    .forEach((button) => {
      button.classList.toggle(
        "is-selected",
        button ===
          selectedButton,
      );
    });

  if (command.needsTarget) {
    setMessage(
      `${command.label}: 지도에서 목표 헥스를 선택하세요.`,
    );
  } else {
    unit.command =
      command.label;

    updateSummary();
    render();
  }
}

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
      centerCamera();
      render();
    });
  }
}

function handleAction(action) {
  if (
    action === "open-battle"
  ) {
    showScreen("battle");
  } else if (
    action === "return-menu"
  ) {
    showScreen("menu");
  } else if (
    action ===
    "restart-scenario"
  ) {
    initializeScenario(true);
    centerCamera();
    render();

    setMessage(
      "시나리오를 다시 시작했습니다.",
    );
  } else if (
    action ===
    "open-settings"
  ) {
    elements.settingsDialog
      .showModal();
  } else if (
    action ===
    "open-project-info"
  ) {
    elements.projectInfoDialog
      .showModal();
  } else if (
    action ===
    "center-camera"
  ) {
    centerCamera();
    render();
  } else if (
    action === "zoom-in" ||
    action === "zoom-out"
  ) {
    state.camera.zoom =
      Math.min(
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

    centerCamera();
    render();
  } else if (
    action ===
    "execute-turn"
  ) {
    executeTurn();
  }
}

commandPanel =
  createCommandPanel({
    container:
      elements.commandOptions,

    getSelectedUnit,

    getTurn:
      () => state.turn,

    onCommandSelected:
      handleCommandSelection,

    onStateChanged:
      refreshFogAndRender,

    onMessage:
      setMessage,

    onCancelMovement:
      cancelUnitMovement,
  });

firePanel =
  createFirePanel({
    container:
      elements.commandOptions,

    getSelectedUnit,

    getTurn:
      () => state.turn,

    isUnitMoving,

    onBeginTargetSelection:
      () => {
        state.selectedCommand = {
          id: "fire-target",
          label: "사격명령",
          needsTarget: true,
        };
      },

    onFireEffect:
      (
        unit,
        target,
        ammunition,
      ) => {
        addFireEffect(
          state.effects,
          unit,
          target,
          ammunition,
        );

        startEffectLoop();
      },

    onRemoveFireEffects:
      (unitId) => {
        removeUnitFireEffects(
          state.effects,
          unitId,
        );
      },

    onStateChanged:
      () => {
        updateSummary();
        render();
      },

    onMessage:
      setMessage,
  });

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

  onCommandCategory:
    (category) => {
      state.activeCategory =
        category;

      state.selectedCommand =
        null;

      document
        .querySelectorAll(
          ".command-category",
        )
        .forEach((button) => {
          button.classList.toggle(
            "is-active",
            button.dataset
              .commandCategory ===
              category,
          );
        });

      if (
        category === "combat"
      ) {
        firePanel.render();
      } else {
        commandPanel.render(
          category,
        );
      }
    },

  onDifficultyChange:
    (difficulty) => {
      state.difficulty =
        difficulty;
    },

  onDeveloperModeChange:
    (enabled) => {
      state.developerMode =
        enabled;

      mapRenderer
        .invalidateTerrain();

      mapRenderer.invalidateFog();
      render();
    },

  onMapTap:
    handleMapTap,

  onCameraMove:
    () => {
      render();
    },

  onResize:
    () => {
      mapRenderer.resize();
      centerCamera();
      render();
    },
});

initializeScenario();
showScreen("menu");
