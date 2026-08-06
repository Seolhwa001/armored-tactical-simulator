# ATS Development Report — Sprint 4 Phase 3.2

## Scope
Crew hatch manipulation and observation interruption were converted to persistent Runtime actions.

## Changed files
- `src/engine/runtime/crewHatchRuntime.js`
- `src/engine/crewActions.js`
- `src/engine/runtime/unitFactory.js`
- `src/controllers/turnController.js`
- `tests/sprint4CrewHatchRuntime.test.mjs`

## Implemented
- Commander and loader hatch transitions use OPENING/CLOSING states.
- Hatch transitions consume adjustable action time.
- Observation pauses while a crew member operates a hatch.
- Crew vision profiles are synchronized after completion.
- Loader opening is blocked while loading.
- Legacy loader hatch field remains synchronized during migration.

## Deferred
- Dedicated hatch controls for commander UI.
- Shared per-turn second budget across all Tactical Actions.
- Text-log reporting for hatch completion.

## Verification
- JavaScript syntax checks passed.
- Existing Sprint 4 contract, Contact and Crew Vision tests passed.
- New hatch Runtime test passed.
