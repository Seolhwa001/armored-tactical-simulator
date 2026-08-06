# ATS Development Report — Sprint 4 Phase 3.1

## Scope
Crew Vision common profiles, hatch-aware observation ranges, and turret/hull direction synchronization.

## Changed files
- src/engine/contracts/visionContract.js
- src/engine/contracts/index.js
- src/engine/runtime/crewFactory.js
- src/engine/runtime/crewVisionRuntime.js
- src/engine/runtime/unitFactory.js
- src/engine/detection.js
- tests/sprint4CrewVision.test.mjs

## Implemented
- Absolute crew vision ranges: 2, 16, 36, and 40 hexes.
- Commander CPS 10-degree FOV and gunner main sight 8-degree FOV.
- Per-crew commander/loader hatch state storage with legacy hatchState compatibility.
- Gunner sight synchronization to turret direction.
- Driver view synchronization to hull direction.
- Closed-hatch commander right-side and loader left-side defaults.
- Detection compatibility for legacy multiplier ranges and Sprint 4 absolute ranges.

## Deferred
- Hatch action timing and UI.
- Hex boundary vision renderer.
- Watch-sector lifecycle.
- Crew availability/task interruption.

## Verification
- Existing Sprint 4 tests passed.
- New Crew Vision tests passed.
- JavaScript syntax checks passed.
