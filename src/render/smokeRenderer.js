// ============================================================
// ATS PROJECT
// File      : src/render/smokeRenderer.js
// Sprint    : 3.9.x
// Revision  : R1
// Build     : 2026-08-05
// Type      : PATCHED FULL REPLACEMENT
// Purpose   : Render independent vehicle and main-gun smoke areas
// ============================================================

export function drawSmokeAreas({
  context,
  smokeAreas,
  hexRadius,
  hexToWorld,
  bounds,
  isPointVisible,
}) {
  const areas = Array.isArray(smokeAreas)
    ? smokeAreas
    : [];

  areas.forEach((area) => {
    const point = hexToWorld(
      area.column,
      area.row,
    );

    if (
      !isPointVisible(
        point,
        bounds,
      )
    ) {
      return;
    }

    context.save();

    const vehicleSmoke =
      area.sourceType === "vehicle";

    context.fillStyle = vehicleSmoke
      ? "rgba(154, 170, 161, 0.46)"
      : "rgba(170, 181, 175, 0.42)";

    context.strokeStyle = vehicleSmoke
      ? "rgba(208, 222, 214, 0.58)"
      : "rgba(218, 225, 220, 0.5)";

    context.lineWidth = 2;

    for (
      let index = 0;
      index < 7;
      index += 1
    ) {
      const angle =
        index * (Math.PI * 2 / 7);

      const distance =
        index === 0
          ? 0
          : hexRadius * 0.7;

      context.beginPath();

      context.arc(
        point.x +
          Math.cos(angle) *
            distance,
        point.y +
          Math.sin(angle) *
            distance,
        hexRadius * 0.7,
        0,
        Math.PI * 2,
      );

      context.fill();
    }

    context.beginPath();

    context.arc(
      point.x,
      point.y,
      hexRadius * 1.5,
      0,
      Math.PI * 2,
    );

    context.stroke();
    context.restore();
  });
}
