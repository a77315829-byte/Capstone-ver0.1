# Anttitude Scenario Server — Beta v3

AI 반도체 6턴 시나리오를 실행하고, 주문·판단·포트폴리오 변화를 기록한 뒤
행동 패턴과 종합평가를 마이페이지용 데이터로 만드는 FastAPI 서버입니다.

## 구현된 흐름

1. JSON 콘텐츠를 MongoDB에 반복 안전하게 시드
2. 시나리오 세션 생성(초기자산 1,000만원)
3. 턴별 뉴스·시장상태·종목·차트 조회
4. 턴 기준일 종가로 즉시 매수/매도
5. 객관식 5문항과 자유서술을 함께 사용한 M1~M5·PORTFOLIO 채점
6. 6턴 종료 후 2024-07-19 종가로 최종 평가
7. 이전 턴 조언의 준수·반복 여부를 다음 턴과 최종 피드백에 반영
8. 반복 행동·포트폴리오 지표·사용자 누적 프로필 생성

수익률은 판단 점수에 포함되지 않고 별도 결과 지표로 저장됩니다.

## 1. 설치

Python 3.11 이상과 MongoDB가 필요합니다.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

`.env`에서 MongoDB 주소와 KIS 키를 입력합니다. `.env`는 Git에 올리지 않습니다.

## 2. MongoDB 콘텐츠 시드

```powershell
python -m scripts.seed_database --scenario semiconductor
```

`scenario.json`, `assets.json`, `turn_displays.json`, `rubric_turn1~6.json`,
`questions.json`을 MongoDB에 upsert합니다. 다시 실행해도 중복되지 않습니다.

## 3. 실제 과거 일봉 적재

KIS 키를 `.env`에 입력한 뒤 실행합니다.

```powershell
python -m scripts.import_kis_prices --scenario semiconductor --start 20231101 --end 20240719
```

KIS를 당장 사용할 수 없으면 다음 열을 가진 CSV도 적재할 수 있습니다.

```text
asset_id,trade_date,open,high,low,close,volume
```

```powershell
python -m scripts.import_prices_csv .\prices.csv --source MANUAL_CSV
```

가격이 없는 종목은 화면에 `data_available: false`로 표시되며, 해당 종목 주문은
오류로 차단됩니다. 임의 가격으로 체결하지 않습니다.

턴별 코스피·코스닥·환율·금리 수치가 준비되면 다음 열의 CSV로 시장 스냅샷에
병합할 수 있습니다.

```text
scenario_id,scenario_version,turn_no,kind,code,name,value,change_pct,unit,as_of_date
```

```powershell
python -m scripts.import_market_metrics_csv .\market_metrics.csv
```

`kind`는 `index` 또는 `indicator`입니다. 정성적 시장 국면·심리·위험요인은 이미
콘텐츠 시드에 포함되어 있습니다.

## 4. 서버 실행

```powershell
uvicorn main:app --reload --port 8000
```

- API 문서: `http://127.0.0.1:8000/docs`
- 상태 확인: `http://127.0.0.1:8000/`

## 주요 API

| 기능 | 메서드·경로 |
|---|---|
| 시나리오 목록 | `GET /api/scenarios` |
| 세션 시작 | `POST /api/scenarios/{scenario_id}/sessions` |
| 현재 턴 화면 | `GET /api/sessions/{session_id}/turn` |
| 종목 차트 | `GET /api/sessions/{session_id}/chart/{asset_id}` |
| 주문 | `POST /api/sessions/{session_id}/orders` |
| 판단 제출·채점·턴 이동 | `POST /api/sessions/{session_id}/turn/submit` |
| 최종화 재시도 | `POST /api/sessions/{session_id}/finalize` |
| 세션 결과 | `GET /api/sessions/{session_id}/result` |
| 마이페이지 평가 목록 | `GET /api/users/{user_id}/evaluations` |
| 평가 상세 | `GET /api/users/{user_id}/evaluations/{evaluation_id}` |
| 누적 행동 프로필 | `GET /api/users/{user_id}/behavior-profile` |

기존 독립 채점 API인 `POST /scenario/{sid}/turn/{tno}/score`도 유지됩니다.

## 요청 예시

세션 시작:

```json
{
  "user_id": "USER-001"
}
```

주문:

```json
{
  "asset_id": "000660",
  "side": "BUY",
  "quantity": 10
}
```

턴 제출의 `answers`에는 현재 턴 조회 응답에 포함된 여섯 문항을 모두 보냅니다.

```json
{
  "answers": [
    {"question_id":"Q1","selected":["실적"],"text":""},
    {"question_id":"Q4","selected":["일부 새로운 정보"],"text":""},
    {"question_id":"Q18","selected":["정보 부족"],"text":""},
    {"question_id":"Q38","selected":["공식 발표"],"text":""},
    {"question_id":"Q36","selected":["단계적 대응"],"text":""},
    {"question_id":"Q39","selected":[],"text":"호재와 위험을 함께 고려해 비중을 조절했다."}
  ]
}
```

턴마다 문항 ID가 다르므로 위 예시를 고정 사용하지 말고 현재 턴 조회 응답을 기준으로
폼을 구성해야 합니다.

## 채점 방식 (`beta-v3-cross-turn-coaching`)

자유서술은 M5에만 사용하지 않고 M1~M5 전체에 반영합니다.

| 축 | 반영 입력 |
|---|---|
| M1 핵심 요인 식별 | 객관식 45% + 자유서술 요인 식별 55% |
| M2 정보 해석 | 객관식 45% + 자유서술 영향 방향 해석 55% |
| M3 위험 인식 | 객관식 45% + 자유서술의 위험·완화·불확실성 55% |
| M4 행동-근거 정합성 | 자유서술↔실제 주문 55% + 행동 적합도 25% + 객관식 20% |
| M5 논리 일관성 | 자유서술의 원인→영향→행동 연결 |
| PORTFOLIO | 실제 현금·집중도·함정 종목 등 |

`1` 같은 의미 없는 서술은 `INSUFFICIENT_RATIONALE`로 판정하며 M1~M4는 최대 2점,
M5는 1점으로 제한합니다. 분석 결과는 각 턴 `scorecard.rationale_analysis`에 요인,
방향 오류, 위험·완화 요인, 추론한 행동과 실제 행동 강도로 함께 저장합니다.

외부 LLM은 이 점수 계산에 필요하지 않습니다. 피드백 문장 생성에만 선택적으로 사용하며,
호출 실패 시에도 규칙 기반 피드백으로 턴이 정상 진행됩니다. 기존 완료 결과는 자동 재평가하지
않으므로 변경 후 확인할 때는 새 시나리오 세션을 시작해야 합니다.

## 턴 간 코칭 반영

각 턴 피드백은 현재 감점 사유에서 최대 3개의 `next_actions`를 구조화해 저장합니다.
다음 턴 조회 응답의 `coaching.reminders`에 직전 조언을 제공하고, 다음 턴 제출 시에는
각 조언을 `FOLLOWED`, `REPEATED`, `NOT_VERIFIABLE` 중 하나로 판정합니다.

이 판정은 학습 피드백에만 사용하며 점수를 추가로 가감하지 않습니다. 같은 문제를 반복하면
현재 턴의 기존 M1~M5 기준에서 이미 감점되므로, 코칭 이력으로 다시 감점하지 않습니다.
6턴 종료 후에는 `coaching_progress`에 반영·반복·판단 불가 횟수와 아직 남은 개선 행동을
집계하고 최종 `feedback.summary`, `feedback.coaching_summary`, `feedback.next_actions`에
포함합니다.

## 자동 테스트

테스트 데이터는 메모리에만 생성되며 실제 MongoDB를 수정하지 않습니다.

```powershell
python -m unittest discover -v -s tests
```

현재 테스트는 세션 시작, 주문, 6턴 제출, 최종평가, 사용자 누적 프로필과 함께 부실 서술의
전 축 점수 제한, 정상 서술의 M1~M5 반영, 서술-행동 불일치, 이전 조언의 다음 턴 노출,
조언 준수·반복 판정과 최종 집계를 확인합니다.

## 베타 한계

- 지정가·미체결·부분 체결은 없고 종가 즉시 체결만 지원합니다.
- 과거 호가·체결·거래원 스냅샷은 아직 포함하지 않습니다.
- 인증 서버 연결 전이므로 `user_id`를 요청에서 받습니다. 배포 시 인증 토큰의 사용자 ID로 교체해야 합니다.
- 패턴 분석은 규칙 기반 v1이며, 여러 시나리오에서 2회 이상 반복된 경우에만 안정적 성향으로 표시합니다.
