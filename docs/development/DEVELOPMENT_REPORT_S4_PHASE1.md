# ATS 프로젝트 공식 문서

## Development Report No.001

### Sprint 4 Phase 1 — Tactical Common Contracts

발행 조직 : 개발팀

적용 Sprint : Sprint 4

상태 : Implemented in Delivery Archive

## 변경 파일

- `src/engine/contracts/distanceContract.js`
- `src/engine/contracts/crewContract.js`
- `src/engine/contracts/contactContract.js`
- `src/engine/contracts/fireProcedureContract.js`
- `src/engine/contracts/actionTimeContract.js`
- `src/engine/contracts/index.js`
- `src/engine/runtime/runtimeConstants.js`
- `tests/sprint4Contracts.test.mjs`

## 구현 내용

- 1헥스 50m 공통 거리 계약
- 미터·헥스 상호 변환 함수
- 승무원 역할 및 관측 수단 상수
- 해치·승무원 업무·명령 수행 상태 상수
- 확장 가능한 Contact 신뢰도 및 분류 계약
- 실제 객체 ID와 분리된 Contact 생성·갱신 계약
- Fire Procedure 단계·발사 방식·종료 사유 계약
- 기관총 1회 사격 10발 공통값
- 지속 행동 시간 키와 조정 가능한 기본값
- 기존 `runtimeConstants.js`의 승무원 역할을 새 공통 계약으로 단일화

## 호환성

Phase 1은 계약 계층만 추가한다. 기존 Detection, Fire Panel, Fire Control, 턴 처리와 관측 거리의 실행 동작은 변경하지 않았다.

## 테스트 결과

`node tests/sprint4Contracts.test.mjs`

- 100m = 2헥스: 통과
- 800m = 16헥스: 통과
- 1,800m = 36헥스: 통과
- 2,000m = 40헥스: 통과
- Contact 생성·불변 ID 갱신: 통과
- Fire Procedure 초기 상태: 통과
- 기관총 10발 계약: 통과

## 잔여 작업

- Runtime Contact 저장소 및 Detection 변환
- 승무원별 Vision을 미터 기반 계약으로 이전
- Fire Procedure Runtime 생명주기 구현
- Fire Panel 로컬 상태 제거
- 시간 기반 턴 처리 연결

## GitHub 반영

압축 전달본에는 Git 이력이 없어 Commit 및 GitHub Pages 반영은 수행하지 않았다.

본 문서는 개발팀(Development Team)이 작성하였습니다.
