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
    blocksSight: false,
  },
  grass: {
    name: "초지",
    color: "#35412d",
    stroke: "#53604a",
    symbol: "·",
    movementCost: 1,
    concealment: 10,
    cover: 0,
    blocksSight: false,
  },
  forest: {
    name: "숲",
    color: "#173224",
    stroke: "#355443",
    symbol: "♣",
    movementCost: 2,
    concealment: 70,
    cover: 25,
    blocksSight: true,
  },
  ridge: {
    name: "능선",
    color: "#474638",
    stroke: "#6f6b59",
    symbol: "⌃",
    movementCost: 2,
    concealment: 15,
    cover: 45,
    blocksSight: true,
  },
  road: {
    name: "도로",
    color: "#4a493f",
    stroke: "#737165",
    symbol: "═",
    movementCost: 0.6,
    concealment: 0,
    cover: 0,
    blocksSight: false,
  },
  water: {
    name: "하천",
    color: "#183b45",
    stroke: "#315d68",
    symbol: "≈",
    movementCost: Infinity,
    concealment: 0,
    cover: 0,
    blocksSight: false,
  },
};

const state = {
  turn: 1,
  activeScreen: "menu",
  activeCategory: null,
  selectedCommand: null,
  selectedUnitId: "P0",
  selectedHex: null,
  difficulty: "standard",
  developerMode: false,

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

  units: [
    {
      id: "P0",
      side: "friendly",
      type: "tank",
      name: "P0 자차",
      model: "아군 전차",
      column: 0,
      row: 0,
      direction: -Math.PI / 6,
      condition: "정상",
      command: "대기",
      destination: null,
      movementHistory: [],
    },
    {
      id: "P1",
      side: "friendly",
      type: "tank",
      name: "P1 1호차",
      model: "아군 전차",
      column: -3,
      row: 2,
      direction: 0,
      condition: "정상",
      command: "대기",
      destination: null,
      movementHistory: [],
    },
  ],

  terrain: new Map(),
};

const commandGroups = {
  observation: [
    { id: "observation", label: "감시", needsTarget: true },
    { id: "recon", label: "정찰", needsTarget: true },
    { id: "recon-by-fire", label: "화력수색", needsTarget: true },
  ],

  movement: [
    { id: "normal-move", label: "일반이동", needsTarget: true },
    { id: "fire-maneuver", label: "사격기동", needsTarget: true },
    { id: "evasive-maneuver", label: "회피기동", needsTarget: true },
    { id: "retreat", label: "퇴각", needsTarget: true },
  ],

  combat: [
    { id: "fire-command", label: "사격명령", needsTarget: true },
    { id: "fire", label: "쏴", needsTarget: false },
    { id: "fire-adjust", label: "쏴-수정", needsTarget: false },
    { id: "cease-fire", label: "사격 그만", needsTarget: false },
  ],

  survival: [
    { id: "concealment", label: "은폐·엄폐", needsTarget: false },
    { id: "vehicle-smoke", label: "자체연막", needsTarget: false },
    { id: "change-position", label: "위치변경", needsTarget: true },
    { id: "cancel-movement", label: "이동취소", needsTarget: false },
  ],
};

const elements = {
  menuScreen: document.querySelector("#menu-screen"),
  battleScreen: document.querySelector("#battle-screen"),
  turnLabel: document.querySelector("#turn-label"),
  selectedUnitLabel: document.querySelector("#selected-unit-label"),
  currentCommandLabel: document.querySelector("#current-command-label"),
  unitConditionLabel: document.querySelector("#unit-condition-label"),
  commandOptions: document.querySelector("#command-options"),
  settingsDialog: document.querySelector("#settings-dialog"),
  projectInfoDialog: document.querySelector("#project-info-dialog"),
  difficultySelect: document.querySelector("#difficulty-select"),
  developerModeToggle: document.querySelector("#developer-mode-toggle"),
  canvas: document.querySelector("#battle-map"),
  mapMessage: document.querySelector("#map-message"),
};

const context = elements.canvas.getContext("2d");

function terrainKey(column, row) {
  return `${column},${row}`;
}

function seededValue(column, row) {
  const value = Math.sin(column * 12.9898 + row * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function createTerrain() {
  state.terrain.clear();

  for (let row = -MAP_ROWS; row <= MAP_ROWS; row += 1) {
    for (
      let column = -MAP_COLUMNS;
      column <= MAP_COLUMNS;
      column += 1
    ) {
      const random = seededValue(column, row);
      let type = "open";

      if (Math.abs(row) <= 1 && column % 4 !== 0) {
        type = "road";
      } else if (column === 7 && row > -9 && row < 10) {
        type = "water";
      } else if (random < 0.18) {
        type = "forest";
      } else if (random < 0.31) {
        type = "ridge";
      } else if (random < 0.55) {
        type = "grass";
      }

      state.terrain.set(terrainKey(column, row), {
        column,
        row,
        type,
        elevation: Math.round(
          10 +
          seededValue(column + 17, row - 9) * 35,
        ),
      });
    }
  }

  // 자차 주변은 이동 가능한 지형으로 보장
  [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, 1],
    [0, -1],
    [-3, 2],
  ].forEach(([column, row]) => {
    const terrain = state.terrain.get(terrainKey(column, row));

    if (terrain) {
      terrain.type = "open";
    }
  });
}

function getSelectedUnit() {
  return state.units.find(
    (unit) => unit.id === state.selectedUnitId,
  );
}

function updateSelectedUnitSummary() {
  const unit = getSelectedUnit();

  if (!unit) {
    return;
  }

  elements.selectedUnitLabel.textContent = unit.name;
  elements.currentCommandLabel.textContent = unit.command;
  elements.unitConditionLabel.textContent = unit.condition;
}

function showScreen(screenName) {
  const showMenu = screenName === "menu";

  state.activeScreen = screenName;

  elements.menuScreen.hidden = !showMenu;
  elements.battleScreen.hidden = showMenu;

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
  const categoryLabels = {
    observation: "감시 및 정찰",
    movement: "기동",
    combat: "사격",
    survival: "생존성 보장",
  };

  document
    .querySelectorAll("[data-command-category]")
    .forEach((button) => {
      button.textContent =
        categoryLabels[button.dataset.commandCategory];
    });
}

function renderCommandOptions(category) {
  state.activeCategory = category;
  state.selectedCommand = null;

  document.querySelectorAll(".command-category").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.commandCategory === category,
    );
  });

  elements.commandOptions.replaceChildren();

  commandGroups[category].forEach((command) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "command-option";
    button.textContent = command.label;

    button.addEventListener("click", () => {
      selectCommand(command, button);
    });

    elements.commandOptions.append(button);
  });
}

function selectCommand(command, selectedButton) {
  const unit = getSelectedUnit();

  state.selectedCommand = command;

  document.querySelectorAll(".command-option").forEach((button) => {
    button.classList.toggle(
      "is-selected",
      button === selectedButton,
    );
  });

  if (command.id === "cancel-movement") {
    unit.destination = null;
    unit.command = "대기";
    state.selectedCommand = null;

    updateSelectedUnitSummary();
    setMapMessage("이동 명령을 취소했습니다.");
    renderMap();
    return;
  }

  if (command.id === "cease-fire") {
    unit.command = "사격 그만";
    updateSelectedUnitSummary();
    setMapMessage("승무원에게 사격 그만을 명령했습니다.");
    return;
  }

  if (command.id === "vehicle-smoke") {
    unit.command = "자체연막";
    updateSelectedUnitSummary();
    setMapMessage("자체연막 명령이 예약되었습니다.");
    return;
  }

  if (command.needsTarget) {
    setMapMessage(
      `${command.label}: 지도에서 목표 육각형을 선택하세요.`,
    );
  } else {
    unit.command = command.label;
    updateSelectedUnitSummary();
    setMapMessage(`${command.label} 명령이 예약되었습니다.`);
  }
}

function hexToWorld(column, row) {
  const horizontalSpacing = Math.sqrt(3) * HEX_RADIUS;
  const verticalSpacing = HEX_RADIUS * 1.5;

  return {
    x:
      column * horizontalSpacing +
      (row % 2 === 0 ? 0 : horizontalSpacing / 2),
    y: row * verticalSpacing,
  };
}

function worldToHex(worldX, worldY) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (let row = -MAP_ROWS; row <= MAP_ROWS; row += 1) {
    for (
      let column = -MAP_COLUMNS;
      column <= MAP_COLUMNS;
      column += 1
    ) {
      const point = hexToWorld(column, row);
      const distance = Math.hypot(
        worldX - point.x,
        worldY - point.y,
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { column, row };
      }
    }
  }

  return nearestDistance <= HEX_RADIUS
    ? nearest
    : null;
}

function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - state.camera.x) / state.camera.zoom,
    y: (screenY - state.camera.y) / state.camera.zoom,
  };
}

function selectUnit(unit) {
  state.selectedUnitId = unit.id;
  state.selectedCommand = null;

  updateSelectedUnitSummary();
  setMapMessage(
    `${unit.name} 선택 — ${unit.model}, 상태 ${unit.condition}`,
  );
  renderMap();
}

function selectHex(hex) {
  const terrain = state.terrain.get(
    terrainKey(hex.column, hex.row),
  );

  if (!terrain) {
    return;
  }

  state.selectedHex = hex;

  const terrainType = TERRAIN_TYPES[terrain.type];
  const unit = getSelectedUnit();
  const command = state.selectedCommand;

  if (
    command?.needsTarget &&
    command.id.includes("move") ||
    command?.id === "fire-maneuver" ||
    command?.id === "evasive-maneuver" ||
    command?.id === "retreat"
  ) {
    if (!Number.isFinite(terrainType.movementCost)) {
      setMapMessage(
        `${terrainType.name}: 차량 이동 불가 지역입니다.`,
      );
      renderMap();
      return;
    }

    unit.destination = {
      column: hex.column,
      row: hex.row,
    };

    unit.command = command.label;
    updateSelectedUnitSummary();

    setMapMessage(
      `${command.label} 목적지: ${hex.column}, ${hex.row}`,
    );

    renderMap();
    return;
  }

  if (command?.needsTarget) {
    unit.command =
      `${command.label} (${hex.column}, ${hex.row})`;

    updateSelectedUnitSummary();

    setMapMessage(
      `${command.label} 목표를 지정했습니다.`,
    );

    renderMap();
    return;
  }

  setMapMessage(
    `${terrainType.name} | 고도 ${terrain.elevation}m | ` +
    `이동비용 ${terrainType.movementCost} | ` +
    `은폐 ${terrainType.concealment}% | ` +
    `엄폐 ${terrainType.cover}%`,
  );

  renderMap();
}

function handleMapTap(clientX, clientY) {
  const rect = elements.canvas.getBoundingClientRect();
  const screenX = clientX - rect.left;
  const screenY = clientY - rect.top;
  const world = screenToWorld(screenX, screenY);

  const unit = state.units.find((candidate) => {
    const point = hexToWorld(
      candidate.column,
      candidate.row,
    );

    return Math.hypot(
      world.x - point.x,
      world.y - point.y,
    ) <= 30;
  });

  if (unit) {
    selectUnit(unit);
    return;
  }

  const hex = worldToHex(world.x, world.y);

  if (hex) {
    selectHex(hex);
  }
}

function getHexNeighbors(column, row) {
  const evenRow = row % 2 === 0;

  const directions = evenRow
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

  return directions.map(([columnOffset, rowOffset]) => ({
    column: column + columnOffset,
    row: row + rowOffset,
  }));
}

function chooseNextMovementHex(unit) {
  if (!unit.destination) {
    return null;
  }

  const candidates = getHexNeighbors(
    unit.column,
    unit.row,
  )
    .filter((hex) => {
      const terrain = state.terrain.get(
        terrainKey(hex.column, hex.row),
      );

      return (
        terrain &&
        Number.isFinite(
          TERRAIN_TYPES[terrain.type].movementCost,
        )
      );
    })
    .map((hex) => {
      const terrain = state.terrain.get(
        terrainKey(hex.column, hex.row),
      );

      return {
        ...hex,
        score:
          Math.hypot(
            unit.destination.column - hex.column,
            unit.destination.row - hex.row,
          ) +
          TERRAIN_TYPES[terrain.type].movementCost * 0.15,
      };
    })
    .sort((a, b) => a.score - b.score);

  return candidates[0] ?? null;
}

function executeMovement(unit) {
  if (!unit.destination) {
    return;
  }

  if (
    unit.column === unit.destination.column &&
    unit.row === unit.destination.row
  ) {
    unit.destination = null;
    unit.command = "대기";
    return;
  }

  const nextHex = chooseNextMovementHex(unit);

  if (!nextHex) {
    unit.command = "이동 불가";
    unit.destination = null;
    return;
  }

  unit.movementHistory.push({
    column: unit.column,
    row: unit.row,
    turn: state.turn,
  });

  unit.column = nextHex.column;
  unit.row = nextHex.row;

  if (
    unit.column === unit.destination.column &&
    unit.row === unit.destination.row
  ) {
    unit.destination = null;
    unit.command = "목적지 도달";
  }
}

function executeTurn() {
  const unit = getSelectedUnit();
  const executedCommand = unit.command;

  state.units.forEach(executeMovement);

  state.turn += 1;
  elements.turnLabel.textContent = `TURN ${state.turn}`;

  state.selectedCommand = null;

  document.querySelectorAll(".command-option").forEach((button) => {
    button.classList.remove("is-selected");
  });

  updateSelectedUnitSummary();
  setMapMessage(
    `TURN ${state.turn - 1}: ${executedCommand} 처리`,
  );

  renderMap();
}

function resizeCanvas() {
  const rect = elements.canvas.getBoundingClientRect();
  const pixelRatio = Math.min(
    window.devicePixelRatio || 1,
    2,
  );

  elements.canvas.width = Math.max(
    1,
    Math.floor(rect.width * pixelRatio),
  );

  elements.canvas.height = Math.max(
    1,
    Math.floor(rect.height * pixelRatio),
  );

  context.setTransform(
    pixelRatio,
    0,
    0,
    pixelRatio,
    0,
    0,
  );
}

function centerCamera() {
  const rect = elements.canvas.getBoundingClientRect();
  const unit = getSelectedUnit();
  const point = hexToWorld(unit.column, unit.row);

  state.camera.x =
    rect.width / 2 - point.x * state.camera.zoom;

  state.camera.y =
    rect.height / 2 - point.y * state.camera.zoom;
}

function changeZoom(amount) {
  state.camera.zoom = Math.min(
    1.8,
    Math.max(0.55, state.camera.zoom + amount),
  );

  centerCamera();
  setMapMessage(
    `지도 배율 ${Math.round(state.camera.zoom * 100)}%`,
  );
  renderMap();
}

function drawHexagon(
  centerX,
  centerY,
  radius,
  fill,
  stroke,
  lineWidth = 1,
) {
  context.beginPath();

  for (let side = 0; side < 6; side += 1) {
    const angle =
      Math.PI / 3 * side - Math.PI / 6;

    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    if (side === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.lineWidth = lineWidth;
  context.stroke();
}

function drawTerrainSymbol(
  terrainType,
  x,
  y,
  elevation,
) {
  context.fillStyle = "rgba(230, 239, 229, 0.58)";
  context.font = "600 12px system-ui";
  context.textAlign = "center";

  if (terrainType.symbol) {
    context.fillText(terrainType.symbol, x, y + 4);
  }

  if (state.developerMode) {
    context.fillStyle = "#e4d49c";
    context.font = "9px monospace";
    context.fillText(`${elevation}m`, x, y + 18);
  }
}

function drawTank(unit, selected) {
  const point = hexToWorld(unit.column, unit.row);

  context.save();
  context.translate(point.x, point.y);
  context.rotate(unit.direction);

  if (selected) {
    context.beginPath();
    context.arc(0, 0, 24, 0, Math.PI * 2);
    context.fillStyle = "rgba(198, 225, 181, 0.2)";
    context.fill();
    context.strokeStyle = "#c5dfb5";
    context.lineWidth = 2;
    context.stroke();
  }

  context.fillStyle = "#8fbda3";
  context.strokeStyle = "#e0f4e5";
  context.lineWidth = 1.5;

  context.fillRect(-13, -8, 26, 16);
  context.strokeRect(-13, -8, 26, 16);

  context.beginPath();
  context.arc(0, 0, 6, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(4, 0);
  context.lineTo(21, 0);
  context.stroke();

  context.restore();

  context.fillStyle = "#edf4ef";
  context.font = "800 11px system-ui";
  context.textAlign = "center";
  context.fillText(unit.id, point.x, point.y + 27);
}

function drawDestination(unit) {
  if (!unit.destination) {
    return;
  }

  const start = hexToWorld(unit.column, unit.row);
  const end = hexToWorld(
    unit.destination.column,
    unit.destination.row,
  );

  context.save();
  context.setLineDash([7, 6]);
  context.strokeStyle = "#d7b46a";
  context.lineWidth = 3;

  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();

  context.setLineDash([]);

  context.beginPath();
  context.arc(end.x, end.y, 13, 0, Math.PI * 2);
  context.fillStyle = "rgba(215, 180, 106, 0.25)";
  context.fill();
  context.strokeStyle = "#f0cf87";
  context.stroke();

  context.restore();
}

function drawMovementHistory(unit) {
  if (unit.movementHistory.length === 0) {
    return;
  }

  const recent = unit.movementHistory.slice(-8);

  context.save();
  context.strokeStyle = "rgba(158, 189, 139, 0.4)";
  context.lineWidth = 2;

  context.beginPath();

  recent.forEach((record, index) => {
    const point = hexToWorld(
      record.column,
      record.row,
    );

    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });

  const current = hexToWorld(unit.column, unit.row);
  context.lineTo(current.x, current.y);
  context.stroke();
  context.restore();
}

function renderMap() {
  const rect = elements.canvas.getBoundingClientRect();

  context.clearRect(0, 0, rect.width, rect.height);
  context.save();

  context.translate(state.camera.x, state.camera.y);
  context.scale(state.camera.zoom, state.camera.zoom);

  state.terrain.forEach((terrain) => {
    const point = hexToWorld(
      terrain.column,
      terrain.row,
    );

    const terrainType =
      TERRAIN_TYPES[terrain.type];

    const isSelected =
      state.selectedHex?.column === terrain.column &&
      state.selectedHex?.row === terrain.row;

    drawHexagon(
      point.x,
      point.y,
      HEX_RADIUS - 1,
      terrainType.color,
      isSelected ? "#f1d18c" : terrainType.stroke,
      isSelected ? 2.5 : 1,
    );

    drawTerrainSymbol(
      terrainType,
      point.x,
      point.y,
      terrain.elevation,
    );
  });

  state.units.forEach(drawMovementHistory);
  state.units.forEach(drawDestination);

  state.units.forEach((unit) => {
    drawTank(
      unit,
      unit.id === state.selectedUnitId,
    );
  });

  context.restore();

  if (state.developerMode) {
    drawDeveloperHud(rect.width);
  }
}

function drawDeveloperHud(canvasWidth) {
  const selectedUnit = getSelectedUnit();

  const lines = [
    "DEV MODE",
    `TURN: ${state.turn}`,
    `SELECTED: ${selectedUnit.id}`,
    `HEX: ${selectedUnit.column},${selectedUnit.row}`,
    `ZOOM: ${state.camera.zoom.toFixed(2)}`,
    `UNITS: ${state.units.length}`,
  ];

  const width = 130;
  const height = lines.length * 17 + 12;
  const x = canvasWidth - width - 10;
  const y = 10;

  context.fillStyle = "rgba(5, 10, 8, 0.85)";
  context.fillRect(x, y, width, height);
  context.strokeStyle = "#d7b46a";
  context.strokeRect(x, y, width, height);

  context.fillStyle = "#ffe3a5";
  context.font = "10px monospace";
  context.textAlign = "left";

  lines.forEach((line, index) => {
    context.fillText(
      line,
      x + 8,
      y + 17 + index * 17,
    );
  });
}

function setMapMessage(message) {
  elements.mapMessage.textContent = message;
}

function beginPointerDrag(event) {
  state.camera.dragging = true;
  state.camera.pointerId = event.pointerId;
  state.camera.lastX = event.clientX;
  state.camera.lastY = event.clientY;
  state.camera.downX = event.clientX;
  state.camera.downY = event.clientY;
  state.camera.moved = false;

  elements.canvas.setPointerCapture(event.pointerId);
}

function continuePointerDrag(event) {
  if (
    !state.camera.dragging ||
    event.pointerId !== state.camera.pointerId
  ) {
    return;
  }

  const deltaX = event.clientX - state.camera.lastX;
  const deltaY = event.clientY - state.camera.lastY;

  if (
    Math.hypot(
      event.clientX - state.camera.downX,
      event.clientY - state.camera.downY,
    ) > 7
  ) {
    state.camera.moved = true;
  }

  state.camera.x += deltaX;
  state.camera.y += deltaY;
  state.camera.lastX = event.clientX;
  state.camera.lastY = event.clientY;

  renderMap();
}

function endPointerDrag(event) {
  if (event.pointerId !== state.camera.pointerId) {
    return;
  }

  const wasTap = !state.camera.moved;

  state.camera.dragging = false;
  state.camera.pointerId = null;

  if (elements.canvas.hasPointerCapture(event.pointerId)) {
    elements.canvas.releasePointerCapture(event.pointerId);
  }

  if (wasTap) {
    handleMapTap(event.clientX, event.clientY);
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

    case "open-settings":
      elements.settingsDialog.showModal();
      break;

    case "open-project-info":
      elements.projectInfoDialog.showModal();
      break;

    case "center-camera":
      centerCamera();
      setMapMessage("선택 객체를 화면 중앙에 표시했습니다.");
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
      console.warn(`알 수 없는 action: ${action}`);
  }
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const actionButton =
      event.target.closest("[data-action]");

    if (actionButton) {
      handleAction(actionButton.dataset.action);
      return;
    }

    const categoryButton = event.target.closest(
      "[data-command-category]",
    );

    if (categoryButton) {
      renderCommandOptions(
        categoryButton.dataset.commandCategory,
      );
    }
  });

  elements.difficultySelect.addEventListener(
    "change",
    (event) => {
      state.difficulty = event.target.value;
    },
  );

  elements.developerModeToggle.addEventListener(
    "change",
    (event) => {
      state.developerMode = event.target.checked;
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

  window.addEventListener("resize", () => {
    if (state.activeScreen === "battle") {
      resizeCanvas();
      centerCamera();
      renderMap();
    }
  });
}

function initialize() {
  createTerrain();
  setInterfaceText();
  bindEvents();
  updateSelectedUnitSummary();
  showScreen("menu");
}

initialize();
