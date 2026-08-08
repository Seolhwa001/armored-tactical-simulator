# ATS Sprint 4 Development Report

## Stage 3D — Observation Render Layer Fix

**작성 조직:** 개발팀

### 확인된 문제
- 승무원 관측 방향선과 라벨이 Dynamic Layer에 그려진 뒤 Fog Layer가 덮어 가독성이 사라짐
- 겹침 완화를 위해 적용한 originOffset 때문에 일부 방향선이 차량 중심이 아닌 지형에서 시작하는 것처럼 보임

### 수정
- 선택 차량의 관측 UI를 별도 Overlay callback으로 분리
- Fog Layer 합성 이후 Hex View / 방향선 / 라벨 렌더
- 모든 승무원 방향선은 정확히 차량 중심에서 시작
- 겹침 완화는 시작점 이동이 아니라 선 길이 차이로 처리
  - 전차장 82px
  - 포수 98px
  - 탄약수 114px
  - 조종수 130px
- 선택된 아군 차량 한 대에만 Overlay 표시
- View/Detection/고도 LOS 계산은 변경하지 않음

### 테스트 보정
Stage 3C 테스트가 `unit.id === selectedUnitId`라는 구현 문자열에 결합되어 있어
Overlay 함수 분리 후 정상 동작을 회귀로 오인하였다.
선택 유닛 제한이라는 동작 계약은 유지한 채 테스트를 보정하였다.

**본 문서는 개발팀(Development Team)이 작성하였습니다.**


### 다음 관측 방향 동기화 항목
Sprint 4 계약상 밀폐 육안 기본 방향은 다음과 같다.

- 전차장: 포탑 우측
- 탄약수: 포탑 좌측

현재 탄약수 밀폐 육안이 우측으로 나타나는 현상은 다음 관측 방향 동기화 단계에서 수정한다.
이번 Render Fix에서는 방향 계산값 자체를 변경하지 않는다.
