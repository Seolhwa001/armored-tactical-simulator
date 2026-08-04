// src/ui/commandPanel.js — 전체 교체

import { UNIT_ACTIONS } from "../engine/constants/actionConstants.js";

import {
  canAssignCrewObservation,
  designateHunterKillerTarget,
  setCommanderSightDirection,
  setCrewObservationDirection,
  setPersistentAction,
} from "../engine/actions.js";

import {
  CREW_ROLES,
  HUNTER_KILLER_STATES,
} from "../engine/runtime/runtimeConstants.js";

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
  [CREW_ROLES.COMMANDER]: "전차장",
  [CREW_ROLES.GUNNER]: "포수",
  [CREW_ROLES.DRIVER]: "조종수",
  [CREW_ROLES.LOADER]: "탄약수",
});

const HUNTER_KILLER_LABELS = Object.freeze({
  [HUNTER_KILLER_STATES.SEARCHING]: "탐색",
  [HUNTER_KILLER_STATES.TARGET_FOUND]: "표적 발견",
  [HUNTER_KILLER_STATES.DESIGNATING]: "표적지향",
  [HUNTER_KILLER_STATES.HANDOFF]: "표적 인계",
  [HUNTER_KILLER_STATES.TRACKING]: "포수 추적",
});

const TURRET_MODE_LABELS = Object.freeze({
  [TURRET_MODES.NORMAL]: "정상구동",
  [TURRET_MODES.EMERGENCY]: "비상구동",
  [TURRET_MODES.MANUAL]: "수동구동",
});

const LOADER_MODE_LABELS = Object.freeze({
  "open-hatch": "해치 개방 감시",
  periscope: "측면 잠망경 감시",
  loading: "장전 중 제한 감시",
});

function createButton(label, options = {}) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "command-option";
  button.textContent = label;
  button.disabled = options.disabled === true;

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

function createSection(title) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");

  section.className = "command-section";
  heading.className = "command-section-title";
  heading.textContent = title;

  section.append(heading);

  return section;
}

function createStatusRow(label, value) {
  const row = document.createElement("span");
  const strong = document.createElement("strong");

  row.append(`${label}: `);

  strong.textContent = value;

  row.append(strong);

  return row;
}

function createCommandButton(
  command,
  onSelect,
  options = {},
) {
  return createButton(command.label, {
    disabled: options.disabled,

    onClick: (event) => {
      onSelect(
        command,
        event.currentTarget,
      );
    },
  });
}

function getObserver(
  unit,
  crewRole,
) {
  return (
    unit.crewObservation
      ?.observers?.[crewRole] ??
    null
  );
}

function getObserverStateLabel(
  unit,
  crewRole,
) {
  const observer =
    getObserver(
      unit,
      crewRole,
    );

  if (!observer) {
    return "사용 불가";
  }

  if (
    observer.enabled === false ||
    observer.observing !== true
  ) {
    return "감시 중지";
  }

  if (
    crewRole ===
    CREW_ROLES.GUNNER
  ) {
    return "포탑 방향 자동 감시";
  }

  if (
    crewRole ===
    CREW_ROLES.DRIVER
  ) {
    return "차체 전방 자동 감시";
  }

  if (
    crewRole ===
    CREW_ROLES.LOADER
  ) {
    return (
      LOADER_MODE_LABELS[
        observer.observationMode
      ] ??
      "감시 중"
    );
  }

  return "육안 감시";
}

function getCommanderSightLabel(unit) {
  const sight =
    unit.crewObservation
      ?.commanderIndependentSight;

  if (!sight?.operational) {
    return "고장";
  }

  if (sight.active !== true) {
    return "미사용";
  }

  if (sight.tracking) {
    return sight.locked
      ? "표적 추적 완료"
      : "표적 추적 회전 중";
  }

  return sight.locked
    ? "독립 감시 정렬 완료"
    : "독립 감시 회전 중";
}

function createTurretStatusPanel(unit) {
  const panel = document.createElement("div");
  const status = getTurretStatus(unit);

  panel.className = "turret-status-panel";

  if (!status) {
    panel.textContent = "포탑 제어 기능 없음";

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
      TURRET_MODE_LABELS[status.mode] ??
        status.mode,
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
    const warning = document.createElement("p");

    warning.className = "turret-warning";
    warning.textContent = status.warning;

    panel.append(warning);
  }

  return panel;
}

function createObservationStatusPanel(unit) {
  const panel = document.createElement("div");
  const observation = unit.crewObservation;

  panel.className = "observation-status-panel";

  if (!observation) {
    panel.textContent = "승무원 감시 기능 없음";

    return panel;
  }

  const hunterKiller =
    observation.hunterKiller;

  panel.append(
    createStatusRow(
      "전차장",
      getObserverStateLabel(
        unit,
        CREW_ROLES.COMMANDER,
      ),
    ),
    createStatusRow(
      "포수",
      getObserverStateLabel(
        unit,
        CREW_ROLES.GUNNER,
      ),
    ),
    createStatusRow(
      "조종수",
      getObserverStateLabel(
        unit,
        CREW_ROLES.DRIVER,
      ),
    ),
    createStatusRow(
      "탄약수",
      getObserverStateLabel(
        unit,
        CREW_ROLES.LOADER,
      ),
    ),
    createStatusRow(
      "CPS",
      getCommanderSightLabel(unit),
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

function getVehicleSmokeStatus(unit) {
  const vehicleSmoke =
    unit.vehicleSmoke;

  if (!vehicleSmoke) {
    return {
      available: false,
      remainingUses: 0,
      maximumUses: 0,
      label: "자체연막 없음",
    };
  }

  const remainingUses =
    Math.max(
      0,
      vehicleSmoke.remainingUses ?? 0,
    );

  const maximumUses =
    Math.max(
      0,
      vehicleSmoke.maximumUses ?? 0,
    );

  return {
    available:
      maximumUses > 0 &&
      remainingUses > 0,

    remainingUses,
    maximumUses,

    label:
      `자체연막 전개 ` +
      `(${remainingUses}/${maximumUses})`,
  };
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
  onDeployVehicleSmoke,
}) {
  void getRuntimeScenario;

  function clear() {
    container.replaceChildren();
  }

  function getControllableUnit() {
    const unit = getSelectedUnit();

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
    const paragraph =
      document.createElement("p");

    clear();

    paragraph.textContent = message;

    container.append(paragraph);
  }

  function appendCommandList(
    section,
    commands,
  ) {
    commands.forEach((command) => {
      section.append(
        createCommandButton(
          command,
          onCommandSelected,
        ),
      );
    });
  }

  function renderHull() {
    const unit =
      getControllableUnit();

    clear();

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

    const maneuverSection =
      createSection("기동");

    const smallArmsSection =
      createSection("소화기");

    appendCommandList(
      movementSection,
      HULL_MOVEMENT_COMMANDS,
    );

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
                  unit.plannedPath.length === 0
                ),

              onClick: () => {
                onCancelMovement(unit);

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
        `${CREW_ROLE_LABELS[crewRole]} 구역 지정`,

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
            crewRole ===
              CREW_ROLES.LOADER
              ? "탄약수는 해치 개방·비장전 상태에서만 자유 감시구역을 지정할 수 있습니다."
              : "감시구역을 지정할 수 없습니다.",
          );

          return;
        }

        onStateChanged();

        onMessage(
          `${CREW_ROLE_LABELS[crewRole]} 감시구역을 지정했습니다.`,
        );
      },
    };
  }

  function createCommanderSightCommand() {
    return {
      id: "commander-sight",
      label: "CPS 구역 지정",
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
            "CPS 감시구역을 지정할 수 없습니다.",
          );

          return;
        }

        unit.command =
          "전차장 CPS 감시";

        onStateChanged();

        onMessage(
          "CPS가 지정 방향으로 회전을 시작했습니다.",
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
          "CPS와 포탑이 표적 방향으로 회전을 시작했습니다.",
        );
      },
    };
  }

  function createAutomaticObservationStatus(
    label,
    description,
  ) {
    const button =
      createButton(
        `${label}: ${description}`,
        {
          disabled: true,
        },
      );

    return button;
  }

  function renderObservationSection(unit) {
    const section =
      createSection("감시구역 할당");

    section.append(
      createObservationStatusPanel(unit),
    );

    const commanderAssignable =
      canAssignCrewObservation(
        unit,
        CREW_ROLES.COMMANDER,
      );

    const loaderAssignable =
      canAssignCrewObservation(
        unit,
        CREW_ROLES.LOADER,
      );

    section.append(
      createCommandButton(
        createCrewObservationCommand(
          CREW_ROLES.COMMANDER,
        ),
        onCommandSelected,
        {
          disabled:
            !commanderAssignable,
        },
      ),

      createCommanderSightCommand()
        ? createCommandButton(
            createCommanderSightCommand(),
            onCommandSelected,
            {
              disabled:
                unit.crewObservation
                  ?.commanderIndependentSight
                  ?.operational !== true,
            },
          )
        : null,

      createAutomaticObservationStatus(
        "포수",
        "포탑 방향 자동 종속",
      ),

      createAutomaticObservationStatus(
        "조종수",
        "차체 전방 자동 종속",
      ),

      createCommandButton(
        createCrewObservationCommand(
          CREW_ROLES.LOADER,
        ),
        onCommandSelected,
        {
          disabled:
            !loaderAssignable,
        },
      ),
    );

    section.append(
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

    if (!loaderAssignable) {
      const loaderNotice =
        document.createElement("p");

      loaderNotice.className =
        "turret-warning";

      loaderNotice.textContent =
        unit.fireControl?.loading
          ? "탄약수는 장전 중이므로 측면 잠망경을 통한 제한 감시만 수행합니다."
          : unit.hatchState !== "open"
            ? "탄약수는 해치가 닫혀 있어 측면 잠망경 방향으로 자동 감시합니다."
            : "탄약수 감시구역을 현재 지정할 수 없습니다.";

      section.append(
        loaderNotice,
      );
    }

    return section;
  }

  function renderTurretControlSection(unit) {
    const section =
      createSection("포·포탑 구동");

    section.append(
      createTurretStatusPanel(unit),
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
              onMessage(result.reason);

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
      document.createElement("div");

    modeGroup.className =
      "turret-mode-group";

    Object.values(
      TURRET_MODES,
    ).forEach((mode) => {
      modeGroup.append(
        createButton(
          TURRET_MODE_LABELS[mode],
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

  function renderVehicleSmokeSection(unit) {
    const section =
      createSection("자체연막");

    const status =
      getVehicleSmokeStatus(unit);

    section.append(
      createButton(
        status.label,
        {
          disabled:
            !status.available ||
            typeof onDeployVehicleSmoke !==
              "function",

          onClick: () => {
            if (
              typeof onDeployVehicleSmoke !==
              "function"
            ) {
              onMessage(
                "자체연막 기능이 연결되지 않았습니다.",
              );

              return;
            }

            const result =
              onDeployVehicleSmoke(unit);

            if (
              !result ||
              result.success === false
            ) {
              onMessage(
                result?.reason ??
                  "자체연막을 전개하지 못했습니다.",
              );

              renderTurret();

              return;
            }

            onStateChanged();

            onMessage(
              result.reason ??
                `자체연막 전개 완료. 남은 횟수 ` +
                  `${result.remainingUses}` +
                  `/${result.maximumUses}`,
            );

            renderTurret();
          },
        },
      ),
    );

    if (!unit.vehicleSmoke) {
      const unavailable =
        document.createElement("p");

      unavailable.className =
        "turret-warning";

      unavailable.textContent =
        "이 차량에는 자체연막 기능이 없습니다.";

      section.append(unavailable);
    } else if (
      status.remainingUses <= 0
    ) {
      const depleted =
        document.createElement("p");

      depleted.className =
        "turret-warning";

      depleted.textContent =
        "자체연막을 모두 사용했습니다.";

      section.append(depleted);
    }

    return section;
  }

  function renderTurret() {
    const unit =
      getControllableUnit();

    clear();

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

    container.append(
      renderObservationSection(unit),
      renderTurretControlSection(unit),
      renderVehicleSmokeSection(unit),
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
        type: UNIT_ACTIONS.RECON,
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
