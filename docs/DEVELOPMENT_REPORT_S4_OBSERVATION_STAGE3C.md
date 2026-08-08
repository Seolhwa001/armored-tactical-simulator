# ATS Sprint 4 Development Report

## Stage 3C — Observer Direction & Terrain Info UI

**작성 조직:** 개발팀

### 목적
Stage 3B 실플레이에서 실제 View 계산은 동작했으나
플레이어가 각 승무원의 관측 방향과 지형 고도를 읽기 어려운 문제가 확인되었다.

### 변경
선택된 아군 차량에 대해서만 다음 관측 방향을 짧은 화살표와 라벨로 표시한다.

- 전차장
- 포수
- 탄약수
- 조종수
- CPS

Hex View는 실제 가시 영역을 표현하고,
방향 화살표는 현재 관측 방향을 표현한다.

### 지형 정보
기존 하단 map-message의 지형 정보를 정리하여 다음을 표시한다.

- 지형 이름
- 고도(m)
- 이동 비용
- 은폐
- 엄폐

고도 계산이나 Terrain LOS 규칙 자체는 변경하지 않았다.

### 비범위
- View 계산 변경
- Detection 변경
- Terrain elevation 알고리즘 변경
- 고도선/등고선 레이어
- 감시구역

**본 문서는 개발팀(Development Team)이 작성하였습니다.**
