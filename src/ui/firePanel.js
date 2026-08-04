// src/ui/firePanel.js — 새 파일

import {
  AMMUNITION_TYPES,
  FIRE_STATES,
  ceaseFire,
  enableAdjustedFire,
  fireSingleShot,
  setFireTarget,
} from "../engine/fireControl.js";

import {
  getTurretStatus,
} from "../engine/turretControl.js";

const AMMUNITION_LABELS = {
  [AMMUNITION_TYPES.APFSDS]:
    "날탄",

  [AMMUNITION_TYPES.HEAT]:
    "대탄",

  [AMMUNITION_TYPES.CANISTER]:
    "벌집탄",

  [AMMUNITION_TYPES.SMOKE]:
    "연막탄",
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

function createStatusPanel(
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

  const modeLabels = {
    normal: "정상구동",
    emergency: "비상구동",
    manual: "수동구동",
  };

  const stabilizer =
    status.stabilizerAvailable
      ? "사용 가능"
      : status.stabilizerOperational
        ? "현재 모드 사용 불가"
        : "고장";

  const alignment =
    status.aligned
      ? "정렬 완료"
      : "포탑 정렬 중";

  const values = [
    [
      "구동",
      modeLabels[
        status.mode
      ] ?? status.mode,
    ],
    [
      "안정화",
      stabilizer,
    ],
    [
      "조준",
      alignment,
    ],
  ];

  values.forEach(
    ([label, value]) => {
      const row =
        document.createElement(
          "span",
        );

      const strong =
        document.createElement(
          "strong",
        );

      row.append(
        `${label}: `,
      );

      strong.textContent =
        value;

      row.append(strong);
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

export function createFirePanel({
  container,
  getSelectedUnit,
  getTurn,
  isUnitMoving,
  onBeginTargetSelection,
  onFireEffect,
  onRemoveFireEffects,
  onStateChanged,
  onMessage,
}) {
  const procedure = {
    active: false,

    ammunition:
      AMMUNITION_TYPES.APFSDS,

    targetHex: null,
    targetUnitId: null,
  };

  function reset() {
    procedure.active = false;

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
      );

    if (!success) {
      return false;
    }

    procedure.targetHex = {
      column:
        targetHex.column,

      row:
        targetHex.row,
    };

    procedure.targetUnitId =
      targetUnitId;

    onStateChanged();

    return true;
  }

  function render() {
    container.replaceChildren();

    const unit =
      getSelectedUnit();

    if (
      !unit ||
      unit.side !== "friendly" ||
      !unit.fireControl
    ) {
      const message =
        document.createElement(
          "p",
        );

      message.textContent =
        "선택 객체는 사격 절차를 사용할 수 없습니다.";

      container.append(message);
      return;
    }

    const wrapper =
      document.createElement(
        "div",
      );

    wrapper.className =
      "fire-procedure";

    wrapper.append(
      createStatusPanel(unit),
    );

    wrapper.append(
      createButton(
        "1. 사격명령",
        {
          active:
            procedure.active,

          onClick: () => {
            procedure.active =
              true;

            unit.command =
              "사격명령";

            onBeginTargetSelection();

            onStateChanged();

            onMessage(
              "탄종 선택 후 지도에서 목표를 지정하세요.",
            );

            render();
          },
        },
      ),
    );

    const ammunitionGroup =
      document.createElement(
        "div",
      );

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
                procedure
                  .ammunition ===
                ammunition,

              disabled:
                !procedure.active,

              onClick: () => {
                procedure.ammunition =
                  ammunition;

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

    const turretStatus =
      getTurretStatus(unit);

    const alignment =
      turretStatus?.aligned
        ? "정렬 완료"
        : "포탑 정렬 중";

    targetStatus.textContent =
      procedure.targetHex
        ? `목표: ${procedure.targetHex.column}, ${procedure.targetHex.row} / ${alignment}`
        : `목표: 미지정 / ${alignment}`;

    wrapper.append(
      targetStatus,
    );

    wrapper.append(
      createButton(
        "쏴",
        {
          disabled:
            !unit.fireControl
              .targetHex,

          onClick: () => {
            const result =
              fireSingleShot(
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

            onFireEffect(
              unit,
              unit.fireControl
                .targetHex,
              unit.fireControl
                .ammunition,
            );

            onStateChanged();

            onMessage(
              `${AMMUNITION_LABELS[unit.fireControl.ammunition]} 1발 발사`,
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
            unit.fireControl
              .state ===
            FIRE_STATES.ADJUST,

          disabled:
            !unit.fireControl
              .targetHex,

          onClick: () => {
            const result =
              enableAdjustedFire(
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

            onFireEffect(
              unit,
              unit.fireControl
                .targetHex,
              unit.fireControl
                .ammunition,
            );

            onStateChanged();

            onMessage(
              "포수 자율사격을 시작했습니다.",
            );

            render();
          },
        },
      ),
    );

    wrapper.append(
      createButton(
        "사격그만",
        {
          active:
            unit.fireControl
              .state ===
            FIRE_STATES.STOPPED,

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
