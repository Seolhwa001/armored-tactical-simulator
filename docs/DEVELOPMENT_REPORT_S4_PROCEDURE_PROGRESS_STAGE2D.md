# ATS Sprint 4 Development Report

## Stage 2D — Procedure Progress Runtime Integration

**작성 조직:** 개발팀

### 확인된 문제

Legacy Fire Procedure의 `AIMING → READY_TO_FIRE` 전환이
`turn > aimStartedTurn` 조건에 직접 결합되어 있었다.

이 구조에서는 작업 상태가 이미 완료 가능한 경우에도
턴 번호가 바뀌지 않으면 절차가 정지할 수 있었다.

### 변경

조준 단계의 완료 기준을 `turn > aimStartedTurn`에서 분리하고
Generic Procedure Core의 `actionProgress`를 사용하도록 연결하였다.

현재 Stage 2D는 **정규화된 진행도 0~1**만 사용한다.
실제 초 단위 시간값이나 현실 장비 시간값은 도입하지 않는다.

기본 Runtime 진행 step은 1이며,
조준 준비가 가능한 상태에서 Core 진행도가 1에 도달하면
`READY_TO_FIRE`로 전환한다.

### 중요한 범위 제한

이번 변경은 다음을 수행하지 않는다.

- 실제 발사 결과 규칙 변경
- 실장비 조준 시간 모델링
- 장전 시간 리뉴얼
- View / Detection / Contact 수정
- 다중 표적
- 지속 사격 확장

### 회귀 목적

동일 Runtime 상태에서 이미 준비 가능한 절차가
단순히 턴 번호가 바뀌지 않았다는 이유로
`AIMING`에 영구 고착되어서는 안 된다.

### 테스트

- 이미 정렬되고 준비된 상태에서 명령
- Generic Procedure Core actionProgress 완료
- `READY_TO_FIRE` 진입
- 기존 Procedure 회귀 테스트

**본 문서는 개발팀(Development Team)이 작성하였습니다.**
