# ATS Sprint 4 View Phase 1.1 Development Report

## Scope
- Remove 360-degree recon command and detection path.
- Replace visually dominant filled view wedge with outline-first hex View rendering.
- Add first-stage terrain elevation blocking.

## Elevation rule
- Vehicle observer height contract: 2.5m.
- Initial blocking rule: an intervening terrain hex at least 0.5m above the observer vehicle's ground elevation remains visible itself, but blocks all hexes behind it.
- Forest depth and smoke blocking remain active.

## Removed
- 360-degree recon command button.
- Recon activation handler.
- Crew-recon detection candidate.
- Crew-recon Fog capability.
- Circular recon renderer.
- Stale crew-recon labels in developer and map input UI.

## Verification
- JavaScript syntax checks passed for all changed files.
- Elevation line-of-sight test passed.
- Existing recon-by-fire functionality was not removed.
