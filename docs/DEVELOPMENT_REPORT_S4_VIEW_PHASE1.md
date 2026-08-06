# ATS Development Report — Sprint 4 View Phase 1

## Scope

- Removed persistent crew/CPS cone rendering.
- Added `View` calculation as a separate module from Detection.
- Added hex-set based View rendering for the selected friendly unit.
- Added forest visibility depth limit (default: 2 consecutive forest hexes).
- Added smoke blocking using the existing smoke area radius data.
- Limited normal View display to the selected unit; developer selection remains available in developer mode.

## Changed files

- `src/app.js`
- `src/engine/view.js`
- `src/render/unitRenderer.js`
- `tests/sprint4View.test.mjs`

## Compatibility

- Existing Detection and Fog of War logic are unchanged.
- Existing observation ranges are reused.
- Existing smoke Runtime data are reused.
- Recon circular display is unchanged; only crew/CPS cone displays were replaced.

## Tests

- JavaScript syntax checks passed.
- Active `src/app.js` import graph check passed.
- Directional candidate View test passed.
- Forest depth blocking test passed.
- Smoke blocking test passed.
- Hex-line calculation test passed.

## Next step

Connect Detection to the calculated View result after in-game visual verification of this patch.
