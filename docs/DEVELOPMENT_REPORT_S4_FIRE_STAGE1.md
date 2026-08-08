# ATS Development Report — Sprint 4 Fire Procedure Stage 1

**작성 조직:** 개발팀

## Scope
Architecture Handover No.003 Stage 1에 따라 Fire Procedure 최소 계약을 도입하였다.

## Implemented
- Runtime-owned `fireControl.procedure` 계약 추가
- Fire Procedure 상태 계약 단일화
- Target Reference 최소 계약
- Mock Target 생성 지원
- Weapon State 최소 계약
- Crew State 최소 계약
- Turn/Time State 최소 계약
- 턴 변경 시 Procedure 상태/표적/진행도 유지
- 기존 `fireControl.procedureState` / `procedureTurn` 호출은 accessor로 유지하여 Legacy UI/Fire Control 회귀를 최소화

## Not Implemented (Stage Gate)
- 경고전파 UI
- `다시`
- 새로운 `사격그만` 규칙 확장
- 장전 중 탄종 변경 재시작
- Contact 연계
- 다중 표적
- 쏴-수정 확장
- 기관총 확장

위 항목은 Stage 2 이후 대상이다.

## Source of Truth
새 Fire Procedure 상태의 Source of Truth는 `unit.fireControl.procedure`이다. 기존 `procedureState`와 `procedureTurn`은 별도 상태가 아니라 동일 객체에 대한 호환 accessor다.

## Verification
- Mock Target으로 Detection/Contact 없이 Procedure 실행 가능
- 턴 3 → 4 변경 후 AIMING 상태 유지
- Target Reference 유지
- Weapon State 유지
- Action Progress 유지
- Legacy accessor와 새 계약 동기화 확인

**본 문서는 개발팀(Development Team)이 작성하였습니다.**
