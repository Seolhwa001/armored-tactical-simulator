// src/render/effectRenderer.js — 새 파일

import {
  AMMUNITION_TYPES,
} from "../engine/fireControl.js";

const DEFAULT_EFFECT_DURATION = 1500;
const DEFAULT_CONTACT_DURATION = 1800;

function clamp(
  value,
  minimum,
  maximum,
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function createEffectId(
  prefix,
  unitId,
  now,
) {
  return `${prefix}-${unitId}-${now}-${Math.random()}`;
}

export function createEffectState() {
  return {
    items: [],
    animationFrameId: null,
  };
}

export function clearEffects(
  effectState,
) {
  effectState.items = [];

  if (
    effectState.animationFrameId !==
    null
  ) {
    cancelAnimationFrame(
      effectState.animationFrameId,
    );

    effectState.animationFrameId =
      null;
  }
}

export function addFireEffect(
  effectState,
  unit,
  targetHex,
  ammunition,
  options = {},
) {
  if (
    !unit ||
    !targetHex
  ) {
    return null;
  }

  const now =
    performance.now();

  const effect = {
    id:
      createEffectId(
        "fire",
        unit.id,
        now,
      ),

    type: "fire",
    unitId: unit.id,

    from: {
      column: unit.column,
      row: unit.row,
    },

    to: {
      column: targetHex.column,
      row: targetHex.row,
    },

    ammunition,

    reconByFire:
      options.reconByFire ===
      true,

    startedAt: now,

    expiresAt:
      now +
      (
        options.duration ??
        DEFAULT_EFFECT_DURATION
      ),
  };

  effectState.items.push(
    effect,
  );

  return effect;
}

export function addContactEffect(
  effectState,
  unit,
  options = {},
) {
  if (!unit) {
    return null;
  }

  const now =
    performance.now();

  const effect = {
    id:
      createEffectId(
        "contact",
        unit.id,
        now,
      ),

    type: "contact",
    unitId: unit.id,

    position: {
      column: unit.column,
      row: unit.row,
    },

    startedAt: now,

    expiresAt:
      now +
      (
        options.duration ??
        DEFAULT_CONTACT_DURATION
      ),
  };

  effectState.items.push(
    effect,
  );

  return effect;
}

export function removeUnitFireEffects(
  effectState,
  unitId,
) {
  effectState.items =
    effectState.items.filter(
      (effect) =>
        !(
          effect.type === "fire" &&
          effect.unitId === unitId
        ),
    );
}

export function removeExpiredEffects(
  effectState,
  now = performance.now(),
) {
  const previousLength =
    effectState.items.length;

  effectState.items =
    effectState.items.filter(
      (effect) =>
        effect.expiresAt > now,
    );

  return (
    previousLength !==
    effectState.items.length
  );
}

export function startEffectAnimation(
  effectState,
  renderFrame,
) {
  if (
    effectState.animationFrameId !==
    null
  ) {
    return;
  }

  const animate = (now) => {
    removeExpiredEffects(
      effectState,
      now,
    );

    renderFrame(now);

    if (
      effectState.items.length > 0
    ) {
      effectState.animationFrameId =
        requestAnimationFrame(
          animate,
        );
    } else {
      effectState.animationFrameId =
        null;
    }
  };

  effectState.animationFrameId =
    requestAnimationFrame(
      animate,
    );
}

function drawMuzzleFlash(
  context,
  point,
  progress,
) {
  const opacity =
    1 - progress;

  const radius =
    5 +
    opacity * 13;

  context.save();

  context.fillStyle =
    `rgba(255, 226, 132, ${opacity})`;

  context.beginPath();

  context.arc(
    point.x,
    point.y,
    radius,
    0,
    Math.PI * 2,
  );

  context.fill();
  context.restore();
}

function drawCanisterTrajectory(
  context,
  from,
  to,
  progress,
) {
  context.strokeStyle =
    `rgba(255, 211, 139, ${1 - progress * 0.45})`;

  context.lineWidth = 1.5;

  const baseAngle =
    Math.atan2(
      to.y - from.y,
      to.x - from.x,
    );

  const maximumDistance =
    Math.hypot(
      to.x - from.x,
      to.y - from.y,
    );

  const distance =
    maximumDistance *
    Math.min(
      1,
      progress * 1.3,
    );

  for (
    let index = -3;
    index <= 3;
    index += 1
  ) {
    const angle =
      baseAngle +
      index * 0.055;

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
}

function drawSingleTrajectory(
  context,
  from,
  to,
  progress,
  ammunition,
) {
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

  context.lineTo(
    from.x +
      (
        to.x - from.x
      ) *
        progress,

    from.y +
      (
        to.y - from.y
      ) *
        progress,
  );

  context.stroke();
}

function drawTrajectory(
  context,
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
    drawCanisterTrajectory(
      context,
      from,
      to,
      progress,
    );

    context.restore();
    return;
  }

  drawSingleTrajectory(
    context,
    from,
    to,
    progress,
    ammunition,
  );

  context.restore();
}

function drawSmokeImpact(
  context,
  point,
  progress,
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
      progress * 20;

    context.fillStyle =
      `rgba(180, 190, 183, ${0.55 - progress * 0.22})`;

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
        progress * 10,

      0,
      Math.PI * 2,
    );

    context.fill();
  }
}

function drawExplosiveImpact(
  context,
  point,
  progress,
  ammunition,
) {
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
      ? `rgba(215, 240, 255, ${1 - progress})`
      : `rgba(255, 165, 67, ${0.8 - progress * 0.7})`;

  context.beginPath();

  context.arc(
    point.x,
    point.y,

    4 +
      maximumRadius *
        progress,

    0,
    Math.PI * 2,
  );

  context.fill();

  context.fillStyle =
    `rgba(123, 103, 75, ${0.45 - progress * 0.3})`;

  context.beginPath();

  context.arc(
    point.x,
    point.y + 6,

    10 +
      progress * 24,

    0,
    Math.PI * 2,
  );

  context.fill();
}

function drawImpact(
  context,
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
    drawSmokeImpact(
      context,
      point,
      impactProgress,
    );
  } else {
    drawExplosiveImpact(
      context,
      point,
      impactProgress,
      ammunition,
    );
  }

  context.restore();
}

function drawFireEffect(
  context,
  effect,
  progress,
  hexToWorld,
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
    context,
    from,
    progress,
  );

  drawTrajectory(
    context,
    from,
    to,
    Math.min(
      1,
      progress * 1.7,
    ),
    effect.ammunition,
  );

  drawImpact(
    context,
    to,
    progress,
    effect.ammunition,
  );
}

function drawContactEffect(
  context,
  effect,
  progress,
  hexToWorld,
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

export function drawEffects({
  context,
  effectState,
  now = performance.now(),
  hexToWorld,
  bounds,
  isPointVisible,
}) {
  effectState.items.forEach(
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
        effect.type === "fire"
      ) {
        const targetPoint =
          hexToWorld(
            effect.to.column,
            effect.to.row,
          );

        const sourcePoint =
          hexToWorld(
            effect.from.column,
            effect.from.row,
          );

        if (
          !isPointVisible(
            targetPoint,
            bounds,
          ) &&
          !isPointVisible(
            sourcePoint,
            bounds,
          )
        ) {
          return;
        }

        drawFireEffect(
          context,
          effect,
          progress,
          hexToWorld,
        );

        return;
      }

      if (
        effect.type === "contact"
      ) {
        const point =
          hexToWorld(
            effect.position.column,
            effect.position.row,
          );

        if (
          !isPointVisible(
            point,
            bounds,
          )
        ) {
          return;
        }

        drawContactEffect(
          context,
          effect,
          progress,
          hexToWorld,
        );
      }
    },
  );
}
