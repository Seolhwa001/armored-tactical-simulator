# ATS Sprint 4 Development Report

## Stage 2B — Procedure Core Runtime/UI Minimum Integration

**작성 조직:** 개발팀

### 목적
Stage 2A의 Generic Procedure Core를 실제 UI에서 읽을 수 있도록 최소 연결한다.

### 구현
- `fireControl.procedure.core`를 Runtime-owned Source of Truth로 유지
- Fire Panel은 해당 상태를 읽기만 함
- Core 단계 표시
- Core 진행도 표시

### UI 표시
- Core 단계: 대기 / 명령 / 준비 / 준비 완료 / 실행 / 종료
- Core 진행도: 0~100%

### Source of Truth
UI는 Procedure Core를 생성하거나 복제하지 않는다.

실제 상태:
`unit.fireControl.procedure.core`

UI:
상태 읽기 및 표현만 수행

### 비범위
이번 단계에서는 다음을 변경하지 않는다.

- 실제 발사 규칙
- 장전 규칙
- Target Reference 생성 규칙
- Contact
- View / Fog / Detection
- 다중 표적
- 지속사격
- 기관총 확장

### 검증
- 전체 JavaScript 구문 검사
- Stage 1 회귀
- Stage 2A 회귀
- Stage 2B UI read-only 연결 테스트

### 실플레이 확인
사용자는 Fire Panel에서 `Core 단계`와 `Core 진행도`가 표시되는지 확인한다.
기존 사격, 이동, 턴 진행에 회귀가 없어야 한다.

**본 문서는 개발팀(Development Team)이 작성하였습니다.**
