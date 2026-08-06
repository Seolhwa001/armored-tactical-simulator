# ATS Development Report — Sprint 4 Phase 2.1

## Scope
Legacy Detection 결과를 Runtime Contact 저장소 및 승무원 보고 큐와 연결했다.

## Changed files
- `src/engine/detection.js`
- `src/engine/runtime/detectionContactBridge.js`
- `tests/sprint4DetectionContactBridge.test.mjs`

## Implemented
- 탐지 단계가 CONTACT 이상일 때 실제 적 ID를 기준으로 Contact 생성 또는 갱신
- 탐지 위치, 거리, 관측 승무원, 턴, 분류 및 신뢰도 저장
- 최초 Contact, 신뢰도 변경, 분류·위치 변경 시 보고 큐 생성
- 동일 탐지 결과 반복 시 중복 보고 억제
- 기존 적 객체의 `visible`, `detected`, `identified` 동작 유지

## Compatibility
이번 단계에서는 기존 UI, Fog of War, Fire Control이 계속 실제 적 객체를 사용한다. Contact는 병행 기록되며 후속 단계에서 UI와 Fire Control의 조회 기준으로 전환한다.

## Test result
- Phase 1 contracts: PASS
- Phase 2 Contact Runtime: PASS
- Detection Contact bridge: PASS
- JavaScript syntax check: PASS

## Known limitations
- 탐지 방향은 아직 실제 적 객체의 방향을 기록한다. 전차장 기준 방위 보고는 후속 Crew Vision 단계에서 보완한다.
- 긴급 위협 판정은 아직 연결하지 않았다.
- Contact 소실 및 위치 오차 처리는 후속 단계 대상이다.
