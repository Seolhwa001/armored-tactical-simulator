# ATS Sprint 4 Development Report

## Stage 2C — READY/UI Consistency Fix

**작성 조직:** 개발팀

### 증상

실플레이에서 간헐적으로 기존 절차 표시는 `발사 준비`에 도달했으나
실행 입력이 같은 상태로 보이지 않는 현상이 보고되었다.

### 원인 범위

Fire Panel이 한 렌더 안에서 동일한 Runtime 상태를 여러 조건문에서
각각 재해석하고 있었다.

현재는 Legacy Fire Procedure와 Generic Procedure Core가 공존하는 과도기이므로,
UI 내부에서 같은 의미의 조건을 따로 계산하는 것은 정합성 위험이 있다.

### 수정

`createFireUiSnapshot()`을 추가하여 한 번의 렌더에서 다음 값을 한 번만 계산한다.

- procedureState
- canIssueFireCommand
- readyToExecute

`발사 준비` 표시와 실행 입력 활성 조건은 동일한 `readyToExecute` 값을 사용한다.

### 비범위

실제 실행/사격 규칙은 변경하지 않았다.
View/Fog/Detection/Contact도 변경하지 않았다.

### 회귀 기준

한 프레임에서 `발사 준비` 표시가 활성 상태라면
UI의 실행 입력도 동일한 READY 판정을 사용해야 한다.

**본 문서는 개발팀(Development Team)이 작성하였습니다.**
