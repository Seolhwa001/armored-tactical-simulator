# ATS Development Report — Sprint 4 Phase 2

## Scope

Runtime Contact 기반 계층의 첫 단계 구현.

## Changed files

- `src/engine/scenarioRuntime.js`
- `src/engine/runtime/contactStore.js`
- `src/engine/runtime/contactReportQueue.js`
- `tests/sprint4ContactRuntime.test.mjs`
- `docs/development/DEVELOPMENT_REPORT_S4_PHASE2.md`

## Implemented

- Runtime 소유 Contact 저장소
- Contact ID 및 실제 객체 ID 역색인
- Contact 추가·조회·수정·삭제·upsert API
- 승무원 Contact 보고 큐
- 보고 확인 처리
- Scenario Runtime 초기화 시 Contact 저장소와 보고 큐 생성

## Source of Truth changes

- Contact 컬렉션은 `runtimeScenario.contacts`가 소유한다.
- Contact 보고 이벤트는 `runtimeScenario.contactReports`가 소유한다.
- UI 또는 Detection의 기존 상태는 아직 제거하지 않았다.

## Compatibility

이 단계는 저장소와 API만 추가한다. 기존 Detection, Fog, Fire Control, Fire Panel 동작은 변경하지 않는다.

## Tests

- Contact CRUD
- 실제 객체 ID 역조회
- 동일 실제 객체 upsert
- 보고 생성 및 확인
- JavaScript syntax check

## Remaining

- 기존 Detection 결과를 Contact로 변환
- 승무원별 관측자 정보를 Contact 보고에 연결
- UI의 실제 적 직접 참조를 Contact 참조로 전환
- 개발자 모드에서 실제 객체와 Contact 비교 표시
