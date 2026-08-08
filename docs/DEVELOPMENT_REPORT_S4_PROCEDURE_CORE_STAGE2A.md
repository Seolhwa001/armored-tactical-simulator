# ATS Sprint 4 Development Report

## Stage 2A — Generic Procedure Core

**작성 조직:** 개발팀

Stage 1 Fire Procedure 최소 계약 위에 범용 상태 전이 계층을 추가하였다.

### 범위
- IDLE / COMMAND / PREPARE / READY / EXECUTE / END
- 시작, 준비, 준비완료, 실행, 수정, 취소, 초기화
- 작업 진행도 유지
- 턴 변경 상태 유지
- 기존 Fire Procedure 상태와 호환 매핑

### 비범위
- 실제 사격 규칙 변경
- 다중 표적
- 지속사격
- 기관총 확장
- Contact 연계
- View/Fog 판정 변경

### 의존성
Procedure Core는 View, Fog, Detection, Contact, Terrain을 직접 입력으로 받지 않는다.

기존 Legacy Fire Procedure에서 View/Fog 조건 변화 때문에 준비 단계가 고착되는 현상은 Known Issue로 유지하고, 새로운 Procedure Integration에서 오래된 View 판정을 절차 상태의 Source of Truth로 사용하지 않는 것을 회귀 조건으로 둔다.

### 테스트
- 범용 상태 전이
- 수정 후 COMMAND 복귀
- 취소/종료/초기화
- 10회 턴 변경 후 상태와 진행도 유지
- 기존 Fire Procedure 상태 → Generic Core 매핑
- Stage 1 회귀

**본 문서는 개발팀(Development Team)이 작성하였습니다.**
