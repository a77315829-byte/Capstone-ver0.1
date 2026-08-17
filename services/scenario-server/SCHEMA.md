# Beta 데이터 계약

모든 장기 저장 문서는 `schema_version`을 가집니다. 시나리오 실행 세션에는
`scenario_version`, 평가에는 `evaluator_version`을 함께 저장해 과거 결과의 재현성을
보존합니다.

## 콘텐츠 컬렉션

| 컬렉션 | 고유키 | 역할 |
|---|---|---|
| `scenarios` | `(scenario_id, version)` | 소개, 일정, 초기자산, 최종평가일, 종목 목록 |
| `scenario_turns` | `(scenario_id, scenario_version, turn_no)` | 턴 화면 문구와 콘텐츠 참조 |
| `question_banks` | `bank_id` | 공통 질문 정의 |
| `turn_rubrics` | `(scenario_id, scenario_version, turn_no)` | 프론트에 노출하지 않는 채점 기준 |
| `assets` | `asset_id` | 종목 기본정보. 종목코드는 문자열 |
| `daily_prices` | `(asset_id, trade_date)` | 실제 수정주가 일봉 OHLCV |
| `news_items` | `news_id` | 화면용 제목·직접 작성 요약·출처 |
| `market_snapshots` | `snapshot_id` | 턴별 시장심리·업종상태·위험요인 |
| `order_book_snapshots` | `(scenario_id, scenario_version, turn_no, asset_id, generator_version)` | 일봉에서 생성한 공용 모의 호가 |

JSON 파일은 콘텐츠 작성·검토·Git 이력용 원본이고, 서버 실행 시 위 컬렉션을 조회합니다.
`order_book_snapshots`만 JSON 원본 없이 최초 조회 시 생성되며, 생성기 버전과 실제 사용한
일봉 날짜·종가·거래량을 함께 저장합니다.

## 실행 컬렉션

### `scenario_sessions`

현재 진행 상태의 단일 원본입니다.

```json
{
  "session_id": "uuid",
  "user_id": "USER-001",
  "scenario_id": "semiconductor",
  "scenario_version": 1,
  "status": "ACTIVE | FINALIZING | COMPLETED",
  "current_turn": 1,
  "initial_cash": 10000000,
  "cash": 9000000,
  "positions": [
    {"asset_id":"000660","quantity":10,"avg_price":100000}
  ],
  "realized_pnl_by_asset": {"000660": 120000},
  "revision": 1
}
```

### `orders`

모든 주문은 IOC 방식으로 즉시 체결 또는 취소되며 수정하지 않는 이벤트 기록입니다.

```json
{
  "order_id": "uuid",
  "session_id": "uuid",
  "turn_no": 1,
  "market_date": "2024-02-02",
  "asset_id": "000660",
  "side": "BUY | SELL",
  "order_type": "MARKET | LIMIT",
  "limit_price": null,
  "requested_quantity": 10,
  "filled_quantity": 10,
  "cancelled_quantity": 0,
  "quantity": 10,
  "execution_price": 135950.0,
  "amount": 1359500,
  "status": "FILLED | PARTIALLY_FILLED | CANCELLED",
  "time_in_force": "IOC",
  "fills": [
    {"price":135900,"quantity":5,"amount":679500},
    {"price":136000,"quantity":5,"amount":680000}
  ],
  "price_basis": "synthetic_orderbook_v1",
  "orderbook_snapshot_id": "semiconductor-v1-turn-1-000660-synthetic-ohlcv-v1"
}
```

기존 호환 필드인 `quantity`와 `execution_price`는 각각 실제 체결 수량과 가중평균
체결가입니다. 포트폴리오와 행동 평가는 `filled_quantity`와 실제 `amount`를 사용합니다.

### `portfolio_snapshots`

`TURN_START`, `TURN_END`, `FINAL` 시점의 현금·보유수량·평가금액·비중을 고정 저장합니다.
과거 사용자 상태를 현재 포지션에서 역산하지 않습니다.

### `turn_records`

한 턴의 콘텐츠 참조, 주문 전후 포트폴리오, 답변, 파생된 행동, 평가 ID를 함께 묶습니다.
이 문서가 최종 행동 분석의 근거입니다.

### `turn_evaluations`

채점 엔진의 M1~M5·PORTFOLIO 점수, 감점 사유, 함정, 피드백을 저장합니다.
수익률은 이 점수에 포함되지 않습니다.

`evaluator_version=beta-v2-rationale-m1-m5`부터 `scorecard.rationale_analysis`에 다음
자유서술 분석 근거를 추가 저장합니다.

- 입력 품질(`SUFFICIENT`, `WEAK`, `INSUFFICIENT`)
- 언급 요인, 올바르게 해석한 요인, 방향을 잘못 해석한 요인
- 위험 요인과 완화·호재 요인
- 불확실성과 원인-영향 연결 여부
- 자유서술에서 추론한 행동과 실제 주문 행동 강도

이 필드는 기존 점수·피드백 필드를 제거하지 않는 추가 필드입니다.

`evaluator_version=beta-v3-cross-turn-coaching`부터 각 턴의
`scorecard.feedback`에 다음 필드를 추가합니다.

```json
{
  "next_actions": [
    {
      "guidance_code": "AVOID_RISK_OMISSION",
      "kind": "AVOID",
      "message": "호재만 보고 손실 위험과 반대 시나리오를 생략하지 마세요.",
      "source_turn": 1,
      "target_metrics": ["M3"]
    }
  ],
  "previous_guidance_review": [
    {
      "guidance_code": "AVOID_RISK_OMISSION",
      "source_turn": 1,
      "evaluated_turn": 2,
      "status": "FOLLOWED | REPEATED | NOT_VERIFIABLE",
      "evidence": "관련 감점이 반복되지 않았고 M3 4.20점으로 확인됐습니다."
    }
  ]
}
```

코칭 판정은 점수의 추가 가감에 사용하지 않습니다.

## 결과 컬렉션

### `scenario_evaluations`

시나리오 완료마다 하나가 생성됩니다.

- `decision_evaluation`: 6축 평균과 턴별 추이
- `behavior_patterns`: 패턴, 관찰 횟수, 근거 턴, 권고사항
- `coaching_progress`: 이전 조언의 반영·반복·판단 불가 횟수, 턴별 이력, 미해결 행동
- `portfolio_analysis`: 수익률, 벤치마크, MDD, 회전율, 현금·집중도, 기여도
- `feedback`: 요약, 강점, 개선점, 다음 행동

고유키는 `evaluation_id`와 `session_id`입니다.

### `user_behavior_profiles`

마이페이지용 사용자별 집계 캐시입니다. 원본 근거는 `scenario_evaluations`에 유지합니다.

- 한 번 발생: `OBSERVATION`
- 한 시나리오에서 2회 이상: `REPEATED_PATTERN`
- 서로 다른 시나리오 2개 이상에서 반복: `stable_tendency: true`

## 삭제·재시드 규칙

콘텐츠 시드는 콘텐츠 컬렉션만 upsert합니다. 다음 사용자 데이터는 절대 삭제하거나
덮어쓰지 않습니다.

```text
scenario_sessions, orders, portfolio_snapshots, turn_records,
turn_evaluations, scenario_evaluations, user_behavior_profiles
```
