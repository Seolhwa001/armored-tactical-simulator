import {
  planUnitMovement,
  cancelUnitMovement,
  advanceUnitMovement,
} from "./engine/movement.js";

import {
  AMMUNITION_TYPES,
  DETECTION_STAGES,
  FIRE_STATES,
  UNIT_ACTIONS,
  applyReconByFire,
  ceaseFire,
  enableAdjustedFire,
  fireSingleShot,
  getPlayerUnit,
  isUnitVisible,
  loadScenario,
  processPersistentActions,
  randomizeScenarioPositions,
  restartScenario,
  setFireTarget,
  setPersistentAction,
  updateDetection,
} from "./engine/scenarioRuntime.js";

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

const OBSERVATION_COMMANDS = [
  {
    id: "observation",
    label: "감시",
    needsTarget: true,
  },
  {
    id: "recon",
    label: "정찰",
    needsTarget: false,
  },
  {
    id: "recon-by-fire",
    label: "화력수색",
    needsTarget: true,
  },
];

const MOVEMENT_COMMANDS = [
  {
    id: "normal-move",
    label: "일반이동",
    needsTarget: true,
  },
  {
    id: "fire-maneuver",
    label: "사격기동",
    needsTarget: true,
  },
  {
    id: "evasive-maneuver",
    label: "회피기동",
    needsTarget: true,
  },
  {
    id: "retreat",
    label: "퇴각",
    needsTarget: true,
  },
];

const SURVIVAL_COMMANDS = [
  {
    id: "concealment",
    label: "은폐·엄폐",
    needsTarget: false,
  },
  {
    id: "vehicle-smoke",
    label: "자체연막",
    needsTarget: false,
  },
  {
    id: "change-position",
    label: "위치변경",
    needsTarget: true,
  },
  {
    id: "cancel-movement",
    label: "이동취소",
    needsTarget: false,
  },
];

const AMMUNITION_LABELS = {
  [AMMUNITION_TYPES.APFSDS]: "날탄",
  [AMMUNITION_TYPES.HEAT]: "대탄",
  [AMMUNITION_TYPES.CANISTER]: "벌집탄",
  [AMMUNITION_TYPES.SMOKE]: "연막탄",
};

const MOVEMENT_COMMAND_IDS = new Set([
  "normal-move",
  "fire-maneuver",
  "evasive-maneuver",
  "retreat",
  "change-position",
]);

const state = {
  runtimeScenario: null,
  units: [],
  terrain: new Map(),

  turn: 1,
  activeScreen: "menu",
  activeCategory: null,
  selectedCommand: null,
  selectedUnitId: null,
  selectedHex: null,

  difficulty: "standard",
  developerMode: false,

  fireProcedure: {
    active: false,
    ammunition: AMMUNITION_TYPES.APFSDS,
    targetHex: null,
    targetUnitId: null,
  },

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

if (!elements.canvas) {
  throw new Error(
    "battle-map Canvas를 찾을 수 없습니다.",
  );
}

const context =
  elements.canvas.getContext("2d");

if (!context) {
  throw new Error(
    "Canvas 2D Context를 생성할 수 없습니다.",
  );
}

function terrainKey(column, row) {
  return `${column},${row}`;
}

function seededValue(
  column,
  row,
  seed,
) {
  const value =
    Math.sin(
      column * 12.9898 +
        row * 78.233 +
        seed * 31.719,
    ) * 43758.5453;

  return value - Math.floor(value);
}

function createTerrain() {
  const seed =
    Math.floor(
      Math.random() * 100000,
    );

  state.terrain.clear();

  for (
    let row = -MAP_ROWS;
    row <= MAP_ROWS;
    row += 1
  ) {
    for (
      let column = -MAP_COLUMNS;
      column <= MAP_COLUMNS;
      column += 1
    ) {
      const random =
        seededValue(
          column,
          row,
          seed,
        );

      let type = "open";

      if (
        Math.abs(row) <= 1 &&
        column % 4 !== 0
      ) {
        type = "road";
      } else if (
        column === 7 &&
        row > -9 &&
        row < 10
      ) {
        type = "water";
      } else if (random < 0.18) {
        type = "forest";
      } else if (random < 0.31) {
        type = "ridge";
      } else if (random < 0.55) {
        type = "grass";
      }

      state.terrain.set(
        terrainKey(column, row),
        {
          column,
          row,
          type,

          elevation: Math.round(
            10 +
              seededValue(
                column + 17,
                row - 9,
                seed,
              ) *
                35,
          ),
        },
      );
    }
  }
}

function getAvailablePlacementHexes() {
  return Array.from(
    state.terrain.values(),
  )
    .filter((terrain) => {
      const terrainType =
        TERRAIN_TYPES[
          terrain.type
        ];

      return Number.isFinite(
        terrainType.movementCost,
      );
    })
    .map((terrain) => ({
      column: terrain.column,
      row: terrain.row,
      passable: true,
    }));
}

function ensureUnitHexesPassable() {
  state.units.forEach((unit) => {
    const terrain =
      state.terrain.get(
        terrainKey(
          unit.column,
          unit.row,
        ),
      );

    if (terrain) {
      terrain.type = "open";
    }
  });
}

function initializeScenario() {
  createTerrain();

  state.runtimeScenario =
    loadScenario();

  randomizeScenarioPositions(
    state.runtimeScenario,
    getAvailablePlacementHexes(),
    {
      minimumFriendlyEnemyDistance: 8,
    },
  );

  state.units =
    state.runtimeScenario.units;

  state.turn = 1;
  state.runtimeScenario.turn = 1;

  const player =
    getPlayerUnit(
      state.runtimeScenario,
    );

  state.selectedUnitId =
    player?.id ?? null;

  state.selectedHex = null;
  state.selectedCommand = null;
  state.activeCategory = null;

  resetFireProcedure();

  ensureUnitHexesPassable();

  updateDetection(
    state.runtimeScenario,
    state.turn,
  );

  elements.turnLabel.textContent =
    "TURN 1";

  updateSelectedUnitSummary();
}

function restartCurrentScenario() {
  createTerrain();

  state.runtimeScenario =
    restartScenario(
      state.runtimeScenario,
      {
        availableHexes:
          getAvailablePlacementHexes(),

        minimumFriendlyEnemyDistance: 8,
      },
    );

  state.units =
    state.runtimeScenario.units;

  state.turn = 1;
  state.runtimeScenario.turn = 1;

  const player =
    getPlayerUnit(
      state.runtimeScenario,
    );

  state.selectedUnitId =
    player?.id ?? null;

  state.selectedHex = null;
  state.selectedCommand = null;
  state.activeCategory = null;

  resetFireProcedure();

  ensureUnitHexesPassable();

  updateDetection(
    state.runtimeScenario,
    state.turn,
  );

  elements.turnLabel.textContent =
    "TURN 1";

  elements.commandOptions.replaceChildren();

  const message =
    document.createElement("p");

  message.textContent =
    "명령 종류를 선택하세요.";

  elements.commandOptions.append(
    message,
  );

  updateSelectedUnitSummary();
  centerCamera();
  renderMap();

  setMapMessage(
    "시나리오를 다시 시작했습니다.",
  );
}

function getSelectedUnit() {
  return state.units.find(
    (unit) =>
      unit.id ===
      state.selectedUnitId,
  );
}

function updateSelectedUnitSummary() {
  const unit = getSelectedUnit();

  if (!unit) {
    elements.selectedUnitLabel.textContent =
      "없음";

    elements.currentCommandLabel.textContent =
      "대기";

    elements.unitConditionLabel.textContent =
      "-";

    return;
  }

  elements.selectedUnitLabel.textContent =
    unit.name;

  elements.currentCommandLabel.textContent =
    unit.command;

  elements.unitConditionLabel.textContent =
    unit.condition;
}

function setMapMessage(message) {
  elements.mapMessage.textContent =
    message;
}

function showScreen(screenName) {
  const showMenu =
    screenName === "menu";

  state.activeScreen = screenName;

  elements.menuScreen.hidden =
    !showMenu;

  elements.battleScreen.hidden =
    showMenu;

  if (!showMenu) {
    requestAnimationFrame(() => {
      resizeCanvas();
      centerCamera();
      updateSelectedUnitSummary();
      renderMap();
    });
  }
}

function setInterfaceText() {
  const labels = {
    observation: "감시 및 정찰",
    movement: "기동",
    combat: "사격",
    survival: "생존성 보장",
  };

  document
    .querySelectorAll(
      "[data-command-category]",
    )
    .forEach((button) => {
      const category =
        button.dataset
          .commandCategory;

      button.textContent =
        labels[category] ??
        category;
    });
}

function renderCommandOptions(category) {
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

  if (category === "combat") {
    renderFireProcedure();
    return;
  }

  const commands = {
    observation:
      OBSERVATION_COMMANDS,

    movement:
      MOVEMENT_COMMANDS,

    survival:
      SURVIVAL_COMMANDS,
  }[category] ?? [];

  elements.commandOptions.replaceChildren();

  commands.forEach((command) => {
    const button =
      document.createElement(
        "button",
      );

    button.type = "button";
    button.className =
      "command-option";

    button.textContent =
      command.label;

    button.addEventListener(
      "click",
      () => {
        selectCommand(
          command,
          button,
        );
      },
    );

    elements.commandOptions.append(
      button,
    );
  });
}

function resetFireProcedure() {
  state.fireProcedure = {
    active: false,
    ammunition:
      AMMUNITION_TYPES.APFSDS,
    targetHex: null,
    targetUnitId: null,
  };
}

function renderFireProcedure() {
  elements.commandOptions.replaceChildren();

  const unit =
    getSelectedUnit();

  if (
    !unit ||
    unit.side !== "friendly" ||
    !unit.fireControl
  ) {
    const message =
      document.createElement("p");

    message.textContent =
      "선택 객체는 사격 절차를 사용할 수 없습니다.";

    elements.commandOptions.append(
      message,
    );

    return;
  }

  const container =
    document.createElement("div");

  container.className =
    "fire-procedure";

  const commandButton =
    createProcedureButton(
      "1. 사격명령",
      state.fireProcedure.active,
      () => {
        state.fireProcedure.active =
          true;

        state.selectedCommand = {
          id: "fire-target",
          label: "사격명령",
          needsTarget: true,
        };

        unit.command =
          "사격명령";

        updateSelectedUnitSummary();

        setMapMessage(
          "탄종을 선택한 후 목표 헥스를 지정하세요.",
        );

        renderFireProcedure();
      },
    );

  container.append(
    commandButton,
  );

  const ammunitionGroup =
    document.createElement("div");

  ammunitionGroup.className =
    "fire-ammunition-group";

  Object.entries(
    AMMUNITION_LABELS,
  ).forEach(
    ([ammunition, label]) => {
      const button =
        createProcedureButton(
          label,
          state.fireProcedure
            .ammunition ===
            ammunition,
          () => {
            state.fireProcedure.ammunition =
              ammunition;

            renderFireProcedure();
          },
        );

      button.disabled =
        !state.fireProcedure.active;

      ammunitionGroup.append(
        button,
      );
    },
  );

  container.append(
    ammunitionGroup,
  );

  const targetText =
    document.createElement("div");

  targetText.className =
    "fire-target-status";

  targetText.textContent =
    state.fireProcedure.targetHex
      ? `목표: ${state.fireProcedure.targetHex.column}, ${state.fireProcedure.targetHex.row}`
      : "목표: 미지정";

  container.append(
    targetText,
  );

  const fireButton =
    createProcedureButton(
      "쏴",
      false,
      () => {
        const fired =
          fireSingleShot(
            unit,
            state.turn,
          );

        if (!fired) {
          setMapMessage(
            "사격 목표가 지정되지 않았습니다.",
          );

          return;
        }

        setMapMessage(
          `${AMMUNITION_LABELS[unit.fireControl.ammunition]} 1발 발사`,
        );

        updateSelectedUnitSummary();
        renderFireProcedure();
        renderMap();
      },
    );

  fireButton.disabled =
    !unit.fireControl.targetHex;

  container.append(
    fireButton,
  );

  const adjustButton =
    createProcedureButton(
      "쏴-수정",
      unit.fireControl.state ===
        FIRE_STATES.ADJUST,
      () => {
        const enabled =
          enableAdjustedFire(
            unit,
            state.turn,
          );

        if (!enabled) {
          setMapMessage(
            "사격 목표가 지정되지 않았습니다.",
          );

          return;
        }

        setMapMessage(
          "포수 자율사격을 시작했습니다.",
        );

        updateSelectedUnitSummary();
        renderFireProcedure();
        renderMap();
      },
    );

  adjustButton.disabled =
    !unit.fireControl.targetHex;

  container.append(
    adjustButton,
  );

  const ceaseButton =
    createProcedureButton(
      "사격그만",
      unit.fireControl.state ===
        FIRE_STATES.STOPPED,
      () => {
        ceaseFire(unit);

        resetFireProcedure();

        setMapMessage(
          "모든 사격과 장전을 중지했습니다.",
        );

        updateSelectedUnitSummary();
        renderFireProcedure();
        renderMap();
      },
    );

  container.append(
    ceaseButton,
  );

  elements.commandOptions.append(
    container,
  );
}

function createProcedureButton(
  label,
  active,
  handler,
) {
  const button =
    document.createElement("button");

  button.type = "button";

  button.className =
    "command-option";

  button.classList.toggle(
    "is-selected",
    active,
  );

  button.textContent = label;

  button.addEventListener(
    "click",
    handler,
  );

  return button;
}

function selectCommand(
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

  state.selectedCommand =
    command;

  document
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

  if (
    command.id ===
    "cancel-movement"
  ) {
    cancelUnitMovement(unit);

    state.selectedCommand =
      null;

    updateSelectedUnitSummary();

    setMapMessage(
      `${unit.name}의 이동 명령을 취소했습니다.`,
    );

    renderMap();
    return;
  }

  if (
    command.id === "recon"
  ) {
    setPersistentAction(
      unit,
      {
        type:
          UNIT_ACTIONS.RECON,

        label: "정찰",
      },
      state.turn,
    );

    updateSelectedUnitSummary();

    setMapMessage(
      "주변 360도 정찰을 시작했습니다.",
    );

    renderMap();
    return;
  }

  if (
    command.id ===
      "vehicle-smoke" ||
    command.id ===
      "concealment"
  ) {
    unit.command =
      command.label;

    updateSelectedUnitSummary();

    setMapMessage(
      `${command.label} 행동을 시작했습니다.`,
    );

    return;
  }

  if (command.needsTarget) {
    setMapMessage(
      `${command.label}: 지도에서 목표 헥스를 선택하세요.`,
    );

    return;
  }

  unit.command =
    command.label;

  updateSelectedUnitSummary();
}

function hexToWorld(
  column,
  row,
) {
  const horizontal =
    Math.sqrt(3) *
    HEX_RADIUS;

  return {
    x:
      column * horizontal +
      (
        row % 2 === 0
          ? 0
          : horizontal / 2
      ),

    y:
      row *
      HEX_RADIUS *
      1.5,
  };
}

function calculateDirection(
  from,
  to,
) {
  const start =
    hexToWorld(
      from.column,
      from.row,
    );

  const end =
    hexToWorld(
      to.column,
      to.row,
    );

  return Math.atan2(
    end.y - start.y,
    end.x - start.x,
  );
}

function worldToHex(
  worldX,
  worldY,
) {
  let nearest = null;

  let nearestDistance =
    Infinity;

  for (
    let row = -MAP_ROWS;
    row <= MAP_ROWS;
    row += 1
  ) {
    for (
      let column = -MAP_COLUMNS;
      column <= MAP_COLUMNS;
      column += 1
    ) {
      const point =
        hexToWorld(
          column,
          row,
        );

      const distance =
        Math.hypot(
          worldX - point.x,
          worldY - point.y,
        );

      if (
        distance <
        nearestDistance
      ) {
        nearestDistance =
          distance;

        nearest = {
          column,
          row,
        };
      }
    }
  }

  return nearestDistance <=
    HEX_RADIUS
    ? nearest
    : null;
}

function screenToWorld(
  screenX,
  screenY,
) {
  return {
    x:
      (
        screenX -
        state.camera.x
      ) /
      state.camera.zoom,

    y:
      (
        screenY -
        state.camera.y
      ) /
      state.camera.zoom,
  };
}

function selectUnit(unit) {
  if (
    unit.side === "enemy" &&
    !state.developerMode &&
    !unit.visible
  ) {
    return;
  }

  state.selectedUnitId =
    unit.id;

  state.selectedCommand =
    null;

  resetFireProcedure();

  updateSelectedUnitSummary();

  const detectionText =
    unit.side === "enemy"
      ? `, 탐지단계 ${unit.detectionStage}`
      : "";

  setMapMessage(
    `${unit.name} 선택 — ${unit.model}${detectionText}`,
  );

  if (
    state.activeCategory ===
    "combat"
  ) {
    renderFireProcedure();
  }

  renderMap();
}

function getMovementCost(
  column,
  row,
) {
  const terrain =
    state.terrain.get(
      terrainKey(
        column,
        row,
      ),
    );

  if (!terrain) {
    return Infinity;
  }

  return TERRAIN_TYPES[
    terrain.type
  ].movementCost;
}

function getHexNeighbors(
  column,
  row,
) {
  const directions =
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

  return directions.map(
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

function selectHex(hex) {
  const terrain =
    state.terrain.get(
      terrainKey(
        hex.column,
        hex.row,
      ),
    );

  if (!terrain) {
    return;
  }

  state.selectedHex = hex;

  const unit =
    getSelectedUnit();

  const command =
    state.selectedCommand;

  if (
    !unit ||
    unit.side !== "friendly"
  ) {
    renderMap();
    return;
  }

  if (
    command?.needsTarget &&
    MOVEMENT_COMMAND_IDS.has(
      command.id,
    )
  ) {
    const result =
      planUnitMovement({
        unit,

        destination: {
          column:
            hex.column,

          row:
            hex.row,
        },

        getNeighbors:
          getHexNeighbors,

        getMovementCost,
      });

    if (!result.success) {
      setMapMessage(
        result.reason ??
          "이동 가능한 경로가 없습니다.",
      );
    } else {
      unit.command =
        command.label;

      setPersistentAction(
        unit,
        {
          type:
            UNIT_ACTIONS.MOVE,

          targetHex: hex,

          label:
            command.label,
        },
        state.turn,
      );

      setMapMessage(
        `${command.label}: ${unit.plannedPath.length}개 헥스 이동로 설정`,
      );
    }

    updateSelectedUnitSummary();
    renderMap();
    return;
  }

  if (
    command?.id ===
    "observation"
  ) {
    const direction =
      calculateDirection(
        unit,
        hex,
      );

    setPersistentAction(
      unit,
      {
        type:
          UNIT_ACTIONS.OBSERVE,

        targetHex: hex,
        direction,
        label: "감시",
      },
      state.turn,
    );

    state.selectedCommand =
      null;

    updateSelectedUnitSummary();

    setMapMessage(
      `감시 방향 지정: ${hex.column}, ${hex.row}`,
    );

    renderMap();
    return;
  }

  if (
    command?.id ===
    "recon-by-fire"
  ) {
    applyReconByFire(
      state.runtimeScenario,
      unit,
      hex,
      state.turn,
    );

    state.selectedCommand =
      null;

    updateSelectedUnitSummary();

    setMapMessage(
      `화력수색 시작: ${hex.column}, ${hex.row}`,
    );

    updateDetection(
      state.runtimeScenario,
      state.turn,
    );

    renderMap();
    return;
  }

  if (
    command?.id ===
    "fire-target"
  ) {
    const targetUnit =
      state.units.find(
        (candidate) =>
          candidate.column ===
            hex.column &&
          candidate.row ===
            hex.row &&
          candidate.side ===
            "enemy" &&
          isUnitVisible(
            candidate,
            state.developerMode,
          ),
      );

    setFireTarget(
      unit,
      {
        column:
          hex.column,

        row:
          hex.row,

        unitId:
          targetUnit?.id ??
          null,
      },
      state.fireProcedure
        .ammunition,
    );

    state.fireProcedure.targetHex = {
      column:
        hex.column,

      row:
        hex.row,
    };

    state.fireProcedure.targetUnitId =
      targetUnit?.id ??
      null;

    state.selectedCommand =
      null;

    updateSelectedUnitSummary();

    setMapMessage(
      `사격 목표 지정: ${hex.column}, ${hex.row}`,
    );

    renderFireProcedure();
    renderMap();
    return;
  }

  if (command?.needsTarget) {
    unit.command =
      `${command.label} (${hex.column}, ${hex.row})`;

    state.selectedCommand =
      null;

    updateSelectedUnitSummary();

    setMapMessage(
      `${command.label} 목표를 지정했습니다.`,
    );

    renderMap();
    return;
  }

  const terrainType =
    TERRAIN_TYPES[
      terrain.type
    ];

  const movementCost =
    Number.isFinite(
      terrainType.movementCost,
    )
      ? terrainType
          .movementCost
      : "이동 불가";

  setMapMessage(
    `${terrainType.name} | ` +
      `고도 ${terrain.elevation}m | ` +
      `이동비용 ${movementCost} | ` +
      `은폐 ${terrainType.concealment}% | ` +
      `엄폐 ${terrainType.cover}%`,
  );

  renderMap();
}

function handleMapTap(
  clientX,
  clientY,
) {
  const rect =
    elements.canvas
      .getBoundingClientRect();

  const world =
    screenToWorld(
      clientX - rect.left,
      clientY - rect.top,
    );

  const unit =
    state.units.find(
      (candidate) => {
        if (
          !isUnitVisible(
            candidate,
            state.developerMode,
          )
        ) {
          return false;
        }

        const point =
          hexToWorld(
            candidate.column,
            candidate.row,
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
    unit &&
    state.selectedCommand?.id !==
      "fire-target"
  ) {
    selectUnit(unit);
    return;
  }

  const hex =
    worldToHex(
      world.x,
      world.y,
    );

  if (hex) {
    selectHex(hex);
  }
}

function executeTurn() {
  const selectedUnit =
    getSelectedUnit();

  const executedCommand =
    selectedUnit?.command ??
    "대기";

  state.units
    .filter(
      (unit) =>
        unit.side ===
        "friendly",
    )
    .forEach((unit) => {
      advanceUnitMovement({
        unit,
        turn: state.turn,
        hexToWorld,
      });
    });

  processPersistentActions(
    state.runtimeScenario,
    state.turn,
  );

  state.turn += 1;
  state.runtimeScenario.turn =
    state.turn;

  updateDetection(
    state.runtimeScenario,
    state.turn,
  );

  elements.turnLabel.textContent =
    `TURN ${state.turn}`;

  state.selectedCommand =
    null;

  document
    .querySelectorAll(
      ".command-option",
    )
    .forEach((button) => {
      button.classList.remove(
        "is-selected",
      );
    });

  updateSelectedUnitSummary();

  const contacts =
    state.units.filter(
      (unit) =>
        unit.side === "enemy" &&
        unit.visible,
    ).length;

  setMapMessage(
    `TURN ${state.turn - 1}: ${executedCommand} 처리 | 적 접촉 ${contacts}`,
  );

  if (
    state.activeCategory ===
    "combat"
  ) {
    renderFireProcedure();
  }

  renderMap();
}

function resizeCanvas() {
  const rect =
    elements.canvas
      .getBoundingClientRect();

  const ratio =
    Math.min(
      window.devicePixelRatio ||
        1,
      2,
    );

  elements.canvas.width =
    Math.max(
      1,
      Math.floor(
        rect.width * ratio,
      ),
    );

  elements.canvas.height =
    Math.max(
      1,
      Math.floor(
        rect.height * ratio,
      ),
    );

  context.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0,
  );
}

function centerCamera() {
  const rect =
    elements.canvas
      .getBoundingClientRect();

  const unit =
    getSelectedUnit() ??
    getPlayerUnit(
      state.runtimeScenario,
    );

  if (!unit) {
    return;
  }

  const point =
    hexToWorld(
      unit.column,
      unit.row,
    );

  state.camera.x =
    rect.width / 2 -
    point.x *
      state.camera.zoom;

  state.camera.y =
    rect.height / 2 -
    point.y *
      state.camera.zoom;
}

function changeZoom(amount) {
  state.camera.zoom =
    Math.min(
      1.8,
      Math.max(
        0.55,
        state.camera.zoom +
          amount,
      ),
    );

  centerCamera();

  setMapMessage(
    `지도 배율 ${Math.round(
      state.camera.zoom * 100,
    )}%`,
  );

  renderMap();
}

function drawHexagon(
  x,
  y,
  radius,
  fill,
  stroke,
  lineWidth = 1,
) {
  context.beginPath();

  for (
    let side = 0;
    side < 6;
    side += 1
  ) {
    const angle =
      (
        Math.PI / 3
      ) *
        side -
      Math.PI / 6;

    const pointX =
      x +
      Math.cos(angle) *
        radius;

    const pointY =
      y +
      Math.sin(angle) *
        radius;

    if (side === 0) {
      context.moveTo(
        pointX,
        pointY,
      );
    } else {
      context.lineTo(
        pointX,
        pointY,
      );
    }
  }

  context.closePath();

  context.fillStyle =
    fill;

  context.fill();

  context.strokeStyle =
    stroke;

  context.lineWidth =
    lineWidth;

  context.stroke();
}

function drawTerrainSymbol(
  terrainType,
  x,
  y,
  elevation,
) {
  context.fillStyle =
    "rgba(230, 239, 229, 0.58)";

  context.font =
    "600 12px system-ui";

  context.textAlign =
    "center";

  if (terrainType.symbol) {
    context.fillText(
      terrainType.symbol,
      x,
      y + 4,
    );
  }

  if (state.developerMode) {
    context.fillStyle =
      "#e4d49c";

    context.font =
      "9px monospace";

    context.fillText(
      `${elevation}m`,
      x,
      y + 18,
    );
  }
}

function drawSelection(point) {
  context.beginPath();

  context.arc(
    point.x,
    point.y,
    25,
    0,
    Math.PI * 2,
  );

  context.fillStyle =
    "rgba(198, 225, 181, 0.2)";

  context.fill();

  context.strokeStyle =
    "#c5dfb5";

  context.lineWidth = 2;
  context.stroke();
}

function drawTankIcon(
  unit,
  point,
) {
  context.save();

  context.translate(
    point.x,
    point.y,
  );

  context.rotate(
    unit.hullDirection ??
      0,
  );

  context.fillStyle =
    unit.side === "friendly"
      ? "#73957e"
      : "#a35f59";

  context.strokeStyle =
    "#edf4ef";

  context.lineWidth = 1.5;

  context.fillRect(
    -14,
    -8,
    28,
    16,
  );

  context.strokeRect(
    -14,
    -8,
    28,
    16,
  );

  context.beginPath();

  context.moveTo(
    -12,
    -11,
  );

  context.lineTo(
    12,
    -11,
  );

  context.moveTo(
    -12,
    11,
  );

  context.lineTo(
    12,
    11,
  );

  context.stroke();
  context.restore();

  context.save();

  context.translate(
    point.x,
    point.y,
  );

  context.rotate(
    unit.turretDirection ??
      unit.hullDirection ??
      0,
  );

  context.fillStyle =
    unit.side === "friendly"
      ? "#9ec2aa"
      : "#c98178";

  context.strokeStyle =
    "#edf4ef";

  context.beginPath();

  context.arc(
    0,
    0,
    6,
    0,
    Math.PI * 2,
  );

  context.fill();
  context.stroke();

  context.beginPath();

  context.moveTo(4, 0);
  context.lineTo(21, 0);
  context.stroke();

  context.restore();
}

function drawInfantryObserverIcon(
  point,
) {
  context.save();

  context.strokeStyle =
    "#ffd0c1";

  context.fillStyle =
    "#9c5b4c";

  context.lineWidth = 2;

  context.beginPath();

  context.arc(
    point.x,
    point.y - 9,
    5,
    0,
    Math.PI * 2,
  );

  context.fill();
  context.stroke();

  context.beginPath();

  context.moveTo(
    point.x,
    point.y - 4,
  );

  context.lineTo(
    point.x,
    point.y + 10,
  );

  context.moveTo(
    point.x - 8,
    point.y + 1,
  );

  context.lineTo(
    point.x + 8,
    point.y + 1,
  );

  context.moveTo(
    point.x,
    point.y + 10,
  );

  context.lineTo(
    point.x - 7,
    point.y + 18,
  );

  context.moveTo(
    point.x,
    point.y + 10,
  );

  context.lineTo(
    point.x + 7,
    point.y + 18,
  );

  context.stroke();

  context.beginPath();

  context.arc(
    point.x + 10,
    point.y - 2,
    4,
    0,
    Math.PI * 2,
  );

  context.stroke();

  context.restore();
}

function drawAtgmIcon(point) {
  context.fillStyle =
    "#9d514e";

  context.strokeStyle =
    "#ffd1c6";

  context.lineWidth = 2;

  context.beginPath();

  context.moveTo(
    point.x,
    point.y - 13,
  );

  context.lineTo(
    point.x + 13,
    point.y + 10,
  );

  context.lineTo(
    point.x - 13,
    point.y + 10,
  );

  context.closePath();

  context.fill();
  context.stroke();

  context.beginPath();

  context.moveTo(
    point.x - 8,
    point.y,
  );

  context.lineTo(
    point.x + 13,
    point.y,
  );

  context.stroke();
}

function drawContactIcon(point) {
  context.fillStyle =
    "#d8a85f";

  context.font =
    "900 24px system-ui";

  context.textAlign =
    "center";

  context.fillText(
    "?",
    point.x,
    point.y + 8,
  );
}

function drawActionDirection(unit) {
  const direction =
    unit.action?.direction;

  if (
    !Number.isFinite(
      direction,
    )
  ) {
    return;
  }

  if (
    unit.action.type !==
      UNIT_ACTIONS.OBSERVE &&
    unit.action.type !==
      UNIT_ACTIONS.RECON_BY_FIRE &&
    unit.action.type !==
      UNIT_ACTIONS.FIRE
  ) {
    return;
  }

  const point =
    hexToWorld(
      unit.column,
      unit.row,
    );

  context.save();

  context.strokeStyle =
    unit.action.type ===
    UNIT_ACTIONS.OBSERVE
      ? "#8ed6b0"
      : "#e6a06e";

  context.lineWidth = 2;

  context.setLineDash([
    5,
    4,
  ]);

  context.beginPath();

  context.moveTo(
    point.x,
    point.y,
  );

  context.lineTo(
    point.x +
      Math.cos(direction) *
        65,

    point.y +
      Math.sin(direction) *
        65,
  );

  context.stroke();
  context.restore();
}

function drawUnit(unit) {
  if (
    !isUnitVisible(
      unit,
      state.developerMode,
    )
  ) {
    return;
  }

  const point =
    hexToWorld(
      unit.column,
      unit.row,
    );

  if (
    unit.id ===
    state.selectedUnitId
  ) {
    drawSelection(point);
  }

  if (
    unit.side === "enemy" &&
    !state.developerMode &&
    unit.detectionStage ===
      DETECTION_STAGES.CONTACT
  ) {
    drawContactIcon(point);
  } else if (
    unit.type ===
    "artillery-observer"
  ) {
    drawInfantryObserverIcon(
      point,
    );
  } else if (
    unit.type ===
    "atgm-team"
  ) {
    drawAtgmIcon(point);
  } else {
    drawTankIcon(
      unit,
      point,
    );
  }

  drawActionDirection(unit);

  context.fillStyle =
    unit.side === "friendly"
      ? "#edf4ef"
      : "#ffd2c8";

  context.font =
    "800 10px system-ui";

  context.textAlign =
    "center";

  const label =
    unit.side === "enemy" &&
    !state.developerMode &&
    !unit.identified
      ? "미확인"
      : unit.id;

  context.fillText(
    label,
    point.x,
    point.y + 31,
  );
}

function drawDestination(unit) {
  if (
    unit.side !== "friendly" ||
    !unit.destination ||
    !Array.isArray(
      unit.plannedPath,
    ) ||
    unit.plannedPath.length === 0
  ) {
    return;
  }

  const route = [
    {
      column:
        unit.column,

      row:
        unit.row,
    },

    ...unit.plannedPath,
  ];

  context.save();

  context.strokeStyle =
    "#d7b46a";

  context.lineWidth = 3;

  context.setLineDash([
    7,
    5,
  ]);

  context.beginPath();

  route.forEach(
    (hex, index) => {
      const point =
        hexToWorld(
          hex.column,
          hex.row,
        );

      if (index === 0) {
        context.moveTo(
          point.x,
          point.y,
        );
      } else {
        context.lineTo(
          point.x,
          point.y,
        );
      }
    },
  );

  context.stroke();
  context.restore();
}

function drawFireTarget(unit) {
  const target =
    unit.fireControl
      ?.targetHex;

  if (!target) {
    return;
  }

  const point =
    hexToWorld(
      target.column,
      target.row,
    );

  context.save();

  context.strokeStyle =
    "#ff9a7f";

  context.lineWidth = 2;

  context.beginPath();

  context.arc(
    point.x,
    point.y,
    14,
    0,
    Math.PI * 2,
  );

  context.stroke();

  context.beginPath();

  context.moveTo(
    point.x - 19,
    point.y,
  );

  context.lineTo(
    point.x + 19,
    point.y,
  );

  context.moveTo(
    point.x,
    point.y - 19,
  );

  context.lineTo(
    point.x,
    point.y + 19,
  );

  context.stroke();
  context.restore();
}

function renderMap() {
  const rect =
    elements.canvas
      .getBoundingClientRect();

  context.clearRect(
    0,
    0,
    rect.width,
    rect.height,
  );

  context.save();

  context.translate(
    state.camera.x,
    state.camera.y,
  );

  context.scale(
    state.camera.zoom,
    state.camera.zoom,
  );

  state.terrain.forEach(
    (terrain) => {
      const point =
        hexToWorld(
          terrain.column,
          terrain.row,
        );

      const terrainType =
        TERRAIN_TYPES[
          terrain.type
        ];

      const selected =
        state.selectedHex
          ?.column ===
          terrain.column &&
        state.selectedHex
          ?.row ===
          terrain.row;

      drawHexagon(
        point.x,
        point.y,
        HEX_RADIUS - 1,
        terrainType.color,
        selected
          ? "#f1d18c"
          : terrainType.stroke,
        selected ? 2.5 : 1,
      );

      drawTerrainSymbol(
        terrainType,
        point.x,
        point.y,
        terrain.elevation,
      );
    },
  );

  state.units.forEach(
    drawDestination,
  );

  state.units
    .filter(
      (unit) =>
        unit.side ===
        "friendly",
    )
    .forEach(drawFireTarget);

  state.units.forEach(
    drawUnit,
  );

  context.restore();

  if (state.developerMode) {
    drawDeveloperHud(
      rect.width,
    );
  }
}

function drawDeveloperHud(
  canvasWidth,
) {
  const selected =
    getSelectedUnit();

  const enemies =
    state.units.filter(
      (unit) =>
        unit.side ===
        "enemy",
    );

  const lines = [
    "DEV MODE",
    `TURN: ${state.turn}`,
    `SELECTED: ${selected?.id ?? "NONE"}`,
    `ACTION: ${selected?.action?.type ?? "NONE"}`,
    `UNITS: ${state.units.length}`,
    `ENEMIES: ${enemies.length}`,

    ...enemies.map(
      (unit) =>
        `${unit.id}: ${unit.column},${unit.row} S${unit.detectionStage}`,
    ),
  ];

  const width = 205;

  const height =
    lines.length * 16 +
    12;

  const x =
    canvasWidth -
    width -
    10;

  const y = 10;

  context.fillStyle =
    "rgba(5, 10, 8, 0.88)";

  context.fillRect(
    x,
    y,
    width,
    height,
  );

  context.strokeStyle =
    "#d7b46a";

  context.strokeRect(
    x,
    y,
    width,
    height,
  );

  context.fillStyle =
    "#ffe3a5";

  context.font =
    "10px monospace";

  context.textAlign =
    "left";

  lines.forEach(
    (line, index) => {
      context.fillText(
        line,
        x + 8,
        y +
          17 +
          index * 16,
      );
    },
  );
}

function beginPointerDrag(event) {
  Object.assign(
    state.camera,
    {
      dragging: true,
      pointerId:
        event.pointerId,
      lastX:
        event.clientX,
      lastY:
        event.clientY,
      downX:
        event.clientX,
      downY:
        event.clientY,
      moved: false,
    },
  );

  elements.canvas
    .setPointerCapture(
      event.pointerId,
    );
}

function continuePointerDrag(event) {
  if (
    !state.camera.dragging ||
    event.pointerId !==
      state.camera.pointerId
  ) {
    return;
  }

  const totalMovement =
    Math.hypot(
      event.clientX -
        state.camera.downX,

      event.clientY -
        state.camera.downY,
    );

  if (
    totalMovement > 7
  ) {
    state.camera.moved =
      true;
  }

  state.camera.x +=
    event.clientX -
    state.camera.lastX;

  state.camera.y +=
    event.clientY -
    state.camera.lastY;

  state.camera.lastX =
    event.clientX;

  state.camera.lastY =
    event.clientY;

  renderMap();
}

function endPointerDrag(event) {
  if (
    event.pointerId !==
    state.camera.pointerId
  ) {
    return;
  }

  const wasTap =
    !state.camera.moved;

  state.camera.dragging =
    false;

  state.camera.pointerId =
    null;

  if (
    elements.canvas
      .hasPointerCapture(
        event.pointerId,
      )
  ) {
    elements.canvas
      .releasePointerCapture(
        event.pointerId,
      );
  }

  if (wasTap) {
    handleMapTap(
      event.clientX,
      event.clientY,
    );
  }
}

function handleAction(action) {
  switch (action) {
    case "open-battle":
      showScreen("battle");
      break;

    case "return-menu":
      showScreen("menu");
      break;

    case "restart-scenario":
      restartCurrentScenario();
      break;

    case "open-settings":
      elements.settingsDialog
        .showModal();
      break;

    case "open-project-info":
      elements.projectInfoDialog
        .showModal();
      break;

    case "center-camera":
      centerCamera();
      renderMap();
      break;

    case "zoom-in":
      changeZoom(0.15);
      break;

    case "zoom-out":
      changeZoom(-0.15);
      break;

    case "execute-turn":
      executeTurn();
      break;

    default:
      console.warn(
        `알 수 없는 action: ${action}`,
      );
  }
}

function bindEvents() {
  document.addEventListener(
    "click",
    (event) => {
      const actionButton =
        event.target.closest(
          "[data-action]",
        );

      if (actionButton) {
        handleAction(
          actionButton.dataset
            .action,
        );

        return;
      }

      const categoryButton =
        event.target.closest(
          "[data-command-category]",
        );

      if (categoryButton) {
        renderCommandOptions(
          categoryButton.dataset
            .commandCategory,
        );
      }
    },
  );

  elements.difficultySelect
    .addEventListener(
      "change",
      (event) => {
        state.difficulty =
          event.target.value;
      },
    );

  elements.developerModeToggle
    .addEventListener(
      "change",
      (event) => {
        state.developerMode =
          event.target.checked;

        renderMap();
      },
    );

  elements.canvas.addEventListener(
    "pointerdown",
    beginPointerDrag,
  );

  elements.canvas.addEventListener(
    "pointermove",
    continuePointerDrag,
  );

  elements.canvas.addEventListener(
    "pointerup",
    endPointerDrag,
  );

  elements.canvas.addEventListener(
    "pointercancel",
    endPointerDrag,
  );

  window.addEventListener(
    "resize",
    () => {
      if (
        state.activeScreen ===
        "battle"
      ) {
        resizeCanvas();
        centerCamera();
        renderMap();
      }
    },
  );
}

function initialize() {
  initializeScenario();

  setInterfaceText();
  bindEvents();

  showScreen("menu");
}

initialize();
