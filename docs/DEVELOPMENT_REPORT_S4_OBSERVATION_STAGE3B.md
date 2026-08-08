# ATS Sprint 4 Development Report

## Stage 3B — View Test Visibility Support

**작성 조직:** 개발팀

### 목적
Stage 3A 실플레이 결과, 고도 기반 View 차폐는 동작하나
플레이어가 현재 관측 영역을 판독하기 어렵고 테스트 표적 탐색 비용이 높았다.

본 단계는 새로운 전술 기능을 추가하지 않고
현재 Sprint 4 Observation / Hex View 검증을 가능하게 하는 테스트 지원만 추가한다.

### 변경
- 승무원 View 내부 표시 투명도를 테스트 가능한 수준으로 상향
- View 외곽선 방식은 유지
- Renderer에 남아 있던 Legacy range multiplier 제거
- 임시 적 시야시험 표적 6개 배치

### 임시 표적
`E-VIEW-TEST-01` ~ `06`

이들은 Observation / Detection 검증을 쉽게 하기 위한 임시 개발 표적이며,
전용 테스트 시나리오가 생기면 제거한다.

### 고도 표시
고도 수치 UI는 이번 패치에 넣지 않았다.
현재 요구는 타당하지만 지형 정보 UI의 표현 규칙을 먼저 확정해야 하므로
Stage 3 후속 항목으로 분리한다.

### 다음 확인
- 승무원 View 헥스 영역이 화면에서 식별 가능한가
- 고도 차폐로 View 외곽이 실제로 잘리는가
- 여러 임시 적을 통해 View 안/밖 탐지 차이를 반복 검증할 수 있는가

**본 문서는 개발팀(Development Team)이 작성하였습니다.**
