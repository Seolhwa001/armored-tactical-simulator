# ATS Sprint 4 Development Report

## Stage 3A — Observation Contract Normalization

**작성 조직:** 개발팀

### 목적
Stage 2 안정화 이후 Observation / Hex View 단계의 첫 작업으로,
승무원별 관측 거리와 좁은 광학장비 시야각을 Sprint 4 계약에 맞춘다.

### 적용
1 Hex = 50m 기준:
- 전차장 개방 육안: 16 Hex
- 전차장 밀폐 육안: 2 Hex (계약값 준비)
- CPS: 36 Hex / 10도
- 포수 주포조준경: 40 Hex / 8도
- 탄약수 개방 육안: 16 Hex
- 탄약수 밀폐 육안: 2 Hex (계약값 준비)
- 조종수: 2 Hex

### 구조 정리
기존 observer.range가 sensor visualRange에 곱해지는 배율처럼 사용되어
관측거리가 과도하게 확대될 수 있었다.

Stage 3A부터 observer.range를 **절대 Hex 관측거리**로 해석한다.
Fog, Detection, View Renderer가 같은 의미를 사용하도록 정규화하였다.

### 비범위
- 해치 전환에 따른 16↔2 Hex Runtime 변경
- Terrain elevation 추가 수정
- Detection/Contact 리뉴얼
- 감시구역
- Fire Procedure 기능 추가

### 다음
실플레이에서 각 승무원 View의 방향/거리와 지도 밖 과도 확장이 없는지 확인 후,
Stage 3B에서 해치 상태와 관측 방향 동기화를 연결한다.

**본 문서는 개발팀(Development Team)이 작성하였습니다.**
