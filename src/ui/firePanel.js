// src/ui/firePanel.js — 전체 교체, 1~432행

import {
  AMMUNITION_TYPES,
  FIRE_PROCEDURE_STATES,
  FIRE_STATES,
  beginLoading,
  beginReloading,
  ceaseFire,
  enableAdjustedFire,
  fireSingleShot,
  issueFireCommand,
  setFireTarget,
} from "../engine/fireControl.js";

import {
  getTurretStatus,
} from "../engine/turretControl.js";

const AMMUNITION_LABELS = Object.freeze({
  [AMMUNITION_TYPES.APFSDS]:
    "날탄",

  [AMMUNITION_TYPES.HEAT]:
    "대탄",

  [AMMUNITION_TYPES.CANISTER]:
    "벌집탄",

  [AMMUNITION_TYPES.SMOKE]:
    "연막탄",
});

const PROCEDURE_LABELS = Object.freeze({
  [FIRE_PROCEDURE_STATES.STOPPED]:
    "사격 중지",

  [FIRE_PROCEDURE_STATES.TARGET_DESIGNATED]:
    "표적 지정",

  [FIRE_PROCEDURE_STATES.FIRE_COMMAND]:
    "사격명령",

  [FIRE_PROCEDURE_STATES.LOADING]:
    "장전 중",

  [FIRE_PROCEDURE_STATES.TRAVERSING]:
    "포탑 선회",

  [FIRE_PROCEDURE_STATES.AIMING]:
    "조준 중",

  [FIRE_PROCEDURE_STATES.READY_TO_FIRE]:
    "발사 준비",

  [FIRE_PROCEDURE_STATES.FIRED]:
    "발사 완료",

  [FIRE_PROCEDURE_STATES.RELOADING]:
    "재장전 중",

  [FIRE_PROCEDURE_STATES.ADJUSTING]:
    "쏴-수정",
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

  button.textContent =
    label;

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

  if (options.onClick) {
    button.addEventListener(
      "click",
      options.onClick,
    );
  }

  return button;
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

  strong.textContent =
    value;

  row.append(strong);

  return row;
}

function createStatusPanel(
  unit,
) {
  const panel =
    document.createElement(
      "div",
    );

  panel.className =
    "turret-status-panel";

  const turretStatus =
    getTurretStatus(unit);

  const fireControl =
    unit.fireControl;

  const modeLabels = {
    normal: "정상구동",
    emergency: "비상구동",
    manual: "수동구동",
  };

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

  const loading =
    fireControl.loaded
      ? "장전 완료"
      : fireControl.loading
        ? "장전 중"
        : "미장전";

  panel.append(
    createStatusRow(
      "절차",
      procedure,
    ),

    createStatusRow(
      "탄 상태",
      loading,
    ),

    createStatusRow(
      "포탑",
      alignment,
    ),

    createStatusRow(
      "구동",
      modeLabels[
        turretStatus?.mode
      ] ?? "-",
    ),

    createStatusRow(
      "안정화",
      stabilizer,
    ),
  );

  if (turretStatus?.warning) {
    const warning =
      document.createElement(
        "p",
      );

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
    document.createElement(
      "div",
    );

  progress.className =
    "fire-procedure-progress";

  const stages = [
    FIRE_PROCEDURE_STATES
      .TARGET_DESIGNATED,

    FIRE_PROCEDURE_STATES
      .FIRE_COMMAND,

    FIRE_PROCEDURE_STATES.LOADING,

    FIRE_PROCEDURE_STATES.TRAVERSING,

    FIRE_PROCEDURE_STATES.AIMING,

    FIRE_PROCEDURE_STATES
      .READY_TO_FIRE,

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
        document.createElement(
          "span",
        );

      item.className =
        "fire-procedure-step";

      item.textContent =
        PROCEDURE_LABELS[stage];

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

function formatShotResult(
  result,
) {
  if (!result) {
    return "발사 완료";
  }

  if (result.smokeCreated) {
    return "연막탄 발사 / 연막 형성";
  }

  if (!result.hit) {
    return `발사 / ${result.reason}`;
  }

  if (result.destroyed) {
    return (
      `명중 / 피해 ${result.damage} / ` +
      "격파"
    );
  }

  return (
    `명중 / 피해 ${result.damage}` +
    (
      result.remainingHealth !== null &&
      result.remainingHealth !==
        undefined
        ? ` / 잔여 체력 ${result.remainingHealth}`
        : ""
    )
  );
}

export function createFirePanel({
  container,
  getSelectedUnit,
  getRuntimeScenario,
  getTurn,
  isUnitMoving,
  onBeginTargetSelection,
  onFireEffect,
  onRemoveFireEffects,
  onStateChanged,
  onMessage,
}) {
  const procedure = {
    ammunition:
      AMMUNITION_TYPES.APFSDS,

    targetHex: null,
    targetUnitId: null,
  };

  function synchronizeProcedure(
    unit,
  ) {
    procedure.ammunition =
      unit.fireControl
        ?.ammunition ??
      procedure.ammunition;

    procedure.targetHex =
      unit.fireControl
        ?.targetHex
        ? {
            ...unit.fireControl
              .targetHex,
          }
        : null;

    procedure.targetUnitId =
      unit.fireControl
        ?.targetUnitId ??
      null;
  }

  function reset() {
    procedure.ammunition =
      AMMUNITION_TYPES.APFSDS;

    procedure.targetHex =
      null;

    procedure.targetUnitId =
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

        procedure.ammunition,
        getTurn(),
      );

    if (!success) {
      return false;
    }

    synchronizeProcedure(unit);

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
    onFireEffect(
      unit,
      unit.fireControl
        .targetHex,

      unit.fireControl
        .ammunition,
    );

    onStateChanged();

    onMessage(
      formatShotResult(
        result.shotResult,
      ),
    );

    render();
  }

  function renderUnavailable(
    message,
  ) {
    container.replaceChildren();

    const paragraph =
      document.createElement(
        "p",
      );

    paragraph.textContent =
      message;

    container.append(paragraph);
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

    synchronizeProcedure(unit);

    const fireControl =
      unit.fireControl;

    const procedureState =
      fireControl.procedureState;

    container.replaceChildren();

    const wrapper =
      document.createElement(
        "div",
      );

    wrapper.className =
      "fire-procedure";

    wrapper.append(
      createStatusPanel(unit),

      createProcedureProgress(
        procedureState,
      ),
    );

    const ammunitionGroup =
      document.createElement(
        "div",
      );

    ammunitionGroup.className =
      "fire-ammunition-group";

    const ammunitionLocked =
      procedureState !==
        FIRE_PROCEDURE_STATES.STOPPED &&
      procedureState !==
        FIRE_PROCEDURE_STATES
          .TARGET_DESIGNATED;

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
                procedure
                  .ammunition ===
                ammunition,

              disabled:
                ammunitionLocked,

              onClick: () => {
                procedure.ammunition =
                  ammunition;

                fireControl.ammunition =
                  ammunition;

                onStateChanged();
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
      document.createElement(
        "div",
      );

    targetStatus.className =
      "fire-target-status";

    targetStatus.textContent =
      procedure.targetHex
        ? (
            `목표: ${procedure.targetHex.column}, ` +
            `${procedure.targetHex.row}`
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
              FIRE_STATES.ADJUST ||
            fireControl.loading,

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
        "사격명령",
        {
          current:
            procedureState ===
            FIRE_PROCEDURE_STATES
              .FIRE_COMMAND,

          disabled:
            procedureState !==
            FIRE_PROCEDURE_STATES
              .TARGET_DESIGNATED,

          onClick: () => {
            const result =
              issueFireCommand(
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

            onMessage(
              "사격명령 하달. 장전을 실시하세요.",
            );

            render();
          },
        },
      ),
    );

    wrapper.append(
      createButton(
        "장전",
        {
          current:
            procedureState ===
            FIRE_PROCEDURE_STATES
              .LOADING,

          disabled:
            procedureState !==
            FIRE_PROCEDURE_STATES
              .FIRE_COMMAND,

          onClick: () => {
            const result =
              beginLoading(
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

            onMessage(
              "장전 중. 다음 턴에 완료됩니다.",
            );

            render();
          },
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
            const result =
              fireSingleShot(
                getRuntimeScenario(),
                unit,
                getTurn(),
                {
                  moving:
                    isUnitMoving(
                      unit,
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
              unit,
              result,
            );
          },
        },
      ),
    );

    wrapper.append(
      createButton(
        "재장전",
        {
          current:
            procedureState ===
            FIRE_PROCEDURE_STATES
              .RELOADING,

          disabled:
            procedureState !==
              FIRE_PROCEDURE_STATES
                .FIRED &&
            procedureState !==
              FIRE_PROCEDURE_STATES
                .ADJUSTING,

          onClick: () => {
            const result =
              beginReloading(
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

            onMessage(
              "재장전 중. 다음 턴에 완료됩니다.",
            );

            render();
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
            const result =
              enableAdjustedFire(
                getRuntimeScenario(),
                unit,
                getTurn(),
                {
                  moving:
                    isUnitMoving(
                      unit,
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
              unit,
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
            procedureState ===
              FIRE_PROCEDURE_STATES
                .STOPPED &&
            !fireControl.targetHex,

          onClick: () => {
            ceaseFire(unit);

            onRemoveFireEffects(
              unit.id,
            );

            reset();

            onStateChanged();

            onMessage(
              "모든 사격과 장전을 중지했습니다.",
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
        document.createElement(
          "div",
        );

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

    container.append(wrapper);
  }

  return {
    render,
    reset,
    setTarget,

    getProcedure() {
      return {
        ...procedure,

        targetHex:
          procedure.targetHex
            ? {
                ...procedure
                  .targetHex,
              }
            : null,
      };
    },
  };
      }
