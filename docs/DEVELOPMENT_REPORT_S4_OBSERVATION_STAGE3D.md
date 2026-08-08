# ATS Sprint 4 Development Report

## Stage 3D — Observation UI & Fire Knowledge Consistency

**작성 조직:** 개발팀

### 목적
Stage 3C 실플레이에서 확인된 세 가지 정합성 문제를 수정한다.

1. 자차 선택 시 해당 헥스의 지형/고도가 표시되지 않음
2. 승무원 관측 방향 표시가 실제 화면에서 식별되지 않음
3. Developer 표시로 노출된 미탐지 적이 일반 Fire Target으로 전달될 수 있음

### 변경
- 자차 정보 메시지에 현재 헥스의 지형, 고도, 이동, 은폐, 엄폐를 병합
- 승무원 방향선 길이 증가
- 승무원별 방향선 시작점을 분리하여 겹침 완화
- 라벨에 어두운 배경 Badge 추가
- View fill은 실제 observing 상태에만 유지
- 방향 표시는 enabled observer의 현재 방향을 항상 표시
- Developer Mode는 Runtime 적을 화면에 보여줄 수 있지만 일반 표적 지식으로 사용하지 못하도록 분리

### Fire / View 경계
이번 단계에서는 Fire Procedure를 재설계하지 않는다.
빈 지형 Hex 지정은 향후 화력수색/지역사격 경로를 위해 유지한다.

단, Developer Mode 때문에 보이는 미탐지 Runtime 적의 unitId가
일반 사격 표적으로 전달되는 정보 누출은 차단한다.

### 비범위
- 새로운 LOS 알고리즘
- 탄도/지형 충돌
- Contact 등급 추가
- Fire Procedure 신규 기능
- 고도선 지도

**본 문서는 개발팀(Development Team)이 작성하였습니다.**
