// ============================================================
// ATS PROJECT
// File      : src/ui/firePanel.js
// Sprint    : 3.9.2
// Revision  : R10
// Build     : 2026-08-05
// Type      : PARTIAL PATCH
// Purpose   : Fire UI with fresh runtime unit lookup for every command
// ============================================================

import {
  AMMUNITION_TYPES,
  FIRE_PROCEDURE_STATES,
  FIRE_STATES,
  ceaseFire,
  enableAdjustedFire,
  fireSingleShot,
  issueFireCommand,
  selectAmmunition,
  setFireTarget,
} from "../engine/fireControl.js";

import {
  DIRECTED_ACTION_STATES,
} from "../engine/actions.js";


import {
  createProcedureViewModel,
} from "../engine/procedureViewModel.js";

import {
  UNIT_ACTIONS,
} from "../engine/constants/actionConstants.js";

import {
  HUNTER_KILLER_STATES,
} from "../engine/runtime/runtimeConstants.js";

import {
  getTurretStatus,
} from "../engine/turretControl.js";

const AMMUNITION_LABELS = Object.freeze({
  [AMMUNITION_TYPES.APFSDS]: "날탄",
  [AMMUNITION_TYPES.HEAT]: "대탄",
  [AMMUNITION_TYPES.CANISTER]: "벌집탄",
  [AMMUNITION_TYPES.SMOKE]: "연막탄",
});

const PROCEDURE_LABELS = Object.freeze({
  [FIRE_PROCEDURE_STATES.STOPPED]: "사격 중지",
  [FIRE_PROCEDURE_STATES.TARGET_DESIGNATED]: "표적 지정",
  [FIRE_PROCEDURE_STATES.FIRE_COMMAND]: "사격명령",
  [FIRE_PROCEDURE_STATES.LOADING]: "장전 중",
  [FIRE_PROCEDURE_STATES.TRAVERSING]: "포탑 선회",
  [FIRE_PROCEDURE_STATES.AIMING]: "조준 중",
  [FIRE_PROCEDURE_STATES.READY_TO_FIRE]: "발사 준비",
  [FIRE_PROCEDURE_STATES.FIRED]: "발사 완료",
  [FIRE_PROCEDURE_STATES.RELOADING]: "재장전 중",
  [FIRE_PROCEDURE_STATES.ADJUSTING]: "쏴-수정",
});

const HUNTER_KILLER_LABELS = Object.freeze({
  [HUNTER_KILLER_STATES.SEARCHING]: "탐색",
  [HUNTER_KILLER_STATES.TARGET_FOUND]: "표적 발견",
  [HUNTER_KILLER_STATES.DESIGNATING]: "표적지향",
  [HUNTER_KILLER_STATES.HANDOFF]: "표적 인계",
  [HUNTER_KILLER_STATES.TRACKING]: "포수 추적",
});

const TURRET_MODE_LABELS = Object.freeze({
  normal: "정상구동",
  emergency: "비상구동",
  manual: "수동구동",
});

function getAmmunitionLabel(ammunition) {
  if (!ammunition) {
    return "없음";
  }

  return (
    AMMUNITION_LABELS[
      ammunition
    ] ??
    ammunition
  );
}

function createButton(
  label,
  options = {},
) {
  const button =
    document.createElement("button");

  button.type = "button";
  button.className = "command-option";
  button.textContent = label;
  button.disabled =
    options.disabled === true;

  button.classList.toggle(
    "is-selected",
    options.active === true,
  );

  button.classList.toggle(
    "is-current-step",
    options.current === true,
  );

  if (
    typeof options.onClick ===
    "function"
  ) {
    button.addEventListener(
      "click",
      options.onClick,
    );
  }

  return button;
}

function createStatusRow(label, value) {
  const row =
    document.createElement("div");

  const labelElement =
    document.createElement("span");

  const valueElement =
    document.createElement("strong");

  row.className = "status-field";
  labelElement.className =
    "status-field__label";
  valueElement.className =
    "status-field__value";

  labelElement.textContent = label;
  valueElement.textContent = value;

  row.append(
    labelElement,
    valueElement,
  );

  return row;
}

function getRuntimeUnitById(
  runtimeScenario,
  unitId,
) {
  if (
    !unitId ||
    !Array.isArray(
      runtimeScenario?.units,
    )
  ) {
    return null;
  }

  return (
    runtimeScenario.units.find(
      (unit) =>
        unit.id === unitId,
    ) ?? null
  );
}

function getUnitDisplayName(unit) {
  if (!unit) {
    return "없음";
  }

  return (
    unit.name ??
    unit.id ??
    "없음"
  );
}

function getHunterKillerTargetId(
  hunterKiller,
) {
  return (
    hunterKiller
      ?.handedOffTargetUnitId ??
    hunterKiller
      ?.designatedTargetUnitId ??
    hunterKiller
      ?.detectedTargetUnitId ??
    null
  );
}

function getHunterKillerHandoffLabel(
  hunterKiller,
) {
  if (!hunterKiller?.enabled) {
    return "사용 불가";
  }

  if (
    hunterKiller.state ===
      HUNTER_KILLER_STATES.DESIGNATING
  ) {
    return "CPS·포탑 정렬 중";
  }

  if (
    hunterKiller.state ===
      HUNTER_KILLER_STATES.HANDOFF
  ) {
    return "포수 인계 중";
  }

  if (
    hunterKiller.state ===
      HUNTER_KILLER_STATES.TRACKING &&
    hunterKiller.handedOffTargetUnitId
  ) {
    return "포수 인계 완료";
  }

  return "미인계";
}

function createStatusPanel(
  unit,
  runtimeScenario,
) {
  const panel =
    document.createElement("div");

  const turretStatus =
    getTurretStatus(unit);

  const fireControl =
    unit.fireControl;

  const hunterKiller =
    unit.crewObservation
      ?.hunterKiller;

  const hunterKillerTargetId =
    getHunterKillerTargetId(
      hunterKiller,
    );

  const hunterKillerTarget =
    getRuntimeUnitById(
      runtimeScenario,
      hunterKillerTargetId,
    );

  panel.className =
    "turret-status-panel";

  const stabilizer =
    turretStatus
      ?.stabilizerAvailable
      ? "사용"
      : turretStatus
          ?.stabilizerOperational
        ? "미사용"
        : "고장";

  const alignment =
    turretStatus?.aligned
      ? "정렬 완료"
      : "선회 중";

  const procedure =
    PROCEDURE_LABELS[
      fireControl.procedureState
    ] ??
    fireControl.procedureState;


  const procedureView =
    createProcedureViewModel(
      fireControl,
    );

  const procedureCoreLabel =
    procedureView.coreLabel;

  const procedureCoreProgress =
    `${procedureView.coreProgressPercent}%`;

  const chamberStatus =
    fireControl.loaded
      ? getAmmunitionLabel(
          fireControl
            .loadedAmmunition,
        )
      : "미장전";

  const loadingStatus =
    fireControl.loading
      ? getAmmunitionLabel(
          fireControl
            .loadingAmmunition,
        )
      : "없음";

  const selectedAmmunition =
    getAmmunitionLabel(
      fireControl.ammunition,
    );

  const directedStatus =
    fireControl.directedActionStatus ??
    null;

  panel.append(
    createStatusRow(
      "절차",
      procedure,
    ),
    createStatusRow(
      "Core 단계",
      procedureCoreLabel,
    ),
    createStatusRow(
      "Core 진행도",
      procedureCoreProgress,
    ),
    createStatusRow(
      "현재 장전탄",
      chamberStatus,
    ),
    createStatusRow(
      "장전 중",
      loadingStatus,
    ),
    createStatusRow(
      "다음 장전탄",
      selectedAmmunition,
    ),
    createStatusRow(
      "포탑",
      alignment,
    ),
    createStatusRow(
      "구동",
      TURRET_MODE_LABELS[
        turretStatus?.mode
      ] ?? "-",
    ),
    createStatusRow(
      "안정화",
      stabilizer,
    ),
    createStatusRow(
      "헌터킬러",
      HUNTER_KILLER_LABELS[
        hunterKiller?.state
      ] ?? "사용 불가",
    ),
    createStatusRow(
      "HK 지정 표적",
      getUnitDisplayName(
        hunterKillerTarget,
      ),
    ),
    createStatusRow(
      "포수 인계",
      getHunterKillerHandoffLabel(
        hunterKiller,
      ),
    ),
  );

  if (directedStatus) {
    panel.append(
      createStatusRow(
        "실행 수단",
        directedStatus.executionMethod ??
          "없음",
      ),
      createStatusRow(
        "요청 자원",
        getAmmunitionLabel(
          directedStatus
            .requestedResourceType,
        ),
      ),
      createStatusRow(
        "사용 가능 자원",
        getAmmunitionLabel(
          directedStatus
            .availableResourceType,
        ),
      ),
      createStatusRow(
        "자원 사용 가능",
        directedStatus.resourceAvailable
          ? "가능"
          : "불가",
      ),
      createStatusRow(
        "장전 상태",
        directedStatus.loadedState
          ? "완료"
          : "미장전",
      ),
      createStatusRow(
        "실패 이유",
        directedStatus.failureReason ??
          "없음",
      ),
    );
  }

  if (turretStatus?.warning) {
    const warning =
      document.createElement("p");

    warning.className =
      "turret-warning";

    warning.textContent =
      turretStatus.warning;

    panel.append(warning);
  }

  return panel;
}

function createProcedureProgress(
  currentState,
) {
  const progress =
    document.createElement("div");

  progress.className =
    "fire-procedure-progress";

  const stages = [
    FIRE_PROCEDURE_STATES.TARGET_DESIGNATED,
    FIRE_PROCEDURE_STATES.FIRE_COMMAND,
    FIRE_PROCEDURE_STATES.LOADING,
    FIRE_PROCEDURE_STATES.TRAVERSING,
    FIRE_PROCEDURE_STATES.AIMING,
    FIRE_PROCEDURE_STATES.READY_TO_FIRE,
    FIRE_PROCEDURE_STATES.FIRED,
    FIRE_PROCEDURE_STATES.RELOADING,
  ];

  const currentIndex =
    stages.indexOf(
      currentState,
    );

  stages.forEach(
    (stage, index) => {
      const item =
        document.createElement("span");

      item.className =
        "fire-procedure-step";

      item.textContent =
        PROCEDURE_LABELS[
          stage
        ];

      item.classList.toggle(
        "is-current",
        stage === currentState,
      );

      item.classList.toggle(
        "is-complete",
        currentIndex >= 0 &&
          index < currentIndex,
      );

      progress.append(item);
    },
  );

  return progress;
}

function formatShotResult(result) {
  if (!result) {
    return "발사 완료";
  }

  const ammunition =
    result.ammunition
      ? (
          `${getAmmunitionLabel(
            result.ammunition,
          )} / `
        )
      : "";

  if (result.smokeCreated) {
    return (
      `${ammunition}연막 형성`
    );
  }

  if (!result.hit) {
    return (
      `${ammunition}발사 / ` +
      `${result.reason ?? "빗나감"}`
    );
  }

  if (result.destroyed) {
    return (
      `${ammunition}명중 / ` +
      `피해 ${result.damage} / 격파`
    );
  }

  const remainingHealth =
    result.remainingHealth !==
      null &&
    result.remainingHealth !==
      undefined
      ? (
          ` / 잔여 체력 ` +
          `${result.remainingHealth}`
        )
      : "";

  return (
    `${ammunition}명중 / ` +
    `피해 ${result.damage}` +
    remainingHealth
  );
}

function getLoadingMessage(result) {
  if (result.usedLoadedRound) {
    return (
      "사격명령 하달. 포탑 선회와 조준을 시작합니다."
    );
  }

  if (
    result.loadingInProgress &&
    !result.automaticLoading
  ) {
    return (
      "사격명령 하달. " +
      `${getAmmunitionLabel(
        result.ammunition,
      )} 장전을 계속합니다.`
    );
  }

  if (result.automaticLoading) {
    return (
      "사격명령 하달. " +
      `${getAmmunitionLabel(
        result.ammunition,
      )} 자동 장전을 시작합니다.`
    );
  }

  return "사격명령을 하달했습니다.";
}

export function createFirePanel({
  container,
  getSelectedUnit,
  getRuntimeScenario,
  getTurn,
  isUnitMoving,
  onBeginTargetSelection,
  onBeginReconByFireSelection,
  onFireEffect,
  onRemoveFireEffects,
  onStateChanged,
  onVisibilityChanged,
  onMessage,
}) {
  // UI-only transient command input.
  // This object is not Runtime Fire Procedure state.
  const commandDraft = {
    ammunition:
      AMMUNITION_TYPES.APFSDS,

    targetHex: null,
    targetUnitId: null,
  };

  function getCurrentUnit() {
    const unit =
      getSelectedUnit();

    if (
      !unit ||
      unit.destroyed ||
      unit.side !== "friendly" ||
      !unit.fireControl
    ) {
      return null;
    }

    return unit;
  }

  function requireCurrentUnit() {
    const unit =
      getCurrentUnit();

    if (!unit) {
      onMessage(
        "현재 전투의 자차를 찾을 수 없습니다.",
      );

      render();
    }

    return unit;
  }

  function synchronizeProcedure(unit) {
    const fireControl =
      unit.fireControl;

    commandDraft.ammunition =
      fireControl?.ammunition ??
      commandDraft.ammunition;

    commandDraft.targetHex =
      fireControl?.targetHex
        ? {
            ...fireControl.targetHex,
          }
        : null;

    commandDraft.targetUnitId =
      fireControl?.targetUnitId ??
      null;
  }

  function reset() {
    const unit =
      getSelectedUnit();

    commandDraft.ammunition =
      unit?.fireControl
        ?.ammunition ??
      AMMUNITION_TYPES.APFSDS;

    commandDraft.targetHex =
      null;

    commandDraft.targetUnitId =
      null;
  }

  function setTarget(
    targetHex,
    targetUnitId = null,
  ) {
    const unit =
      getSelectedUnit();

    if (
      !unit ||
      unit.destroyed ||
      !unit.fireControl
    ) {
      return false;
    }

    const success =
      setFireTarget(
        unit,
        {
          column:
            targetHex.column,

          row:
            targetHex.row,

          unitId:
            targetUnitId,
        },
        null,
        getTurn(),
      );

    if (!success) {
      return false;
    }

    synchronizeProcedure(
      unit,
    );

    onStateChanged();

    onMessage(
      `표적 지정: ${targetHex.column}, ${targetHex.row}`,
    );

    render();

    return true;
  }

  function handleFireResult(
    unit,
    result,
  ) {
    const targetHex =
      unit.fireControl.targetHex;

    const firedAmmunition =
      result.ammunition ??
      result.shotResult
        ?.ammunition ??
      null;

    if (
      targetHex &&
      firedAmmunition
    ) {
      onFireEffect(
        unit,
        targetHex,
        firedAmmunition,
      );
    }

    const smokeCreated =
      result.shotResult
        ?.smokeCreated === true;

    if (
      smokeCreated &&
      typeof onVisibilityChanged ===
        "function"
    ) {
      onVisibilityChanged();
    } else {
      onStateChanged();
    }

    const resultMessage =
      formatShotResult(
        result.shotResult,
      );

    if (result.reloadStarted) {
      onMessage(
        `${resultMessage} / ` +
        `${getAmmunitionLabel(
          result.loadingAmmunition,
        )} 재장전 중`,
      );
    } else {
      onMessage(
        resultMessage,
      );
    }

    render();
  }

  function renderUnavailable(
    message,
  ) {
    container.replaceChildren();

    const paragraph =
      document.createElement("p");

    paragraph.textContent =
      message;

    container.append(
      paragraph,
    );
  }

  function getReconByFireLabel(unit) {
    if (
      unit.action?.type !==
      UNIT_ACTIONS.RECON_BY_FIRE
    ) {
      return "화력수색";
    }

    const state =
      unit.action.internalState;

    if (
      state ===
      DIRECTED_ACTION_STATES.ALIGNING
    ) {
      return "화력수색 · 방향 정렬 중";
    }

    if (
      state ===
      DIRECTED_ACTION_STATES.READY
    ) {
      return "화력수색 · 실행 준비";
    }

    if (
      state ===
      DIRECTED_ACTION_STATES.EXECUTING
    ) {
      return "화력수색 · 실행 중";
    }

    return "화력수색 · 목표 지정";
  }

  function render() {
    const unit =
      getSelectedUnit();

    if (
      !unit ||
      unit.side !== "friendly" ||
      !unit.fireControl
    ) {
      renderUnavailable(
        "자차는 사격 절차를 사용할 수 없습니다.",
      );

      return;
    }

    if (unit.destroyed) {
      renderUnavailable(
        "격파된 전차는 사격할 수 없습니다.",
      );

      return;
    }

    synchronizeProcedure(
      unit,
    );

    const fireControl =
      unit.fireControl;

    const procedureState =
      fireControl.procedureState;

    const canIssueFireCommand =
      Boolean(
        fireControl.targetHex,
      ) &&
      (
        procedureState ===
          FIRE_PROCEDURE_STATES
            .TARGET_DESIGNATED ||
        fireControl.loading
      );

    container.replaceChildren();

    const wrapper =
      document.createElement("div");

    wrapper.className =
      "fire-procedure";

    wrapper.append(
      createStatusPanel(
        unit,
        getRuntimeScenario?.() ??
          null,
      ),
      createProcedureProgress(
        procedureState,
      ),
    );

    const ammunitionGroup =
      document.createElement("div");

    ammunitionGroup.className =
      "fire-ammunition-group";

    Object.entries(
      AMMUNITION_LABELS,
    ).forEach(
      ([
        ammunition,
        label,
      ]) => {
        ammunitionGroup.append(
          createButton(
            label,
            {
              active:
                fireControl
                  .ammunition ===
                ammunition,

              onClick: () => {
                const currentUnit =
                  requireCurrentUnit();

                if (!currentUnit) {
                  return;
                }

                const currentFireControl =
                  currentUnit.fireControl;

                const success =
                  selectAmmunition(
                    currentUnit,
                    ammunition,
                  );

                if (!success) {
                  onMessage(
                    "탄종을 선택할 수 없습니다.",
                  );

                  return;
                }

                synchronizeProcedure(
                  currentUnit,
                );

                onStateChanged();

                if (
                  currentFireControl.loading
                ) {
                  onMessage(
                    `다음 장전탄을 ${label}(으)로 변경했습니다. ` +
                    `현재 장전 중인 ${getAmmunitionLabel(
                      currentFireControl
                        .loadingAmmunition,
                    )}은 유지됩니다.`,
                  );
                } else if (
                  currentFireControl.loaded
                ) {
                  onMessage(
                    `다음 장전탄을 ${label}(으)로 변경했습니다. ` +
                    `현재 장전된 ${getAmmunitionLabel(
                      currentFireControl
                        .loadedAmmunition,
                    )}은 유지됩니다.`,
                  );
                } else {
                  onMessage(
                    `선택 탄종: ${label}`,
                  );
                }

                render();
              },
            },
          ),
        );
      },
    );

    wrapper.append(
      ammunitionGroup,
    );

    const targetStatus =
      document.createElement("div");

    targetStatus.className =
      "fire-target-status";

    targetStatus.textContent =
      commandDraft.targetHex
        ? (
            `목표: ${commandDraft.targetHex.column}, ` +
            `${commandDraft.targetHex.row}`
          )
        : "목표: 미지정";

    wrapper.append(
      targetStatus,
    );

    wrapper.append(
      createButton(
        "표적 지정",
        {
          current:
            procedureState ===
            FIRE_PROCEDURE_STATES
              .TARGET_DESIGNATED,

          disabled:
            fireControl.state ===
            FIRE_STATES.ADJUST,

          onClick: () => {
            onBeginTargetSelection();

            onMessage(
              "지도에서 사격 목표 헥스를 선택하세요.",
            );
          },
        },
      ),
    );

    wrapper.append(
      createButton(
        getReconByFireLabel(unit),
        {
          active:
            unit.action?.type ===
            UNIT_ACTIONS.RECON_BY_FIRE,

          onClick: () => {
            onBeginReconByFireSelection?.();

            onMessage(
              "지도에서 화력수색 목표 헥스를 선택하세요.",
            );
          },
        },
      ),
    );

    wrapper.append(
      createButton(
        "사격명령",
        {
          current:
            procedureState ===
            FIRE_PROCEDURE_STATES
              .FIRE_COMMAND,

          disabled:
            !canIssueFireCommand,

          onClick: () => {
            const currentUnit =
              requireCurrentUnit();

            if (!currentUnit) {
              return;
            }

            const result =
              issueFireCommand(
                currentUnit,
                getTurn(),
              );

            if (!result.success) {
              onMessage(
                result.reason,
              );

              return;
            }

            onStateChanged();

            onMessage(
              getLoadingMessage(
                result,
              ),
            );

            render();
          },
        },
      ),
    );

    wrapper.append(
      createButton(
        fireControl.loading
          ? (
              `장전 중: ${getAmmunitionLabel(
                fireControl
                  .loadingAmmunition,
              )}`
            )
          : fireControl.loaded
            ? (
                `장전 완료: ${getAmmunitionLabel(
                  fireControl
                    .loadedAmmunition,
                )}`
              )
            : "자동 장전 대기",
        {
          current:
            procedureState ===
              FIRE_PROCEDURE_STATES
                .LOADING ||
            procedureState ===
              FIRE_PROCEDURE_STATES
                .RELOADING,

          disabled: true,
        },
      ),
    );

    wrapper.append(
      createButton(
        "포탑 선회",
        {
          current:
            procedureState ===
            FIRE_PROCEDURE_STATES
              .TRAVERSING,

          disabled: true,
        },
      ),
      createButton(
        "조준",
        {
          current:
            procedureState ===
            FIRE_PROCEDURE_STATES
              .AIMING,

          disabled: true,
        },
      ),
      createButton(
        "발사 준비",
        {
          current:
            procedureState ===
            FIRE_PROCEDURE_STATES
              .READY_TO_FIRE,

          disabled: true,
        },
      ),
    );

    wrapper.append(
      createButton(
        "쏴",
        {
          disabled:
            procedureState !==
            FIRE_PROCEDURE_STATES
              .READY_TO_FIRE,

          onClick: () => {
            const runtimeScenario =
              getRuntimeScenario();

            const currentUnit =
              requireCurrentUnit();

            if (
              !runtimeScenario ||
              !currentUnit
            ) {
              return;
            }

            const result =
              fireSingleShot(
                runtimeScenario,
                currentUnit,
                getTurn(),
                {
                  moving:
                    isUnitMoving(
                      currentUnit,
                    ),
                },
              );

            if (!result.success) {
              onMessage(
                result.reason,
              );

              return;
            }

            handleFireResult(
              currentUnit,
              result,
            );
          },
        },
      ),
    );

    wrapper.append(
      createButton(
        "쏴-수정",
        {
          active:
            fireControl.state ===
            FIRE_STATES.ADJUST,

          disabled:
            procedureState !==
            FIRE_PROCEDURE_STATES
              .READY_TO_FIRE,

          onClick: () => {
            const runtimeScenario =
              getRuntimeScenario();

            const currentUnit =
              requireCurrentUnit();

            if (
              !runtimeScenario ||
              !currentUnit
            ) {
              return;
            }

            const result =
              enableAdjustedFire(
                runtimeScenario,
                currentUnit,
                getTurn(),
                {
                  moving:
                    isUnitMoving(
                      currentUnit,
                    ),
                },
              );

            if (!result.success) {
              onMessage(
                result.reason,
              );

              return;
            }

            handleFireResult(
              currentUnit,
              result,
            );
          },
        },
      ),
    );

    wrapper.append(
      createButton(
        "사격그만",
        {
          active:
            fireControl.state ===
            FIRE_STATES.STOPPED,

          disabled:
            fireControl.state ===
              FIRE_STATES.STOPPED &&
            !fireControl.targetHex &&
            !fireControl
              .gunnerAutonomous,

          onClick: () => {
            const currentUnit =
              requireCurrentUnit();

            if (!currentUnit) {
              return;
            }

            const currentFireControl =
              currentUnit.fireControl;

            ceaseFire(currentUnit);

            onRemoveFireEffects(
              currentUnit.id,
            );

            reset();

            onStateChanged();

            const loadingMessage =
              currentFireControl.loading
                ? (
                    ` ${getAmmunitionLabel(
                      currentFireControl
                        .loadingAmmunition,
                    )} 장전은 계속됩니다.`
                  )
                : currentFireControl.loaded
                  ? (
                      ` 현재 장전탄 ${getAmmunitionLabel(
                        currentFireControl
                          .loadedAmmunition,
                      )}은 유지됩니다.`
                    )
                  : "";

            onMessage(
              `사격 절차를 종료했습니다.${loadingMessage}`,
            );

            render();
          },
        },
      ),
    );

    if (
      fireControl.lastShotResult
    ) {
      const resultPanel =
        document.createElement("div");

      resultPanel.className =
        "fire-result-status";

      resultPanel.textContent =
        formatShotResult(
          fireControl
            .lastShotResult,
        );

      wrapper.append(
        resultPanel,
      );
    }

    container.append(
      wrapper,
    );
  }

  return {
    render,
    reset,
    setTarget,

    getProcedure() {
      return {
        ...procedure,

        targetHex:
          commandDraft.targetHex
            ? {
                ...commandDraft.targetHex,
              }
            : null,
      };
    },
  };
}
