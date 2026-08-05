// ============================================================
// ATS PROJECT
// File      : src/ui/developerHud.js
// Sprint    : 3.9.1
// Revision  : R5
// Build     : 2026-08-05
// Type      : FULL REPLACEMENT
// Purpose   : Battle-only developer HUD with detection decision replay
// ============================================================

import {
  DETECTION_STAGES,
} from "../engine/detection.js";

import {
  CREW_ROLES,
  HUNTER_KILLER_STATES,
} from "../engine/runtime/runtimeConstants.js";

const DETECTION_STAGE_LABELS =
  Object.freeze({
    [DETECTION_STAGES.HIDDEN]:
      "HIDDEN",

    [DETECTION_STAGES.CONTACT]:
      "CONTACT",

    [DETECTION_STAGES.DETECTED]:
      "DETECTED",

    [DETECTION_STAGES.IDENTIFIED]:
      "IDENTIFIED",
  });

const HUNTER_KILLER_LABELS =
  Object.freeze({
    [HUNTER_KILLER_STATES.SEARCHING]:
      "SEARCHING",

    [HUNTER_KILLER_STATES.TARGET_FOUND]:
      "TARGET_FOUND",

    [HUNTER_KILLER_STATES.DESIGNATING]:
      "DESIGNATING",

    [HUNTER_KILLER_STATES.HANDOFF]:
      "HANDOFF",

    [HUNTER_KILLER_STATES.TRACKING]:
      "TRACKING",
  });

const CREW_ROLE_LABELS =
  Object.freeze({
    [CREW_ROLES.COMMANDER]:
      "COMMANDER",

    [CREW_ROLES.GUNNER]:
      "GUNNER",

    [CREW_ROLES.DRIVER]:
      "DRIVER",

    [CREW_ROLES.LOADER]:
      "LOADER",

    "commander-cps":
      "COMMANDER CPS",

    "crew-recon":
      "CREW RECON",

    "recon-by-fire":
      "RECON BY FIRE",
  });

const FULL_ROTATION =
  Math.PI * 2;

function clamp(
  value,
  minimum,
  maximum,
) {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value,
    ),
  );
}

function radiansToDegrees(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  let normalized =
    value %
    FULL_ROTATION;

  if (normalized < 0) {
    normalized +=
      FULL_ROTATION;
  }

  return (
    normalized *
    180 /
    Math.PI
  );
}

function formatDirection(value) {
  const degrees =
    radiansToDegrees(value);

  return degrees === null
    ? "-"
    : `${degrees.toFixed(1)}°`;
}

function formatNumber(
  value,
  fallback = "-",
) {
  return Number.isFinite(value)
    ? String(value)
    : fallback;
}

function formatDetectionConfidence(
  unit,
) {
  if (
    !unit ||
    unit.side !== "enemy"
  ) {
    return "N/A";
  }

  if (
    !Number.isFinite(
      unit.detectionConfidence,
    )
  ) {
    return "0%";
  }

  return (
    `${clamp(
      unit.detectionConfidence,
      0,
      100,
    ).toFixed(0)}%`
  );
}

function getUnitDisplayName(unit) {
  if (!unit) {
    return "없음";
  }

  return (
    unit.name ??
    unit.id ??
    "이름 없음"
  );
}

function getUnitById(
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
    ) ??
    null
  );
}

function getTargetDisplayName(
  runtimeScenario,
  unitId,
) {
  return getUnitDisplayName(
    getUnitById(
      runtimeScenario,
      unitId,
    ),
  );
}

function getDetectionStageLabel(unit) {
  if (
    !unit ||
    unit.side !== "enemy"
  ) {
    return "N/A";
  }

  const stage =
    unit.detectionStage;

  return (
    DETECTION_STAGE_LABELS[
      stage
    ] ??
    `UNKNOWN(${stage ?? "-"})`
  );
}

function getDetectionStageValueLabel(
  stage,
) {
  return (
    DETECTION_STAGE_LABELS[
      stage
    ] ??
    `UNKNOWN(${stage ?? "-"})`
  );
}

function formatDecimal(
  value,
  digits = 2,
) {
  return Number.isFinite(value)
    ? value.toFixed(digits)
    : "-";
}

function getDetectionReplayReasonLabel(
  reason,
) {
  const labels = {
    "detected":
      "탐지 성공",

    "outside-effective-range":
      "유효 탐지거리 밖",

    "no-active-observation-candidate":
      "활성 감시 후보 없음",

    "no-friendly-observer":
      "활성 아군 관측자 없음",

    "recon-by-fire-contact":
      "화력수색 임시 접촉",
  };

  return (
    labels[reason] ??
    reason ??
    "기록 없음"
  );
}

function getHunterKillerLabel(unit) {
  const hunterKiller =
    unit?.crewObservation
      ?.hunterKiller;

  if (!hunterKiller?.enabled) {
    return "DISABLED";
  }

  return (
    HUNTER_KILLER_LABELS[
      hunterKiller.state
    ] ??
    `UNKNOWN(${hunterKiller.state ?? "-"})`
  );
}

function getCrewObserver(
  unit,
  crewRole,
) {
  return (
    unit?.crewObservation
      ?.observers?.[crewRole] ??
    null
  );
}

function getCommanderSight(unit) {
  return (
    unit?.crewObservation
      ?.commanderIndependentSight ??
    null
  );
}

function getDetectedByRoleLabel(unit) {
  const role =
    unit?.detectedByCrewRole;

  if (!role) {
    return "없음";
  }

  return (
    CREW_ROLE_LABELS[
      role
    ] ??
    role
  );
}

function isExposureActive(
  unit,
  currentTurn,
) {
  return (
    Number.isFinite(
      unit?.temporaryExposure,
    ) &&
    unit.temporaryExposure > 0 &&
    Number.isFinite(
      unit.exposedUntilTurn,
    ) &&
    Number.isFinite(
      currentTurn,
    ) &&
    unit.exposedUntilTurn >=
      currentTurn
  );
}

function createElement(
  tagName,
  className = "",
) {
  const element =
    document.createElement(
      tagName,
    );

  if (className) {
    element.className =
      className;
  }

  return element;
}

function createStatusRow(
  label,
  value,
) {
  const row =
    createElement(
      "div",
      "developer-hud__row",
    );

  const labelElement =
    createElement(
      "span",
      "developer-hud__label",
    );

  const valueElement =
    createElement(
      "strong",
      "developer-hud__value",
    );

  labelElement.textContent =
    label;

  valueElement.textContent =
    value;

  row.append(
    labelElement,
    valueElement,
  );

  return row;
}

function createSection(title) {
  const section =
    createElement(
      "section",
      "developer-hud__section",
    );

  const heading =
    createElement(
      "h3",
      "developer-hud__section-title",
    );

  heading.textContent =
    title;

  section.append(
    heading,
  );

  return section;
}

function createHudElement() {
  const root =
    createElement(
      "aside",
      "developer-hud",
    );

  root.id =
    "developer-hud";

  root.hidden =
    true;

  root.setAttribute(
    "aria-label",
    "개발자 정보",
  );

  const header =
    createElement(
      "header",
      "developer-hud__header",
    );

  const title =
    createElement(
      "strong",
      "developer-hud__title",
    );

  const badge =
    createElement(
      "span",
      "developer-hud__badge",
    );

  title.textContent =
    "DEVELOPER HUD";

  badge.textContent =
    "DEBUG";

  header.append(
    title,
    badge,
  );

  const content =
    createElement(
      "div",
      "developer-hud__content",
    );

  root.append(
    header,
    content,
  );

  return {
    root,
    content,
  };
}

function renderRuntimeSection(
  content,
  developerMode,
  activeScreen,
  currentTurn,
  selectedUnit,
) {
  const section =
    createSection(
      "RUNTIME",
    );

  section.append(
    createStatusRow(
      "Turn",
      formatNumber(
        currentTurn,
      ),
    ),

    createStatusRow(
      "Developer Mode",
      developerMode
        ? "ON"
        : "OFF",
    ),

    createStatusRow(
      "Active Screen",
      activeScreen ??
      "-",
    ),

    createStatusRow(
      "Selected Unit ID",
      selectedUnit?.id ??
      "없음",
    ),
  );

  content.append(
    section,
  );
}

function renderUnitSection(
  content,
  unit,
) {
  const section =
    createSection(
      "SELECTED UNIT",
    );

  section.append(
    createStatusRow(
      "Name",
      getUnitDisplayName(
        unit,
      ),
    ),

    createStatusRow(
      "ID",
      unit?.id ??
      "없음",
    ),

    createStatusRow(
      "Side",
      unit?.side ??
      "-",
    ),

    createStatusRow(
      "Type",
      unit?.type ??
      "-",
    ),

    createStatusRow(
      "Hex",
      unit
        ? (
            `${formatNumber(
              unit.column,
            )}, ` +
            `${formatNumber(
              unit.row,
            )}`
          )
        : "-",
    ),

    createStatusRow(
      "Destroyed",
      unit?.destroyed === true
        ? "YES"
        : "NO",
    ),
  );

  content.append(
    section,
  );
}

function renderDirectionSection(
  content,
  unit,
) {
  const section =
    createSection(
      "DIRECTIONS",
    );

  const commander =
    getCrewObserver(
      unit,
      CREW_ROLES.COMMANDER,
    );

  const gunner =
    getCrewObserver(
      unit,
      CREW_ROLES.GUNNER,
    );

  const driver =
    getCrewObserver(
      unit,
      CREW_ROLES.DRIVER,
    );

  const loader =
    getCrewObserver(
      unit,
      CREW_ROLES.LOADER,
    );

  const sight =
    getCommanderSight(unit);

  section.append(
    createStatusRow(
      "Hull",
      formatDirection(
        unit?.hullDirection,
      ),
    ),

    createStatusRow(
      "Turret",
      formatDirection(
        unit?.turretDirection,
      ),
    ),

    createStatusRow(
      "Turret Target",
      formatDirection(
        unit?.turretControl
          ?.targetDirection,
      ),
    ),

    createStatusRow(
      "Commander",
      formatDirection(
        commander?.direction,
      ),
    ),

    createStatusRow(
      "Gunner",
      formatDirection(
        gunner?.direction,
      ),
    ),

    createStatusRow(
      "Driver",
      formatDirection(
        driver?.direction,
      ),
    ),

    createStatusRow(
      "Loader",
      formatDirection(
        loader?.direction,
      ),
    ),

    createStatusRow(
      "CPS",
      formatDirection(
        sight?.direction,
      ),
    ),

    createStatusRow(
      "CPS Target",
      formatDirection(
        sight?.targetDirection,
      ),
    ),
  );

  content.append(
    section,
  );
}

function renderObservationSection(
  content,
  runtimeScenario,
  unit,
) {
  const section =
    createSection(
      "OBSERVATION",
    );

  const commander =
    getCrewObserver(
      unit,
      CREW_ROLES.COMMANDER,
    );

  const gunner =
    getCrewObserver(
      unit,
      CREW_ROLES.GUNNER,
    );

  const driver =
    getCrewObserver(
      unit,
      CREW_ROLES.DRIVER,
    );

  const loader =
    getCrewObserver(
      unit,
      CREW_ROLES.LOADER,
    );

  const sight =
    getCommanderSight(unit);

  const hunterKiller =
    unit?.crewObservation
      ?.hunterKiller;

  section.append(
    createStatusRow(
      "Commander",
      commander?.observing ===
        true
        ? "ACTIVE"
        : "INACTIVE",
    ),

    createStatusRow(
      "Gunner",
      gunner?.observing ===
        true
        ? "ACTIVE"
        : "INACTIVE",
    ),

    createStatusRow(
      "Driver",
      driver?.observing ===
        true
        ? "ACTIVE"
        : "INACTIVE",
    ),

    createStatusRow(
      "Loader",
      loader?.observing ===
        true
        ? (
            `ACTIVE / ` +
            `${loader.observationMode ?? "normal"}`
          )
        : "INACTIVE",
    ),

    createStatusRow(
      "Loader Hatch",
      unit?.hatchState ??
      "-",
    ),

    createStatusRow(
      "CPS Active",
      sight?.active === true
        ? "YES"
        : "NO",
    ),

    createStatusRow(
      "CPS Locked",
      sight?.locked === true
        ? "YES"
        : "NO",
    ),

    createStatusRow(
      "CPS Tracking",
      sight?.tracking === true
        ? "YES"
        : "NO",
    ),

    createStatusRow(
      "CPS Target Unit",
      getTargetDisplayName(
        runtimeScenario,
        sight?.targetUnitId,
      ),
    ),

    createStatusRow(
      "HK State",
      getHunterKillerLabel(
        unit,
      ),
    ),

    createStatusRow(
      "HK Detected Target",
      getTargetDisplayName(
        runtimeScenario,
        hunterKiller
          ?.detectedTargetUnitId,
      ),
    ),

    createStatusRow(
      "HK Designated Target",
      getTargetDisplayName(
        runtimeScenario,
        hunterKiller
          ?.designatedTargetUnitId,
      ),
    ),

    createStatusRow(
      "HK Handed-off Target",
      getTargetDisplayName(
        runtimeScenario,
        hunterKiller
          ?.handedOffTargetUnitId,
      ),
    ),
  );

  content.append(
    section,
  );
}

function renderDetectionSection(
  content,
  runtimeScenario,
  unit,
  currentTurn,
) {
  const section =
    createSection(
      "DETECTION",
    );

  const detector =
    getUnitById(
      runtimeScenario,
      unit?.detectedByUnitId,
    );

  const enemyUnit =
    unit?.side === "enemy";

  section.append(
    createStatusRow(
      "Stage",
      getDetectionStageLabel(
        unit,
      ),
    ),

    createStatusRow(
      "Confidence",
      formatDetectionConfidence(
        unit,
      ),
    ),

    createStatusRow(
      "Visible",
      enemyUnit
        ? (
            unit?.visible === true
              ? "YES"
              : "NO"
          )
        : "N/A",
    ),

    createStatusRow(
      "Detected",
      enemyUnit
        ? (
            unit?.detected === true
              ? "YES"
              : "NO"
          )
        : "N/A",
    ),

    createStatusRow(
      "Identified",
      enemyUnit
        ? (
            unit?.identified === true
              ? "YES"
              : "NO"
          )
        : "N/A",
    ),

    createStatusRow(
      "Detected By",
      enemyUnit
        ? getUnitDisplayName(
            detector,
          )
        : "N/A",
    ),

    createStatusRow(
      "Crew Role",
      enemyUnit
        ? getDetectedByRoleLabel(
            unit,
          )
        : "N/A",
    ),

    createStatusRow(
      "Exposure",
      enemyUnit
        ? formatNumber(
            unit?.temporaryExposure,
            "0",
          )
        : "N/A",
    ),

    createStatusRow(
      "Exposed Until",
      enemyUnit
        ? formatNumber(
            unit?.exposedUntilTurn,
          )
        : "N/A",
    ),

    createStatusRow(
      "Exposure Active",
      enemyUnit
        ? (
            isExposureActive(
              unit,
              currentTurn,
            )
              ? "YES"
              : "NO"
          )
        : "N/A",
    ),
  );

  content.append(
    section,
  );
}

function renderDetectionReplaySection(
  content,
  runtimeScenario,
  unit,
) {
  const section =
    createSection(
      "DETECTION REPLAY",
    );

  if (
    unit?.side !== "enemy"
  ) {
    section.append(
      createStatusRow(
        "Replay",
        "N/A",
      ),
    );

    content.append(
      section,
    );

    return;
  }

  const replay =
    unit.detectionReplay;

  if (!replay) {
    section.append(
      createStatusRow(
        "Replay",
        "기록 없음",
      ),
    );

    content.append(
      section,
    );

    return;
  }

  const observer =
    getUnitById(
      runtimeScenario,
      replay.observerUnitId,
    );

  const observerLabel =
    replay.observerRole
      ? (
          CREW_ROLE_LABELS[
            replay.observerRole
          ] ??
          replay.observerRole
        )
      : "없음";

  section.append(
    createStatusRow(
      "Turn",
      formatNumber(
        replay.turn,
      ),
    ),

    createStatusRow(
      "Observer Unit",
      getUnitDisplayName(
        observer,
      ),
    ),

    createStatusRow(
      "Observer Role",
      observerLabel,
    ),

    createStatusRow(
      "Candidate Count",
      formatNumber(
        replay.candidateCount,
        "0",
      ),
    ),

    createStatusRow(
      "Distance",
      formatDecimal(
        replay.distance,
      ),
    ),

    createStatusRow(
      "Visual Range",
      formatDecimal(
        replay.effectiveVisualRange,
      ),
    ),

    createStatusRow(
      "Identification Range",
      formatDecimal(
        replay.effectiveIdentificationRange,
      ),
    ),

    createStatusRow(
      "Base Visual",
      formatDecimal(
        replay.baseVisualRange,
      ),
    ),

    createStatusRow(
      "Base Identification",
      formatDecimal(
        replay.baseIdentificationRange,
      ),
    ),

    createStatusRow(
      "Range Factor",
      formatDecimal(
        replay.observerRangeFactor,
      ),
    ),

    createStatusRow(
      "Identification Factor",
      formatDecimal(
        replay.identificationFactor,
      ),
    ),

    createStatusRow(
      "Concealment Penalty",
      formatDecimal(
        replay.concealmentPenalty,
      ),
    ),

    createStatusRow(
      "Exposure Active",
      replay.exposureActive
        ? "YES"
        : "NO",
    ),

    createStatusRow(
      "Exposure Applied",
      replay.exposureApplied
        ? "YES"
        : "NO",
    ),

    createStatusRow(
      "Exposure Minimum",
      getDetectionStageValueLabel(
        replay.exposureMinimumStage,
      ),
    ),

    createStatusRow(
      "Reason",
      getDetectionReplayReasonLabel(
        replay.reason,
      ),
    ),

    createStatusRow(
      "Final Stage",
      getDetectionStageValueLabel(
        replay.finalStage,
      ),
    ),
  );

  content.append(
    section,
  );
}

export function createDeveloperHud({
  parentElement,
  getDeveloperMode,
  getActiveScreen,
  getRuntimeScenario,
  getSelectedUnit,
  getTurn,
} = {}) {
  if (
    !parentElement ||
    typeof parentElement.append !==
      "function"
  ) {
    throw new Error(
      "Developer HUD 부모 요소가 필요합니다.",
    );
  }

  const {
    root,
    content,
  } = createHudElement();

  parentElement.append(
    root,
  );

  function render() {
    const developerMode =
      getDeveloperMode?.() ===
      true;

    const activeScreen =
      getActiveScreen?.() ??
      null;

    const runtimeScenario =
      getRuntimeScenario?.() ??
      null;

    const shouldDisplay =
      developerMode &&
      activeScreen === "battle" &&
      Boolean(runtimeScenario);

    root.hidden =
      !shouldDisplay;

    if (!shouldDisplay) {
      content.replaceChildren();

      return;
    }

    const selectedUnit =
      getSelectedUnit?.() ??
      null;

    const turnValue =
      getTurn?.();

    const currentTurn =
      Number.isFinite(turnValue)
        ? turnValue
        : null;

    content.replaceChildren();

    renderRuntimeSection(
      content,
      developerMode,
      activeScreen,
      currentTurn,
      selectedUnit,
    );

    if (!selectedUnit) {
      const empty =
        createElement(
          "p",
          "developer-hud__empty",
        );

      empty.textContent =
        "선택된 객체가 없습니다.";

      content.append(
        empty,
      );

      return;
    }

    renderUnitSection(
      content,
      selectedUnit,
    );

    renderDirectionSection(
      content,
      selectedUnit,
    );

    renderObservationSection(
      content,
      runtimeScenario,
      selectedUnit,
    );

    renderDetectionSection(
      content,
      runtimeScenario,
      selectedUnit,
      currentTurn,
    );

    renderDetectionReplaySection(
      content,
      runtimeScenario,
      selectedUnit,
    );
  }

  function destroy() {
    root.remove();
  }

  return {
    element:
      root,

    render,
    destroy,
  };
}
