# 프론트 연결 순서

## 시나리오 시작

1. `GET /api/scenarios`
2. 사용자가 시나리오를 선택하면 `POST /api/scenarios/semiconductor/sessions`
3. 응답의 `session_id`를 라우트 상태 또는 전역 상태에 보관

## 각 턴

1. `GET /api/sessions/{session_id}/turn`
2. `turn`, `market_state`, `news`, `assets`, `portfolio`, `questions`를 화면에 배치
3. 종목 선택 시 `GET /api/sessions/{session_id}/chart/{asset_id}`
4. 매수·매도 시 `POST /api/sessions/{session_id}/orders`
5. 턴 완료 모달에서 여섯 답변을 `POST /api/sessions/{session_id}/turn/submit`
6. `next_turn`이 숫자이면 다시 현재 턴 조회
7. `final_evaluation`이 있으면 결과 화면으로 이동

프론트가 임의로 현재 턴이나 현금을 계산하지 않습니다. 모든 진행 상태와 포트폴리오는
서버 응답을 단일 기준으로 사용합니다.

## 마이페이지

- 카드 목록: `GET /api/users/{user_id}/evaluations`
- 상세 모달·페이지: `GET /api/users/{user_id}/evaluations/{evaluation_id}`
- 누적 성향: `GET /api/users/{user_id}/behavior-profile`

`OBSERVATION`은 한 번 관찰된 행동이고, `REPEATED_PATTERN`은 한 시나리오에서 2회 이상
나타난 행동입니다. `stable_tendency`는 여러 시나리오에서 반복됐을 때만 `true`가 됩니다.
