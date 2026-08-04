// src/ui/commandPanel.js — 전체 교체, 1~478행

import {
  UNIT_ACTIONS,
  designateHunterKillerTarget,
  setCommanderSightDirection,
  setCrewObservationDirection,
  setPersistentAction,
} from "../engine/actions.js";

import {
  CREW_ROLES,
  HUNTER_KILLER_STATES,
} from "../engine/scenarioRuntime.js";

import {
  commandMainGunStow,
  getTurretStatus,
  setTurretMode,
  TURRET_MODES,
} from "../engine/turretControl.js";

const HULL_MOVEMENT_COMMANDS = [
  {
    id: "normal-move",
    label: "이동",
    needsTarget: true,
  },
];

const HULL_MANEUVER_COMMANDS = [
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
    id: "cancel-movement",
    label: "이동취소",
    needsTarget: false,
  },
];

const CREW_ROLE_LABELS = Object.freeze({
  [CREW_ROLES.COMMANDER]:
    "전차장",

  [CREW_ROLES.GUNNER]:
    "포수",

  [CREW_ROLES.DRIVER]:
    "조종수",

  [CREW_ROLES.LOADER]:
    "탄약수",
});

const HUNTER_KILLER_LABELS = Object.freeze({
  [HUNTER_KILLER_STATES.SEARCHING]:
    "탐색",

  [HUNTER_KILLER_STATES.TARGET_FOUND]:
    "표적 발견",

  [HUNTER_KILLER_STATES.DESIGNATING]:
    "표적지향",

  [HUNTER_KILLER_STATES.HANDOFF]:
    "표적 인계",

  [HUNTER_KILLER_STATES.TRACKING]:
    "포수 추적",
});

const TURRET_MODE_LABELS = Object.freeze({
  [TURRET_MODES.NORMAL]:
    "정상구동",

  [TURRET_MODES.EMERGENCY]:
    "비상구동",

  [TURRET_MODES.MANUAL]:
    "수동구동",
});

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

  button.textContent = label;

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

function createSection(
  title,
) {
  const section =
    document.createElement(
      "section",
    );

  section.className =
    "command-section";

  const heading =
    document.createElement(
      "h3",
    );

  heading.className =
    "command-section-title";

  heading.textContent = title;

  section.append(heading);

  return section;
}

function createStatusRow(
  label,
  value,
) {
  const row =
    document.createElement(
      "span",
    );

  const strong =
    document.createElement(
      "strong",
    );

  row.append(`${label}: `);

  strong.textContent = value;

  row.append(strong);

  return row;
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
      ? "작동"
      : status.stabilizerOperational
        ? "미사용"
        : "고장";

  const stowText =
    status.lockedToHull
      ? status.aligned
        ? "완료"
        : "회전 중"
      : "해제";

  const couplingText =
    status.hullCoupled
      ? "차체 종속"
      : "독립";

  panel.append(
    createStatusRow(
      "구동",
      TURRET_MODE_LABELS[
        status.mode
      ] ?? status.mode,
    ),

    createStatusRow(
      "안정화",
      stabilizerText,
    ),

    createStatusRow(
      "포탑 상태",
      couplingText,
    ),

    createStatusRow(
      "주포 정위치",
      stowText,
    ),
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

function createObservationStatusPanel(
  unit,
) {
  const panel =
    document.createElement(
      "div",
    );

  panel.className =
    "observation-status-panel";

  const observation =
    unit.crewObservation;

  if (!observation) {
    panel.textContent =
      "승무원 감시 기능 없음";

    return panel;
  }

  const activeRole =
    observation.activeCrewRole;

  const hunterKiller =
    observation.hunterKiller;

  const commanderSight =
    observation
      .commanderIndependentSight;

  panel.append(
    createStatusRow(
      "현재 감시",
      CREW_ROLE_LABELS[
        activeRole
      ] ?? "-",
    ),

    createStatusRow(
      "CPS",
      commanderSight?.operational
        ? commanderSight.tracking
          ? "표적 추적"
          : "독립 감시"
        : "고장",
    ),

    createStatusRow(
      "헌터킬러",
      HUNTER_KILLER_LABELS[
        hunterKiller?.state
      ] ?? "사용 불가",
    ),
  );

  return panel;
}

export function createCommandPanel({
  container,
  getSelectedUnit,
  getRuntimeScenario,
  getTurn,
  onCommandSelected,
  onStateChanged,
  onMessage,
  onCancelMovement,
}) {
  function clear() {
    container.replaceChildren();
  }

  function getControllableUnit() {
    const unit =
      getSelectedUnit();

    if (
      !unit ||
      unit.side !== "friendly" ||
      unit.role !== "player"
    ) {
      return null;
    }

    return unit;
  }

  function showMessage(message) {
    clear();

    const paragraph =
      document.createElement(
        "p",
      );

    paragraph.textContent =
      message;

    container.append(paragraph);
  }

  function appendCommandList(
    section,
    commands,
  ) {
    commands.forEach(
      (command) => {
        section.append(
          createCommandButton(
            command,
            onCommandSelected,
          ),
        );
      },
    );
  }

  function renderHull() {
    clear();

    const unit =
      getControllableUnit();

    if (!unit) {
      showMessage(
        "조작 가능한 자차가 없습니다.",
      );

      return;
    }

    if (unit.destroyed) {
      showMessage(
        "자차가 격파되어 차체 명령을 사용할 수 없습니다.",
      );

      return;
    }

    const movementSection =
      createSection("이동");

    appendCommandList(
      movementSection,
      HULL_MOVEMENT_COMMANDS,
    );

    const maneuverSection =
      createSection("기동");

    HULL_MANEUVER_COMMANDS.forEach(
      (command) => {
        if (
          command.id !==
          "cancel-movement"
        ) {
          maneuverSection.append(
            createCommandButton(
              command,
              onCommandSelected,
            ),
          );

          return;
        }

        maneuverSection.append(
          createButton(
            command.label,
            {
              disabled:
                !unit.destination &&
                (
                  !Array.isArray(
                    unit.plannedPath,
                  ) ||
                  unit.plannedPath
                    .length === 0
                ),

              onClick: () => {
                onCancelMovement(
                  unit,
                );

                onStateChanged();

                onMessage(
                  "자차 이동 명령을 취소했습니다.",
                );

                renderHull();
              },
            },
          ),
        );
      },
    );

    const smallArmsSection =
      createSection("소화기");

    smallArmsSection.append(
      createButton(
        "추후 구현",
        {
          disabled: true,
        },
      ),
    );

    container.append(
      movementSection,
      maneuverSection,
      smallArmsSection,
    );
  }

  function createCrewObservationCommand(
    crewRole,
  ) {
    return {
      id: "crew-observation",

      label:
        `${CREW_ROLE_LABELS[crewRole]} 감시`,

      needsTarget: true,
      crewRole,

      onTarget({
        unit,
        direction,
        turn,
      }) {
        const success =
          setCrewObservationDirection(
            unit,
            crewRole,
            direction,
            turn,
          );

        if (!success) {
          onMessage(
            "감시 방향을 지정할 수 없습니다.",
          );

          return;
        }

        onStateChanged();

        onMessage(
          `${CREW_ROLE_LABELS[crewRole]} 감시 방향을 지정했습니다.`,
        );
      },
    };
  }

  function createCommanderSightCommand() {
    return {
      id: "commander-sight",
      label: "전차장 CPS 독립 감시",
      needsTarget: true,

      onTarget({
        unit,
        direction,
      }) {
        const success =
          setCommanderSightDirection(
            unit,
            direction,
          );

        if (!success) {
          onMessage(
            "CPS 감시 방향을 지정할 수 없습니다.",
          );

          return;
        }

        unit.command =
          "전차장 CPS 감시";

        onStateChanged();

        onMessage(
          "전차장 CPS 독립 감시 방향을 지정했습니다.",
        );
      },
    };
  }

  function createHunterKillerCommand() {
    return {
      id: "hunter-killer",
      label: "헌터킬러 표적지향",
      needsTarget: true,

      onTarget({
        unit,
        targetUnit,
      }) {
        const success =
          designateHunterKillerTarget(
            unit,
            targetUnit,
            HUNTER_KILLER_STATES,
          );

        if (!success) {
          onMessage(
            "탐지되지 않은 표적은 지정할 수 없습니다.",
          );

          return;
        }

        unit.command =
          "헌터킬러 표적지향";

        onStateChanged();

        onMessage(
          "CPS 표적지향을 시작했습니다.",
        );
      },
    };
  }

  function renderObservationSection(
    unit,
  ) {
    const section =
      createSection(
        "감시 및 정찰",
      );

    section.append(
      createObservationStatusPanel(
        unit,
      ),
    );

    Object.values(
      CREW_ROLES,
    ).forEach((crewRole) => {
      section.append(
        createCommandButton(
          createCrewObservationCommand(
            crewRole,
          ),
          onCommandSelected,
        ),
      );
    });

    section.append(
      createCommandButton(
        createCommanderSightCommand(),
        onCommandSelected,
      ),

      createCommandButton(
        createHunterKillerCommand(),
        onCommandSelected,
      ),

      createCommandButton(
        {
          id: "recon",
          label: "360도 정찰",
          needsTarget: false,
        },
        onCommandSelected,
      ),

      createCommandButton(
        {
          id: "recon-by-fire",
          label: "화력수색",
          needsTarget: true,
        },
        onCommandSelected,
      ),
    );

    return section;
  }

  function renderTurretControlSection(
    unit,
  ) {
    const section =
      createSection(
        "포·포탑 구동",
      );

    section.append(
      createTurretStatusPanel(
        unit,
      ),
    );

    section.append(
      createButton(
        "주포 정위치",
        {
          active:
            unit.turretControl
              ?.lockedToHull === true,

          onClick: () => {
            const result =
              commandMainGunStow(
                unit,
                getTurn(),
              );

            if (!result.success) {
              onMessage(
                result.reason,
              );

              return;
            }

            onStateChanged();
            renderTurret();

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
                ?.mode === mode,

            onClick: () => {
              const result =
                setTurretMode(
                  unit,
                  mode,
                );

              if (!result.success) {
                onMessage(
                  result.reason,
                );

                return;
              }

              onStateChanged();
              renderTurret();

              onMessage(
                result.warning ??
                  `${TURRET_MODE_LABELS[mode]} 선택`,
              );
            },
          },
        ),
      );
    });

    section.append(modeGroup);

    return section;
  }

  function renderTurret() {
    clear();

    const unit =
      getControllableUnit();

    if (!unit) {
      showMessage(
        "조작 가능한 자차가 없습니다.",
      );

      return;
    }

    if (unit.destroyed) {
      showMessage(
        "자차가 격파되어 포탑 명령을 사용할 수 없습니다.",
      );

      return;
    }

    const observationSection =
      renderObservationSection(
        unit,
      );

    const fireSection =
      createSection("사격");

    fireSection.append(
      createButton(
        "사격 절차 열기",
        {
          onClick: () => {
            onCommandSelected(
              {
                id: "open-fire-panel",
                label: "사격",
                needsTarget: false,

                execute() {
                  onMessage(
                    "사격 명령 분야를 선택하세요.",
                  );
                },
              },
              null,
            );
          },
        },
      ),
    );

    const turretControlSection =
      renderTurretControlSection(
        unit,
      );

    const smokeSection =
      createSection("자체연막");

    smokeSection.append(
      createCommandButton(
        {
          id: "vehicle-smoke",
          label: "자체연막 전개",
          needsTarget: false,

          execute({
            unit:
              executingUnit,
          }) {
            executingUnit.command =
              "자체연막";

            onStateChanged();

            onMessage(
              "자체연막 명령을 설정했습니다.",
            );
          },
        },
        onCommandSelected,
      ),
    );

    container.append(
      observationSection,
      fireSection,
      turretControlSection,
      smokeSection,
    );
  }

  function activateRecon() {
    const unit =
      getControllableUnit();

    if (
      !unit ||
      unit.destroyed
    ) {
      return false;
    }

    setPersistentAction(
      unit,
      {
        type:
          UNIT_ACTIONS.RECON,

        label: "360도 정찰",
      },
      getTurn(),
    );

    onStateChanged();

    onMessage(
      "승무원 360도 정찰을 시작했습니다.",
    );

    return true;
  }

  return {
    render(category) {
      if (
        category === "hull" ||
        category === "movement"
      ) {
        renderHull();
        return;
      }

      if (
        category === "turret" ||
        category === "observation" ||
        category === "survival"
      ) {
        renderTurret();
        return;
      }

      showMessage(
        "차체 또는 포탑 명령 분야를 선택하세요.",
      );
    },

    activateRecon,

    showMessage,

    refresh(category) {
      this.render(category);
    },
  };
}
