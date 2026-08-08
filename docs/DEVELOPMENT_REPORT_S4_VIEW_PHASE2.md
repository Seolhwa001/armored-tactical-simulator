# ATS Development Report — Sprint 4 View Phase 2

## Scope

This patch corrects three defects reported after the first hex-View integration.

1. Remove the remaining filled cone-like visual presentation.
2. Replace the ground-threshold elevation rule with a 2.5m observer-height line-of-sight calculation.
3. Make gunner and driver observation View participate in Detection.

## Changed files

- `index.html`
- `src/controllers/scenarioController.js`
- `src/engine/detection.js`
- `src/engine/view.js`
- `src/render/unitRenderer.js`
- `tests/sprint4ViewElevation.test.mjs`
- `tests/sprint4CrewDetection.test.mjs`

## View rendering

The View renderer now draws only the outer boundary edges of visible hexes. It no longer fills the visible region. The application cache key was changed so GitHub Pages browsers request the new module revision.

## Elevation LOS

Observer eye height is defined as terrain elevation plus 2.5m. Target eye height uses the same contract. Every intermediate hex is compared against the interpolated sight-line height. A terrain hex blocks the target only when its elevation reaches at least 0.5m above that sight line.

## Detection integration

The active crew observation candidate is now validated against the same `calculateViewHexes()` result used by the renderer. Gunner, driver, loader, commander, and CPS candidates can therefore contribute only when the enemy hex belongs to their final terrain- and smoke-clipped View.

## Tests

- Existing View test
- Revised elevation LOS test
- Gunner Detection integration test
- Driver Detection integration test
- JavaScript syntax checks

## Remaining work

- Contact storage and automatic crew reporting
- Building terrain LOS when building terrain is introduced
- Fog renderer migration to the shared View result
- Watch-sector integration
