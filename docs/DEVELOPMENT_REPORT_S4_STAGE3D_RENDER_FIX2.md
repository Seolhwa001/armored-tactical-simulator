# ATS Sprint 4 Development Report

## Stage 3D — Observation Render Fix 2

**작성 조직:** 개발팀

### 회귀
이전 Render Fix에서 관측 UI 전체를 Fog 상위 Overlay로 이동하면서
승무원별 Hex View 표시가 실플레이에서 사라지는 회귀가 발생하였다.

### 원인
하나의 함수가 두 역할을 동시에 가지고 있었다.

- 실제 View Hex 영역 표현
- 플레이어용 관측 방향선/라벨 표현

Fog 문제를 해결하면서 두 표현을 함께 이동한 것이 잘못이었다.

### 수정
렌더 역할을 분리하였다.

Dynamic Layer (Fog 아래)
- 승무원별 실제 Hex View
- View 외곽선
- View 내부 옅은 색

Overlay Layer (Fog 위)
- 전차장 / 포수 / 탄약수 / 조종수 방향선
- CPS 방향선
- 승무원 라벨

모든 방향선은 차량 중심에서 시작한다.

### 비범위
- View 계산
- Terrain LOS
- Detection
- Fire Control
- 승무원 방향 상태값

위 로직은 변경하지 않는다.

**본 문서는 개발팀(Development Team)이 작성하였습니다.**
