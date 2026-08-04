// src/app.js — 전체 교체, 1~1527행

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

const EFFECT_DURATION = 1500;
const CONTACT_EFFECT_DURATION = 1800;

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

const TARGET_COMMAND_IDS = new Set([
  "observation",
  "recon-by-fire",
  "fire-target",
  ...MOVEMENT_COMMAND_IDS,
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

  fog: {
    current: new Set(),
    explored: new Set(),
  },

  effects: [],
  animationFrameId: null,

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

function randomBetween(minimum, maximum) {
  return (
    minimum +
    Math.random() *
      (maximum - minimum)
  );
}

function randomInteger(minimum, maximum) {
  return Math.floor(
    randomBetween(
      minimum,
      maximum + 1,
    ),
  );
}

function clamp(value, minimum, maximum) {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
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
    ) *
    43758.5453;

  return value - Math.floor(value);
}

function getTerrain(
  column,
  row,
) {
  return state.terrain.get(
    terrainKey(column, row),
  );
}

function setTerrainType(
  column,
  row,
  type,
) {
  const terrain =
    getTerrain(column, row);

  if (terrain) {
    terrain.type = type;
  }
}

function createBaseTerrain(seed) {
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
      const grassValue =
        seededValue(
          column,
          row,
          seed,
        );

      state.terrain.set(
        terrainKey(column, row),
        {
          column,
          row,

          type:
            grassValue < 0.42
              ? "grass"
              : "open",

          elevation: Math.round(
            8 +
              seededValue(
                column + 17,
                row - 9,
                seed,
              ) *
                42,
          ),
        },
      );
    }
  }
}

function generateCluster(
  type,
  centerColumn,
  centerRow,
  radius,
  density,
  seed,
) {
  for (
    let row =
      centerRow - radius;
    row <=
    centerRow + radius;
    row += 1
  ) {
    for (
      let column =
        centerColumn - radius;
      column <=
      centerColumn + radius;
      column += 1
    ) {
      const distance =
        Math.hypot(
          column - centerColumn,
          row - centerRow,
        );

      if (distance > radius) {
        continue;
      }

      const edgeFactor =
        1 -
        distance /
          (radius + 0.5);

      const value =
        seededValue(
          column,
          row,
          seed,
        );

      if (
        value <
        density *
          (0.4 +
            edgeFactor * 0.8)
      ) {
        setTerrainType(
          column,
          row,
          type,
        );
      }
    }
  }
}

function generateTerrainClusters(seed) {
  const forestCount =
    randomInteger(5, 9);

  const ridgeCount =
    randomInteger(4, 7);

  for (
    let index = 0;
    index < forestCount;
    index += 1
  ) {
    generateCluster(
      "forest",
      randomInteger(
        -MAP_COLUMNS + 3,
        MAP_COLUMNS - 3,
      ),
      randomInteger(
        -MAP_ROWS + 3,
        MAP_ROWS - 3,
      ),
      randomInteger(2, 4),
      randomBetween(0.55, 0.85),
      seed + index * 71,
    );
  }

  for (
    let index = 0;
    index < ridgeCount;
    index += 1
  ) {
    generateCluster(
      "ridge",
      randomInteger(
        -MAP_COLUMNS + 3,
        MAP_COLUMNS - 3,
      ),
      randomInteger(
        -MAP_ROWS + 3,
        MAP_ROWS - 3,
      ),
      randomInteger(2, 5),
      randomBetween(0.45, 0.75),
      seed + 1000 + index * 83,
    );
  }
}

function generateRoad() {
  const horizontal =
    Math.random() < 0.5;

  const offset =
    horizontal
      ? randomInteger(
          -Math.floor(
            MAP_ROWS * 0.55,
          ),
          Math.floor(
            MAP_ROWS * 0.55,
          ),
        )
      : randomInteger(
          -Math.floor(
            MAP_COLUMNS * 0.55,
          ),
          Math.floor(
            MAP_COLUMNS * 0.55,
          ),
        );

  let drift = 0;

  if (horizontal) {
    for (
      let column = -MAP_COLUMNS;
      column <= MAP_COLUMNS;
      column += 1
    ) {
      if (Math.random() < 0.24) {
        drift +=
          Math.random() < 0.5
            ? -1
            : 1;
      }

      drift = clamp(
        drift,
        -4,
        4,
      );

      const row =
        offset + drift;

      setTerrainType(
        column,
        row,
        "road",
      );

      if (
        Math.random() < 0.35
      ) {
        setTerrainType(
          column,
          row + 1,
          "road",
        );
      }
    }
  } else {
    for (
      let row = -MAP_ROWS;
      row <= MAP_ROWS;
      row += 1
    ) {
      if (Math.random() < 0.24) {
        drift +=
          Math.random() < 0.5
            ? -1
            : 1;
      }

      drift = clamp(
        drift,
        -4,
        4,
      );

      const column =
        offset + drift;

      setTerrainType(
        column,
        row,
        "road",
      );

      if (
        Math.random() < 0.35
      ) {
        setTerrainType(
          column + 1,
          row,
          "road",
        );
      }
    }
  }
}

function generateRiver() {
  const vertical =
    Math.random() < 0.5;

  const baseOffset =
    vertical
      ? randomInteger(
          -Math.floor(
            MAP_COLUMNS * 0.6,
          ),
          Math.floor(
            MAP_COLUMNS * 0.6,
          ),
        )
      : randomInteger(
          -Math.floor(
            MAP_ROWS * 0.6,
          ),
          Math.floor(
            MAP_ROWS * 0.6,
          ),
        );

  const amplitude =
    randomBetween(2.5, 6);

  const frequency =
    randomBetween(0.18, 0.34);

  const phase =
    randomBetween(
      0,
      Math.PI * 2,
    );

  if (vertical) {
    for (
      let row = -MAP_ROWS;
      row <= MAP_ROWS;
      row += 1
    ) {
      const curve =
        Math.sin(
          row * frequency +
            phase,
        ) *
          amplitude +
        Math.sin(
          row *
            frequency *
            0.43 +
            phase * 1.7,
        ) *
          2;

      const column =
        Math.round(
          baseOffset + curve,
        );

      setTerrainType(
        column,
        row,
        "water",
      );

      if (
        Math.random() < 0.55
      ) {
        setTerrainType(
          column + 1,
          row,
          "water",
        );
      }
    }
  } else {
    for (
      let column = -MAP_COLUMNS;
      column <= MAP_COLUMNS;
      column += 1
    ) {
      const curve =
        Math.sin(
          column * frequency +
            phase,
        ) *
          amplitude +
        Math.sin(
          column *
            frequency *
            0.43 +
            phase * 1.7,
        ) *
          2;

      const row =
        Math.round(
          baseOffset + curve,
        );

      setTerrainType(
        column,
        row,
        "water",
      );

      if (
        Math.random() < 0.55
      ) {
        setTerrainType(
          column,
          row + 1,
          "water",
        );
      }
    }
  }
}

function carvePlayableCorridor() {
  const corridorRow =
    randomInteger(-4, 4);

  for (
    let column = -MAP_COLUMNS;
    column <= MAP_COLUMNS;
    column += 1
  ) {
    const row =
      corridorRow +
      Math.round(
        Math.sin(column * 0.28) *
          2,
      );

    const terrain =
      getTerrain(column, row);

    if (
      terrain?.type === "water"
    ) {
      terrain.type = "road";
    }

    const upper =
      getTerrain(
        column,
        row - 1,
      );

    const lower =
      getTerrain(
        column,
        row + 1,
      );

    if (
      upper &&
      upper.type === "water" &&
      lower &&
      lower.type === "water"
    ) {
      upper.type = "open";
    }
  }
}

function createTerrain() {
  const seed =
    randomInteger(
      1,
      1000000,
    );

  createBaseTerrain(seed);
  generateTerrainClusters(seed);
  generateRiver();
  generateRoad();
  carvePlayableCorridor();
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
      getTerrain(
        unit.column,
        unit.row,
      );

    if (terrain) {
      terrain.type = "open";
    }

    getHexNeighbors(
      unit.column,
      unit.row,
    )
      .slice(0, 2)
      .forEach((neighbor) => {
        const neighborTerrain =
          getTerrain(
            neighbor.column,
            neighbor.row,
          );

        if (
          neighborTerrain &&
          neighborTerrain.type ===
            "water"
        ) {
          neighborTerrain.type =
            "open";
        }
      });
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

  state.effects = [];

  resetFireProcedure();
  resetFog();

  ensureUnitHexesPassable();

  updateDetection(
    state.runtimeScenario,
    state.turn,
  );

  updateFogOfWar();

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
  state.effects = [];

  resetFireProcedure();
  resetFog();

  ensureUnitHexesPassable();

  updateDetection(
    state.runtimeScenario,
    state.turn,
  );

  updateFogOfWar();

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

function resetFog() {
  state.fog.current.clear();
  state.fog.explored.clear();
}

function getSelectedUnit() {
  return state.units.find(
    (unit) =>
      unit.id ===
      state.selectedUnitId,
  );
}

function updateSelectedUnitSummary() {
  const unit =
    getSelectedUnit();

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

  state.activeScreen =
    screenName;

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

function createProcedureButton(
  label,
  active,
  handler,
) {
  const button =
    document.createElement(
      "button",
    );

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
          "탄종 선택 후 지도에서 목표를 지정하세요.",
        );

        renderFireProcedure();
        renderMap();
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

        spawnFireEffect(
          unit,
          unit.fireControl.targetHex,
          unit.fireControl.ammunition,
        );

        setMapMessage(
          `${AMMUNITION_LABELS[unit.fireControl.ammunition]} 1발 발사`,
        );

        updateSelectedUnitSummary();
        renderFireProcedure();
        startEffectAnimation();
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

        spawnFireEffect(
          unit,
          unit.fireControl.targetHex,
          unit.fireControl.ammunition,
        );

        setMapMessage(
          "포수 자율사격을 시작했습니다.",
        );

        updateSelectedUnitSummary();
        renderFireProcedure();
        startEffectAnimation();
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

        removeUnitFireEffects(
          unit.id,
        );

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

    updateFogOfWar();
    updateDetection(
      state.runtimeScenario,
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

    renderMap();
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

function getHexesWithinRange(
  origin,
  range,
) {
  return Array.from(
    state.terrain.values(),
  ).filter(
    (terrain) =>
      getHexDistanceLocal(
        origin,
        terrain,
      ) <= range,
  );
}

function offsetToAxial(
  column,
  row,
) {
  return {
    q:
      column -
      (
        row -
        (row & 1)
      ) /
        2,

    r: row,
  };
}

function getHexDistanceLocal(
  first,
  second,
) {
  const a =
    offsetToAxial(
      first.column,
      first.row,
    );

  const b =
    offsetToAxial(
      second.column,
      second.row,
    );

  const deltaQ =
    a.q - b.q;

  const deltaR =
    a.r - b.r;

  return (
    Math.abs(deltaQ) +
    Math.abs(deltaR) +
    Math.abs(
      deltaQ + deltaR
    )
  ) / 2;
}

function getObservationRange(unit) {
  if (
    unit.action?.type ===
    UNIT_ACTIONS.RECON
  ) {
    return 10;
  }

  return 7;
}

function updateFogOfWar() {
  state.fog.current.clear();

  state.units
    .filter(
      (unit) =>
        unit.side ===
          "friendly" &&
        !unit.destroyed,
    )
    .forEach((unit) => {
      const range =
        getObservationRange(unit);

      getHexesWithinRange(
        unit,
        range,
      ).forEach((hex) => {
        const key =
          terrainKey(
            hex.column,
            hex.row,
          );

        state.fog.current.add(
          key,
        );

        state.fog.explored.add(
          key,
        );
      });
    });
}

function isTargetCommandActive() {
  return (
    state.selectedCommand
      ?.needsTarget === true ||
    TARGET_COMMAND_IDS.has(
      state.selectedCommand?.id,
    )
  );
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
    getTerrain(
      column,
      row,
    );

  if (!terrain) {
    return Infinity;
  }

  return TERRAIN_TYPES[
    terrain.type
  ].movementCost;
}

function selectHex(hex) {
  const terrain =
    getTerrain(
      hex.column,
      hex.row,
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

    updateFogOfWar();

    updateDetection(
      state.runtimeScenario,
      state.turn,
    );

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
    const hiddenBefore =
      new Set(
        state.units
          .filter(
            (candidate) =>
              candidate.side ===
                "enemy" &&
              !candidate.visible,
          )
          .map(
            (candidate) =>
              candidate.id,
          ),
      );

    const affected =
      applyReconByFire(
        state.runtimeScenario,
        unit,
        hex,
        state.turn,
      );

    spawnFireEffect(
      unit,
      hex,
      AMMUNITION_TYPES.HEAT,
      {
        reconByFire: true,
      },
    );

    state.selectedCommand =
      null;

    updateDetection(
      state.runtimeScenario,
      state.turn,
    );

    affected.forEach(
      (enemy) => {
        if (
          hiddenBefore.has(
            enemy.id,
          ) &&
          enemy.visible
        ) {
          spawnContactEffect(
            enemy,
          );
        }
      },
    );

    updateSelectedUnitSummary();

    setMapMessage(
      `화력수색 시작: ${hex.column}, ${hex.row}`,
    );

    startEffectAnimation();
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

  const tappedUnit =
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
    isTargetCommandActive()
  ) {
    if (tappedUnit) {
      selectHex({
        column:
          tappedUnit.column,

        row:
          tappedUnit.row,
      });

      return;
    }

    const targetHex =
      worldToHex(
        world.x,
        world.y,
      );

    if (targetHex) {
      selectHex(targetHex);
    }

    return;
  }

  if (tappedUnit) {
    selectUnit(tappedUnit);
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

function spawnFireEffect(
  unit,
  targetHex,
  ammunition,
  options = {},
) {
  if (
    !unit ||
    !targetHex
  ) {
    return;
  }

  const now =
    performance.now();

  state.effects.push({
    id:
      `${unit.id}-${now}-${Math.random()}`,

    type: "fire",

    unitId: unit.id,

    from: {
      column:
        unit.column,

      row:
        unit.row,
    },

    to: {
      column:
        targetHex.column,

      row:
        targetHex.row,
    },

    ammunition,

    reconByFire:
      options.reconByFire ===
      true,

    startedAt: now,

    expiresAt:
      now +
      EFFECT_DURATION,
  });

  startEffectAnimation();
}

function spawnContactEffect(unit) {
  const now =
    performance.now();

  state.effects.push({
    id:
      `contact-${unit.id}-${now}`,

    type: "contact",

    unitId: unit.id,

    position: {
      column:
        unit.column,

      row:
        unit.row,
    },

    startedAt: now,

    expiresAt:
      now +
      CONTACT_EFFECT_DURATION,
  });

  startEffectAnimation();
}

function removeUnitFireEffects(unitId) {
  state.effects =
    state.effects.filter(
      (effect) =>
        !(
          effect.type ===
            "fire" &&
          effect.unitId ===
            unitId
        ),
    );
}

function removeExpiredEffects(now) {
  state.effects =
    state.effects.filter(
      (effect) =>
        effect.expiresAt >
        now,
    );
}

function startEffectAnimation() {
  if (
    state.animationFrameId !==
    null
  ) {
    return;
  }

  const animate = (now) => {
    removeExpiredEffects(now);

    renderMap(now);

    if (
      state.effects.length > 0
    ) {
      state.animationFrameId =
        requestAnimationFrame(
          animate,
        );
    } else {
      state.animationFrameId =
        null;
    }
  };

  state.animationFrameId =
    requestAnimationFrame(
      animate,
    );
}

function executeTurn() {
  const selectedUnit =
    getSelectedUnit();

  const executedCommand =
    selectedUnit?.command ??
    "대기";

  const hiddenBefore =
    new Set(
      state.units
        .filter(
          (unit) =>
            unit.side ===
              "enemy" &&
            !unit.visible,
        )
        .map(
          (unit) =>
            unit.id,
        ),
    );

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

  state.units
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
        spawnFireEffect(
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
        unit.fireControl.targetHex
      ) {
        spawnFireEffect(
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

  updateFogOfWar();

  state.units
    .filter(
      (unit) =>
        unit.side ===
          "enemy" &&
        unit.visible &&
        hiddenBefore.has(
          unit.id,
        ),
    )
    .forEach(
      spawnContactEffect,
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

  startEffectAnimation();
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

function drawTargetPreview() {
  if (
    !isTargetCommandActive() ||
    !state.selectedHex
  ) {
    return;
  }

  const point =
    hexToWorld(
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

function drawObserverIcon(point) {
  context.save();

  context.translate(
    point.x,
    point.y,
  );

  context.fillStyle =
    "#8c4f45";

  context.strokeStyle =
    "#ffd2c4";

  context.lineWidth = 2;

  context.fillRect(
    -15,
    -11,
    30,
    22,
  );

  context.strokeRect(
    -15,
    -11,
    30,
    22,
  );

  context.beginPath();

  context.arc(
    0,
    0,
    7,
    0,
    Math.PI * 2,
  );

  context.stroke();

  context.beginPath();

  context.moveTo(
    -7,
    0,
  );

  context.lineTo(
    -2,
    0,
  );

  context.moveTo(
    2,
    0,
  );

  context.lineTo(
    7,
    0,
  );

  context.stroke();

  context.beginPath();

  context.moveTo(
    -9,
    -15,
  );

  context.lineTo(
    9,
    -15,
  );

  context.moveTo(
    0,
    -15,
  );

  context.lineTo(
    0,
    -11,
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

function drawObservationArea(unit) {
  if (
    unit.side !== "friendly"
  ) {
    return;
  }

  const point =
    hexToWorld(
      unit.column,
      unit.row,
    );

  if (
    unit.action?.type ===
    UNIT_ACTIONS.RECON
  ) {
    context.save();

    context.fillStyle =
      "rgba(112, 196, 151, 0.10)";

    context.strokeStyle =
      "rgba(150, 230, 184, 0.7)";

    context.lineWidth = 2;
    context.setLineDash([
      7,
      5,
    ]);

    context.beginPath();

    context.arc(
      point.x,
      point.y,
      HEX_RADIUS * 10,
      0,
      Math.PI * 2,
    );

    context.fill();
    context.stroke();
    context.restore();
  }

  if (
    unit.action?.type ===
      UNIT_ACTIONS.OBSERVE &&
    Number.isFinite(
      unit.action.direction,
    )
  ) {
    const direction =
      unit.action.direction;

    const radius =
      HEX_RADIUS * 13;

    context.save();

    context.fillStyle =
      "rgba(105, 206, 153, 0.13)";

    context.strokeStyle =
      "rgba(146, 235, 185, 0.8)";

    context.lineWidth = 2;

    context.beginPath();

    context.moveTo(
      point.x,
      point.y,
    );

    context.arc(
      point.x,
      point.y,
      radius,
      direction -
        Math.PI / 4,
      direction +
        Math.PI / 4,
    );

    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }
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
    drawObserverIcon(point);
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
    unit.plannedPath.length ===
      0
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

function drawFog() {
  if (state.developerMode) {
    return;
  }

  state.terrain.forEach(
    (terrain) => {
      const key =
        terrainKey(
          terrain.column,
          terrain.row,
        );

      const current =
        state.fog.current.has(
          key,
        );

      const explored =
        state.fog.explored.has(
          key,
        );

      if (current) {
        return;
      }

      const point =
        hexToWorld(
          terrain.column,
          terrain.row,
        );

      drawHexagon(
        point.x,
        point.y,
        HEX_RADIUS - 0.5,
        explored
          ? "rgba(4, 8, 7, 0.48)"
          : "rgba(2, 4, 4, 0.84)",
        explored
          ? "rgba(28, 39, 34, 0.45)"
          : "rgba(5, 8, 7, 0.9)",
        1,
      );
    },
  );
}

function drawMuzzleFlash(
  from,
  progress,
) {
  const radius =
    5 +
    (1 - progress) * 13;

  context.save();

  context.fillStyle =
    `rgba(255, 226, 132, ${1 - progress})`;

  context.beginPath();

  context.arc(
    from.x,
    from.y,
    radius,
    0,
    Math.PI * 2,
  );

  context.fill();
  context.restore();
}

function drawTrajectory(
  from,
  to,
  progress,
  ammunition,
) {
  context.save();

  if (
    ammunition ===
    AMMUNITION_TYPES.CANISTER
  ) {
    context.strokeStyle =
      `rgba(255, 211, 139, ${1 - progress * 0.45})`;

    context.lineWidth = 1.5;

    for (
      let index = -3;
      index <= 3;
      index += 1
    ) {
      const angle =
        Math.atan2(
          to.y - from.y,
          to.x - from.x,
        ) +
        index * 0.055;

      const distance =
        Math.hypot(
          to.x - from.x,
          to.y - from.y,
        ) *
        Math.min(
          1,
          progress * 1.3,
        );

      context.beginPath();

      context.moveTo(
        from.x,
        from.y,
      );

      context.lineTo(
        from.x +
          Math.cos(angle) *
            distance,

        from.y +
          Math.sin(angle) *
            distance,
      );

      context.stroke();
    }

    context.restore();
    return;
  }

  context.strokeStyle =
    ammunition ===
    AMMUNITION_TYPES.APFSDS
      ? `rgba(220, 245, 255, ${1 - progress * 0.3})`
      : `rgba(255, 191, 113, ${1 - progress * 0.35})`;

  context.lineWidth =
    ammunition ===
    AMMUNITION_TYPES.APFSDS
      ? 2
      : 3;

  context.beginPath();

  context.moveTo(
    from.x,
    from.y,
  );

  const currentX =
    from.x +
    (to.x - from.x) *
      progress;

  const currentY =
    from.y +
    (to.y - from.y) *
      progress;

  context.lineTo(
    currentX,
    currentY,
  );

  context.stroke();
  context.restore();
}

function drawImpact(
  point,
  progress,
  ammunition,
) {
  if (progress < 0.55) {
    return;
  }

  const impactProgress =
    (
      progress - 0.55
    ) /
    0.45;

  context.save();

  if (
    ammunition ===
    AMMUNITION_TYPES.SMOKE
  ) {
    for (
      let index = 0;
      index < 7;
      index += 1
    ) {
      const angle =
        index *
        (
          Math.PI * 2 / 7
        );

      const radius =
        8 +
        impactProgress * 20;

      context.fillStyle =
        `rgba(180, 190, 183, ${0.55 - impactProgress * 0.22})`;

      context.beginPath();

      context.arc(
        point.x +
          Math.cos(angle) *
            radius *
            0.55,

        point.y +
          Math.sin(angle) *
            radius *
            0.4,

        8 +
          impactProgress * 10,
        0,
        Math.PI * 2,
      );

      context.fill();
    }

    context.restore();
    return;
  }

  const maximumRadius =
    ammunition ===
    AMMUNITION_TYPES.APFSDS
      ? 12
      : ammunition ===
          AMMUNITION_TYPES.CANISTER
        ? 20
        : 30;

  context.fillStyle =
    ammunition ===
    AMMUNITION_TYPES.APFSDS
      ? `rgba(215, 240, 255, ${1 - impactProgress})`
      : `rgba(255, 165, 67, ${0.8 - impactProgress * 0.7})`;

  context.beginPath();

  context.arc(
    point.x,
    point.y,
    4 +
      maximumRadius *
        impactProgress,
    0,
    Math.PI * 2,
  );

  context.fill();

  context.fillStyle =
    `rgba(123, 103, 75, ${0.45 - impactProgress * 0.3})`;

  context.beginPath();

  context.arc(
    point.x,
    point.y + 6,
    10 +
      impactProgress * 24,
    0,
    Math.PI * 2,
  );

  context.fill();
  context.restore();
}

function drawEffects(now) {
  state.effects.forEach(
    (effect) => {
      const duration =
        effect.expiresAt -
        effect.startedAt;

      const progress =
        clamp(
          (
            now -
            effect.startedAt
          ) /
            duration,
          0,
          1,
        );

      if (
        effect.type ===
        "fire"
      ) {
        const from =
          hexToWorld(
            effect.from.column,
            effect.from.row,
          );

        const to =
          hexToWorld(
            effect.to.column,
            effect.to.row,
          );

        drawMuzzleFlash(
          from,
          progress,
        );

        drawTrajectory(
          from,
          to,
          Math.min(
            1,
            progress * 1.7,
          ),
          effect.ammunition,
        );

        drawImpact(
          to,
          progress,
          effect.ammunition,
        );
      }

      if (
        effect.type ===
        "contact"
      ) {
        const point =
          hexToWorld(
            effect.position.column,
            effect.position.row,
          );

        context.save();

        context.strokeStyle =
          `rgba(255, 202, 90, ${1 - progress})`;

        context.lineWidth = 3;

        context.beginPath();

        context.arc(
          point.x,
          point.y,
          18 +
            progress * 26,
          0,
          Math.PI * 2,
        );

        context.stroke();

        context.fillStyle =
          `rgba(255, 220, 130, ${1 - progress})`;

        context.font =
          "900 15px system-ui";

        context.textAlign =
          "center";

        context.fillText(
          "접촉",
          point.x,
          point.y - 25,
        );

        context.restore();
      }
    },
  );
}

function renderMap(
  now = performance.now(),
) {
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

  state.units
    .filter(
      (unit) =>
        unit.side ===
        "friendly",
    )
    .forEach(
      drawObservationArea,
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
    .forEach(
      drawFireTarget,
    );

  drawTargetPreview();

  state.units.forEach(
    drawUnit,
  );

  drawFog();
  drawEffects(now);

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
    `FOG CURRENT: ${state.fog.current.size}`,
    `FOG EXPLORED: ${state.fog.explored.size}`,
    `EFFECTS: ${state.effects.length}`,

    ...enemies.map(
      (unit) =>
        `${unit.id}: ${unit.column},${unit.row} S${unit.detectionStage}`,
    ),
  ];

  const width = 220;

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
