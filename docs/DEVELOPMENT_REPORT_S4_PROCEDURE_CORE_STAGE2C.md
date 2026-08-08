# ATS Sprint 4 Development Report

## Stage 2C — Runtime/UI State Ownership Cleanup

**작성 조직:** 개발팀

### 목적
UI와 Runtime의 Procedure 상태 소유권을 분리한다.

### 변경
- `procedureViewModel.js` 추가
- Runtime `fireControl.procedure`를 읽기 전용 Projection으로 변환
- Fire Panel은 Projection만 표시
- UI 내부 임시 입력 객체 이름을 `procedure`에서 `commandDraft`로 변경
- UI가 실제 Procedure 상태를 소유하는 것처럼 보이는 구조 제거

### Source of Truth
실제 Procedure 상태:
`unit.fireControl.procedure`

UI:
읽기 및 표현만 수행

### 테스트 보정
Stage 2B 테스트가 특정 구현 문자열에 과도하게 결합되어 있어
Stage 2C의 정상적인 리팩터링을 회귀로 오인했다.

Stage 2B 테스트를 구현 방식이 아니라
“Runtime 상태가 UI용 읽기 모델로 정상 투영되는가”라는 동작 계약 기준으로 수정하였다.

### 비범위
- 실제 발사 규칙
- 장전 규칙
- Contact
- View/Fog/Detection
- 다중 표적
- 지속 동작 확장

### 검증
- 전체 JS 구문 검사
- Stage 1 회귀
- Stage 2A 회귀
- Stage 2B 동작 계약 테스트
- Stage 2C 읽기 전용 Projection 및 UI 소유권 검사

**본 문서는 개발팀(Development Team)이 작성하였습니다.**
