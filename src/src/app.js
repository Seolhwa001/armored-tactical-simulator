const state = {
  turn: 1,
  activeScreen: "menu",
  activeCategory: null,
  selectedCommand: null,
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
  },
};

const commandGroups = {
  observation: [
    { id: "focused-observation", label: "집중감시" },
    { id: "wide-recon", label: "광역정찰" },
    { id: "recon-by-fire", label: "화력수색" },
  ],
  movement: [
    { id: "normal-move", label: "일반이동" },
    { id: "fire-maneuver", label: "사격기동" },
    { id: "evasive-maneuver", label: "회피기동" },
    { id: "retreat", label: "퇴각" },
  ],
  combat: [
    { id: "fire-command", label: "사격명령" },
    { id: "fire", label: "쏴" },
    { id: "fire-adjust", label: "쏴-수정" },
    { id: "cease-fire", label: "사격 그만" },
  ],
  survival: [
    { id: "concealment", label: "은폐·엄폐" },
    { id: "vehicle-smoke", label: "자체연막" },
    { id: "change-position", label: "위치변경" },
    { id: "cancel-movement", label: "이동취소" },
  ],
};

const elements = {
  menuScreen: document.querySelector("#menu-screen"),
  battleScreen: document.querySelector("#battle-screen"),
  turnLabel: document.querySelector("#turn-label"),
  currentCommandLabel: document.querySelector("#current-command-label"),
  commandOptions: document.querySelector("#command-options"),
  executeTurnButton: document.querySelector("#execute-turn-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  projectInfoDialog: document.querySelector("#project-info-dialog"),
  difficultySelect: document.querySelector("#difficulty-select"),
  developerModeToggle: document.querySelector("#developer-mode-toggle"),
  canvas: document.querySelector("#battle-map"),
  mapMessage: document.querySelector("#map-message"),
};

const canvasContext = elements.canvas.getContext("2d");

function showScreen(screenName) {
  const showMenu = screenName === "menu";

  state.activeScreen = screenName;

  elements.menuScreen.hidden = !showMenu;
  elements.battleScreen.hidden = showMenu;

  elements.menuScreen.classList.toggle("screen--active", showMenu);
  elements.battleScreen.classList.toggle("screen--active", !showMenu);

  if (!showMenu) {
    requestAnimationFrame(() => {
      resizeCanvas();
      centerCamera();
      renderMap();
    });
  }
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

  elements.currentCommandLabel.textContent = "대기";
  elements.commandOptions.replaceChildren();

  const commands = commandGroups[category];

  if (!commands) {
    const message = document.createElement("p");
    message.textContent = "사용 가능한 명령이 없습니다.";
    elements.commandOptions.append(message);
    return;
  }

  commands.forEach((command) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "command-option";
    button.dataset.commandId = command.id;
    button.textContent = command.label;

    button.addEventListener("click", () => {
      selectCommand(command, button);
    });

    elements.commandOptions.append(button);
  });
}

function selectCommand(command, selectedButton) {
  state.selectedCommand = command;

  elements.currentCommandLabel.textContent = command.label;

  document.querySelectorAll(".command-option").forEach((button) => {
    button.classList.toggle("is-selected", button === selectedButton);
  });

  setMapMessage(`${command.label} 명령이 예약되었습니다.`);
}

function executeTurn() {
  const commandName = state.selectedCommand?.label ?? "대기";

  state.turn += 1;

  elements.turnLabel.textContent = `TURN ${state.turn}`;
  setMapMessage(`TURN ${state.turn - 1}: ${commandName} 실행`);

  state.selectedCommand = null;
  elements.currentCommandLabel.textContent = "대기";

  document.querySelectorAll(".command-option").forEach((button) => {
    button.classList.remove("is-selected");
  });

  renderMap();
}

function setMapMessage(message) {
  elements.mapMessage.textContent = message;
}

function resizeCanvas() {
  const rect = elements.canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  elements.canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
  elements.canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));

  canvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function centerCamera() {
  const rect = elements.canvas.getBoundingClientRect();

  state.camera.x = rect.width / 2;
  state.camera.y = rect.height / 2;
  state.camera.zoom = 1;
}

function changeZoom(amount) {
  const nextZoom = state.camera.zoom + amount;

  state.camera.zoom = Math.min(1.8, Math.max(0.55, nextZoom));

  setMapMessage(`지도 배율 ${Math.round(state.camera.zoom * 100)}%`);
  renderMap();
}

function drawHexagon(centerX, centerY, radius, fill, stroke) {
  canvasContext.beginPath();

  for (let side = 0; side < 6; side += 1) {
    const angle = Math.PI / 3 * side - Math.PI / 6;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    if (side === 0) {
      canvasContext.moveTo(x, y);
    } else {
      canvasContext.lineTo(x, y);
    }
  }

  canvasContext.closePath();
  canvasContext.fillStyle = fill;
  canvasContext.fill();
  canvasContext.strokeStyle = stroke;
  canvasContext.lineWidth = 1;
  canvasContext.stroke();
}

function drawTank(x, y, rotation = 0) {
  canvasContext.save();
  canvasContext.translate(x, y);
  canvasContext.rotate(rotation);

  canvasContext.fillStyle = "#8fbda3";
  canvasContext.strokeStyle = "#d9eee0";
  canvasContext.lineWidth = 1.5;

  canvasContext.fillRect(-12, -8, 24, 16);
  canvasContext.strokeRect(-12, -8, 24, 16);

  canvasContext.beginPath();
  canvasContext.arc(0, 0, 6, 0, Math.PI * 2);
  canvasContext.fill();
  canvasContext.stroke();

  canvasContext.beginPath();
  canvasContext.moveTo(4, 0);
  canvasContext.lineTo(20, 0);
  canvasContext.stroke();

  canvasContext.restore();
}

function renderMap() {
  const rect = elements.canvas.getBoundingClientRect();

  canvasContext.clearRect(0, 0, rect.width, rect.height);
  canvasContext.save();

  canvasContext.translate(state.camera.x, state.camera.y);
  canvasContext.scale(state.camera.zoom, state.camera.zoom);

  const radius = 28;
  const horizontalSpacing = Math.sqrt(3) * radius;
  const verticalSpacing = radius * 1.5;
  const columns = 18;
  const rows = 18;

  for (let row = -rows; row <= rows; row += 1) {
    for (let column = -columns; column <= columns; column += 1) {
      const x =
        column * horizontalSpacing +
        (row % 2 === 0 ? 0 : horizontalSpacing / 2);

      const y = row * verticalSpacing;

      const terrainIndex = Math.abs(row * 3 + column * 5) % 7;

      let fill = "#17251c";

      if (terrainIndex === 1 || terrainIndex === 5) {
        fill = "#263424";
      }

      if (terrainIndex === 2) {
        fill = "#30362a";
      }

      if (terrainIndex === 3) {
        fill = "#1e3027";
      }

      drawHexagon(x, y, radius - 1, fill, "#3c4e41");
    }
  }

  drawTank(0, 0, -Math.PI / 6);

  canvasContext.fillStyle = "#dceadf";
  canvasContext.font = "700 12px system-ui";
  canvasContext.textAlign = "center";
  canvasContext.fillText("P0", 0, 25);

  canvasContext.restore();

  if (state.developerMode) {
    drawDeveloperHud(rect.width);
  }
}

function drawDeveloperHud(canvasWidth) {
  const lines = [
    "DEV MODE",
    `TURN: ${state.turn}`,
    `ZOOM: ${state.camera.zoom.toFixed(2)}`,
    `CAM X: ${Math.round(state.camera.x)}`,
    `CAM Y: ${Math.round(state.camera.y)}`,
  ];

  const width = 118;
  const height = lines.length * 18 + 12;
  const x = canvasWidth - width - 10;
  const y = 10;

  canvasContext.fillStyle = "rgba(5, 10, 8, 0.82)";
  canvasContext.fillRect(x, y, width, height);

  canvasContext.strokeStyle = "#d7b46a";
  canvasContext.strokeRect(x, y, width, height);

  canvasContext.fillStyle = "#ffe3a5";
  canvasContext.font = "11px monospace";
  canvasContext.textAlign = "left";

  lines.forEach((line, index) => {
    canvasContext.fillText(line, x + 8, y + 18 + index * 18);
  });
}

function beginPointerDrag(event) {
  if (state.activeScreen !== "battle") {
    return;
  }

  state.camera.dragging = true;
  state.camera.pointerId = event.pointerId;
  state.camera.lastX = event.clientX;
  state.camera.lastY = event.clientY;

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

  state.camera.dragging = false;
  state.camera.pointerId = null;

  if (elements.canvas.hasPointerCapture(event.pointerId)) {
    elements.canvas.releasePointerCapture(event.pointerId);
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
      setMapMessage("자차 위치로 이동했습니다.");
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
    const actionButton = event.target.closest("[data-action]");

    if (actionButton) {
      handleAction(actionButton.dataset.action);
      return;
    }

    const categoryButton = event.target.closest(
      "[data-command-category]",
    );

    if (categoryButton) {
      renderCommandOptions(categoryButton.dataset.commandCategory);
    }
  });

  elements.difficultySelect.addEventListener("change", (event) => {
    state.difficulty = event.target.value;
  });

  elements.developerModeToggle.addEventListener("change", (event) => {
    state.developerMode = event.target.checked;

    if (state.activeScreen === "battle") {
      renderMap();
    }
  });

  elements.canvas.addEventListener("pointerdown", beginPointerDrag);
  elements.canvas.addEventListener("pointermove", continuePointerDrag);
  elements.canvas.addEventListener("pointerup", endPointerDrag);
  elements.canvas.addEventListener("pointercancel", endPointerDrag);

  window.addEventListener("resize", () => {
    if (state.activeScreen === "battle") {
      resizeCanvas();
      centerCamera();
      renderMap();
    }
  });
}

function initialize() {
  bindEvents();
  showScreen("menu");
}

initialize();
