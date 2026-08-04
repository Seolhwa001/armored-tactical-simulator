// src/ui/commandPanel.js — 새 파일

import {
  UNIT_ACTIONS,
  setPersistentAction,
} from "../engine/actions.js";

import {
  commandMainGunStow,
  getTurretStatus,
  setTurretMode,
  TURRET_MODES,
} from "../engine/turretControl.js";

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

const TURRET_MODE_LABELS = {
  [TURRET_MODES.NORMAL]:
    "정상구동",

  [TURRET_MODES.EMERGENCY]:
    "비상구동",

  [TURRET_MODES.MANUAL]:
    "수동구동",
};

function createButton(
  label,
  options = {},
) {
  const button =
    document.createElement(
      "button",
    );

  button.type = "button";
  button.className =
    "command-option";

  button.textContent =
    label;

  button.disabled =
    options.disabled === true;

  button.classList.toggle(
    "is-selected",
    options.active === true,
  );

  if (options.onClick) {
    button.addEventListener(
      "click",
      options.onClick,
    );
  }

  return button;
}

function createCommandButton(
  command,
  onSelect,
) {
  return createButton(
    command.label,
    {
      onClick: (event) => {
        onSelect(
          command,
          event.currentTarget,
        );
      },
    },
  );
}

function createTurretStatusPanel(
  unit,
) {
  const panel =
    document.createElement(
      "div",
    );

  panel.className =
    "turret-status-panel";

  const status =
    getTurretStatus(unit);

  if (!status) {
    panel.textContent =
      "포탑 제어 기능 없음";

    return panel;
  }

  const stabilizerText =
    status.stabilizerAvailable
      ? "사용 가능"
      : status.stabilizerOperational
        ? "현재 모드 사용 불가"
        : "고장";

  const stowText =
    status.lockedToHull
      ? status.aligned
        ? "완료"
        : "회전 중"
      : "해제";

  const rows = [
    [
      "구동",
      TURRET_MODE_LABELS[
        status.mode
      ],
    ],
    [
      "안정화",
      stabilizerText,
    ],
    [
      "주포 정위치",
      stowText,
    ],
  ];

  rows.forEach(
    ([label, value]) => {
      const row =
        document.createElement(
          "span",
        );

      const title =
        document.createElement(
          "span",
        );

      const strong =
        document.createElement(
          "strong",
        );

      title.textContent =
        `${label}: `;

      strong.textContent =
        value;

      row.append(
        title,
        strong,
      );

      panel.append(row);
    },
  );

  if (status.warning) {
    const warning =
      document.createElement(
        "p",
      );

    warning.className =
      "turret-warning";

    warning.textContent =
      status.warning;

    panel.append(warning);
  }

  return panel;
}

export function createCommandPanel({
  container,
  getSelectedUnit,
  getTurn,
  onCommandSelected,
  onStateChanged,
  onMessage,
  onCancelMovement,
}) {
  function clear() {
    container.replaceChildren();
  }

  function showMessage(message) {
    clear();

    const paragraph =
      document.createElement(
        "p",
      );

    paragraph.textContent =
      message;

    container.append(
      paragraph,
    );
  }

  function renderCommandList(
    commands,
  ) {
    clear();

    commands.forEach(
      (command) => {
        container.append(
          createCommandButton(
            command,
            onCommandSelected,
          ),
        );
      },
    );
  }

  function renderObservation() {
    renderCommandList(
      OBSERVATION_COMMANDS,
    );
  }

  function renderMovement() {
    renderCommandList(
      MOVEMENT_COMMANDS,
    );
  }

  function renderSurvival() {
    clear();

    const unit =
      getSelectedUnit();

    if (
      !unit ||
      unit.side !== "friendly"
    ) {
      showMessage(
        "아군 객체를 선택하세요.",
      );

      return;
    }

    SURVIVAL_COMMANDS.forEach(
      (command) => {
        const button =
          createCommandButton(
            command,
            (
              selectedCommand,
              selectedButton,
            ) => {
              if (
                selectedCommand.id ===
                "cancel-movement"
              ) {
                onCancelMovement(
                  unit,
                );

                onStateChanged();

                onMessage(
                  `${unit.name}의 이동 명령을 취소했습니다.`,
                );

                return;
              }

              onCommandSelected(
                selectedCommand,
                selectedButton,
              );
            },
          );

        container.append(button);
      },
    );

    if (!unit.turretControl) {
      return;
    }

    const turretPanel =
      document.createElement(
        "div",
      );

    turretPanel.className =
      "turret-control-panel";

    turretPanel.append(
      createTurretStatusPanel(
        unit,
      ),
    );

    turretPanel.append(
      createButton(
        "주포 정위치",
        {
          active:
            unit.turretControl
              .lockedToHull,

          onClick: () => {
            const result =
              commandMainGunStow(
                unit,
                getTurn(),
              );

            if (
              !result.success
            ) {
              onMessage(
                result.reason,
              );

              return;
            }

            onStateChanged();
            renderSurvival();

            onMessage(
              result.completed
                ? "주포 정위치 완료"
                : "주포 정위치 회전 중",
            );
          },
        },
      ),
    );

    const modeGroup =
      document.createElement(
        "div",
      );

    modeGroup.className =
      "turret-mode-group";

    Object.values(
      TURRET_MODES,
    ).forEach((mode) => {
      modeGroup.append(
        createButton(
          TURRET_MODE_LABELS[
            mode
          ],
          {
            active:
              unit.turretControl
                .mode === mode,

            onClick: () => {
              const result =
                setTurretMode(
                  unit,
                  mode,
                );

              onStateChanged();
              renderSurvival();

              onMessage(
                result.warning ??
                  `${TURRET_MODE_LABELS[mode]} 선택`,
              );
            },
          },
        ),
      );
    });

    turretPanel.append(
      modeGroup,
    );

    container.append(
      turretPanel,
    );
  }

  function activateRecon() {
    const unit =
      getSelectedUnit();

    if (
      !unit ||
      unit.side !== "friendly"
    ) {
      return false;
    }

    setPersistentAction(
      unit,
      {
        type:
          UNIT_ACTIONS.RECON,

        label: "정찰",
      },
      getTurn(),
    );

    onStateChanged();

    onMessage(
      "주변 360도 정찰을 시작했습니다.",
    );

    return true;
  }

  return {
    render(category) {
      if (
        category ===
        "observation"
      ) {
        renderObservation();
        return;
      }

      if (
        category ===
        "movement"
      ) {
        renderMovement();
        return;
      }

      if (
        category ===
        "survival"
      ) {
        renderSurvival();
        return;
      }

      showMessage(
        "명령 종류를 선택하세요.",
      );
    },

    activateRecon,

    showMessage,

    refresh(category) {
      this.render(category);
    },
  };
}
