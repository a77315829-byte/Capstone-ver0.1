# 프론트 연결 순서

## 시나리오 시작

1. `GET /api/scenarios`
2. 사용자가 시나리오를 선택하면 `POST /api/scenarios/semiconductor/sessions`
3. 응답의 `session_id`를 라우트 상태 또는 전역 상태에 보관

## 각 턴

1. `GET /api/sessions/{session_id}/turn`
2. `turn`, `market_state`, `news`, `assets`, `portfolio`, `orders`, `questions`를 화면에 배치
   - `coaching.reminders`가 있으면 직전 턴에서 피해야 할 행동을 상단 알림으로 표시
3. 종목 선택 시 차트와 호가를 조회
   - `GET /api/sessions/{session_id}/chart/{asset_id}`
   - `GET /api/sessions/{session_id}/orderbook/{asset_id}`
4. 매수·매도 시 `POST /api/sessions/{session_id}/orders`
5. 턴 완료 모달에서 여섯 답변을 `POST /api/sessions/{session_id}/turn/submit`
6. `next_turn`이 숫자이면 다시 현재 턴 조회
7. `final_evaluation`이 있으면 결과 화면으로 이동

프론트가 임의로 현재 턴이나 현금을 계산하지 않습니다. 모든 진행 상태와 포트폴리오는
서버 응답을 단일 기준으로 사용합니다.

## 호가·주문

호가 응답의 `is_simulated=true`, `source=SIMULATED_FROM_DAILY_OHLCV`를 기준으로 화면에
`시나리오 모의 호가`라고 표시합니다. `bids`, `asks`는 각각 10단계이며 각 단계에는
`price`, 현재 `quantity`, 최초 `initial_quantity`, `consumed_quantity`,
`cumulative_quantity`가 들어갑니다.

시장가 주문은 기존 요청과 호환됩니다.

```json
{"asset_id":"000660","side":"BUY","quantity":10,"order_type":"MARKET"}
```

지정가 주문은 가격을 함께 보냅니다.

```json
{"asset_id":"000660","side":"BUY","quantity":10,"order_type":"LIMIT","limit_price":135000}
```

주문 응답의 `fills`가 실제 체결 상세이고 `quantity`와 `filled_quantity`는 체결 수량입니다.
`requested_quantity`는 사용자가 입력한 수량, `cancelled_quantity`는 IOC로 취소된 수량입니다.
상태는 `FILLED`, `PARTIALLY_FILLED`, `CANCELLED` 중 하나입니다. 응답에 갱신된
`portfolio`와 `orderbook`도 함께 오므로 주문 후 별도 계산 없이 화면 상태를 교체합니다.
새로고침 후 체결내역은 `GET /turn`의 `orders`를 사용합니다.

턴 제출 응답의 기존 `scorecard.metrics`, `feedback.good_points`,
`feedback.missed_points`, `feedback.explanation` 계약은 유지됩니다. 추가된
`scorecard.rationale_analysis`에는 자유서술에서 인식한 요인과 방향 오류,
위험·완화 요인, 추론 행동과 실제 행동 강도가 들어가며 상세 피드백 화면에서 선택적으로
사용할 수 있습니다. `quality=INSUFFICIENT`이면 의미 있는 근거가 부족한 답변입니다.

`feedback.next_actions`는 이번 턴을 바탕으로 다음 판단에서 피해야 할 행동입니다.
`feedback.previous_guidance_review`는 직전 조언을 이번 턴에서 반영했는지 보여줍니다.

| 상태 | 화면 문구 권장 |
|---|---|
| `FOLLOWED` | 이전 조언을 이번 판단에 반영했습니다. |
| `REPEATED` | 이전 턴에서 지적된 행동이 다시 확인됐습니다. |
| `NOT_VERIFIABLE` | 이번 정보만으로 조언 준수 여부를 확인하기 어렵습니다. |

코칭 필드는 추가 필드이므로 기존 화면은 그대로 동작합니다. 다음 턴 화면에서는
`GET /turn`의 `coaching.reminders`, 턴 결과 모달에서는
`feedback.previous_guidance_review`와 `feedback.next_actions`를 사용하면 됩니다.

## 마이페이지

- 카드 목록: `GET /api/users/{user_id}/evaluations`
- 상세 모달·페이지: `GET /api/users/{user_id}/evaluations/{evaluation_id}`
- 누적 성향: `GET /api/users/{user_id}/behavior-profile`

`OBSERVATION`은 한 번 관찰된 행동이고, `REPEATED_PATTERN`은 한 시나리오에서 2회 이상
나타난 행동입니다. `stable_tendency`는 여러 시나리오에서 반복됐을 때만 `true`가 됩니다.
최종 상세 응답의 `coaching_progress`에는 턴 사이 조언의 반영·반복 횟수와 전체 이력이
들어가며, `feedback.coaching_summary`는 화면에 바로 표시할 수 있는 요약 문장입니다.
