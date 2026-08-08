# ATS Sprint 4 Development Report

## Stage 2D — Moving/Aiming Diagnostic Patch

**작성 조직:** 개발팀

### 목적

이동 중 사격 절차가 `조준`에서 더 진행되지 않는 현상의 원인을
추정 패치 없이 Runtime 상태로 직접 확인한다.

### 변경

`processPersistentActions()`가 알고 있는 `moving` 상태를
`updateFireProcedure()`에 진단 Context로 전달한다.

Runtime은 `fireControl.procedureDiagnostics`에 다음 값을 기록한다.

- moving
- targetPresent
- fireCommandIssued
- turretAligned
- procedureState
- coreState
- coreProgress
- aiming
- loading
- loaded

Fire Panel에서는 우선 다음 네 값만 표시한다.

- 진단 · 이동
- 진단 · 포탑정렬
- 진단 · 명령
- 진단 · 표적

### 기능 변경 여부

없음.

본 패치는 상태 전이, 포탑 동작, 이동, 사격 결과를 변경하지 않는다.
원인 확인을 위한 임시 진단 패치다.

### 확인 방법

이동 명령을 유지한 상태에서 기존 절차를 진행하고
`조준`에서 멈춘 순간 다음 값을 기록한다.

- Core 단계 / Core 진행도
- 진단 · 이동
- 진단 · 포탑정렬
- 진단 · 명령
- 진단 · 표적

이 값으로 다음 수정 위치를 결정한다.

**본 문서는 개발팀(Development Team)이 작성하였습니다.**
