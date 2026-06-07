# Market Reaction Simulator

사용자가 실시간 모의투자에서 선택한 **종목 + 입력 텍스트(뉴스/이벤트/시나리오/정보)** 에 대해
**영향 분석 · 시장 압력 · 시장 분위기 · 5개 에이전트별 반응 · 분석 신뢰도 · 불확실성 · 종합 해설**을
JSON 으로 반환하는 Python **FastAPI** 서비스입니다.

- **직접적인 매수·매도 추천이나 구체적 미래 가격 예측은 제공하지 않습니다.** (교육용 시장 반응 분석)
- LLM 으로는 로컬 **Ollama** 를 사용하며, **Ollama 가 꺼져 있어도** rule-based fallback 으로 정상 응답을 반환합니다.
- **stateless** 분석 API 입니다. 자체 DB 가 없으며(`db_save_status` 는 항상 `not_used`), 결과 저장은 Node backend + MongoDB 단계의 책임입니다.

---

## 디렉토리 구조

```
simulator/market_reaction/
├── app/
│   ├── main.py              # FastAPI 엔트리포인트 + /health
│   ├── config.py            # pydantic-settings 설정 (.env 선택적)
│   ├── service.py           # /simulate 파이프라인 오케스트레이션
│   ├── api/routes.py        # POST /simulate, GET /simulations/{id}
│   ├── schemas/             # 요청/응답/분석 단계 데이터 계약 (Pydantic)
│   ├── core/                # 분석 로직 (LLM + fallback)
│   │   ├── validator.py         # 입력값 적합성 분류
│   │   ├── external_context.py  # 외부 시장 맥락 분석 (LLM/fallback)
│   │   ├── realtime_context.py  # 실시간 맥락 분석 (rule-based)
│   │   ├── integrator.py        # StandardInput 통합
│   │   ├── agents.py            # 5개 에이전트 병렬 실행 (LLM/fallback)
│   │   ├── pressure.py          # 시장 압력 계산 (순수 함수)
│   │   ├── sentiment.py         # 시장 분위기 산출 (순수 함수)
│   │   ├── confidence.py        # 분석 신뢰도 계산 (순수 함수)
│   │   ├── summary.py           # 종합 해설 생성 (LLM/fallback)
│   │   └── fallback.py          # LLM 없이 동작하는 deterministic 대체 로직
│   └── services/
│       ├── llm_client.py    # Ollama /api/chat 비동기 client
│       └── stock_data.py    # 시세 stub (외부 시세 API 미연동)
├── tests/                   # pytest (오프라인 fallback 경로 포함)
├── docs/                    # 백엔드/프롬프트/fallback 명세, 테스트 픽스처
├── requirements.txt
└── .env.example
```

> 세부 데이터 계약은 `docs/market_reaction_backend_spec.md`, `docs/prompts_spec.md`,
> `docs/fallback_rules.md`, `docs/test_fixtures.json` 를 따릅니다.

---

## 실행 방법

```bash
cd simulator/market_reaction
conda activate SIM_API          # 사용하는 가상환경
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

- `.env` 가 없어도 기본값으로 실행됩니다. 필요하면 `.env.example` 을 복사해 `.env` 로 사용하세요.
- 환경변수(대소문자 무시):

  | 변수 | 기본값 | 설명 |
  |------|--------|------|
  | `API_HOST` | `0.0.0.0` | 바인딩 호스트 |
  | `API_PORT` | `8002` | 포트 |
  | `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama 주소 |
  | `OLLAMA_MODEL` | `llama3.1:8b` | 사용 모델명 |
  | `OLLAMA_TIMEOUT_SECONDS` | `120` | LLM 호출 timeout |
  | `OLLAMA_MAX_RETRIES` | `1` | LLM 호출 재시도 횟수 |
  | `OLLAMA_TEMPERATURE` | `0.3` | LLM 기본 temperature |

> `API_HOST` / `API_PORT` 는 설정값으로 보관될 뿐, 실제 바인딩은 위 `uvicorn` 명령의
> `--host` / `--port` 인자로 결정됩니다.

### 테스트

```bash
pytest tests -v
python -m compileall app tests
```

테스트는 `conftest.py` 의 `offline` fixture(닫힌 포트로 Ollama 연결 강제 실패)를 사용해
fallback 경로를 검증하므로, Ollama 가 없어도 통과합니다.

---

## API 명세

### `GET /health`

서비스 헬스체크. **Ollama 가 꺼져 있어도 항상 HTTP 200, `status: "ok"`** 를 반환합니다.
`ollama` 필드는 반드시 `"connected"` 또는 `"disconnected"` 중 하나입니다.

```bash
curl http://localhost:8002/health
```

```json
{
  "status": "ok",
  "service": "market-reaction",
  "version": "0.1.0",
  "ollama": "connected",
  "model": "llama3.1:8b"
}
```

Ollama 미연결 시 `"ollama": "disconnected"` 로만 바뀌고 나머지는 동일합니다.

### `POST /simulate`

시장 반응 시뮬레이션 본체.

- 정상 입력: **200** `SimulationResponse`
- 입력값 부적합: **422** `RejectedResponse`
- **Ollama 실패는 500 이 아니라 fallback 으로 200** 처리됩니다. (입력 자체가 부적합할 때만 422)

### `GET /simulations/{simulation_id}`

stateless 서비스이므로 **501 Not Implemented** 를 반환합니다. 결과 조회/저장은
후속 Node backend + MongoDB 단계에서 처리됩니다.

---

## 요청 / 응답 예시

### 요청 (`POST /simulate`)

```json
{
  "user_id": "test_user_001",
  "selected_stock": { "code": "000660", "name": "SK하이닉스" },
  "input_text": "SK하이닉스가 HBM 공급 계약을 확대하며 메모리 수요 증가가 기대된다는 소식",
  "input_type_hint": null
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `user_id` | string | ✅ | 로그인 사용자 식별자 |
| `selected_stock.code` | string | ✅ | 종목 코드 |
| `selected_stock.name` | string | ✅ | 종목명 |
| `input_text` | string | ✅ | 사용자 입력(뉴스/이벤트/시나리오 등) |
| `input_type_hint` | enum \| null | ❌ | 입력 유형 힌트. 없으면 시스템이 분류. 허용값: `real_news`, `hypothetical_scenario`, `company_information`, `industry_information`, `economic_market_event` |

### 정상 응답 (200)

아래는 **Ollama 가 꺼진 상태(전 모듈 fallback)** 에서 실제로 생성된 응답입니다.
`simulation_id` / `created_at` 및 LLM 정상 동작 시의 자연어·수치 값은 입력과 LLM 상태에 따라 달라집니다.

```json
{
  "status": "ok",
  "simulation_id": "sim_88cc97598a7e",
  "selected_stock": { "code": "000660", "name": "SK하이닉스" },
  "input_text": "SK하이닉스가 HBM 공급 계약을 확대하며 메모리 수요 증가가 기대된다는 소식",
  "input_type": "industry_information",
  "impact_analysis": {
    "impact_direction": "positive",
    "impact_direction_ko": "긍정",
    "impact_strength": "medium",
    "impact_strength_ko": "중간",
    "related_industries": ["반도체"],
    "time_horizon": "mid_term",
    "time_horizon_ko": "중기",
    "key_keywords": ["증가 관련 긍정 요인", "확대 관련 긍정 요인", "계약 관련 긍정 요인"]
  },
  "current_stock_context": {
    "code": "000660",
    "name": "SK하이닉스",
    "industry": "반도체",
    "current_price": 178000,
    "daily_change_rate": 2.3,
    "volume_trend": "increasing",
    "market_cap_trillion": 130.0,
    "data_source": "stub",
    "is_realtime": false,
    "observed_at": null
  },
  "market_pressure": {
    "buy": 69,
    "sell": 0,
    "hold": 31,
    "dominant": "buy",
    "headline": "현재 시장은 매수 우세 흐름입니다."
  },
  "market_sentiment": {
    "code": "positive",
    "label_ko": "긍정적",
    "one_liner": "긍정적 반응이 우세하지만 일부 관망·신중 심리도 함께 존재합니다."
  },
  "analysis_confidence": {
    "score": 0.305,
    "grade": "low",
    "grade_ko": "낮음",
    "explanation": "분석 신뢰도는 '낮음' 수준입니다. 현재 시세가 stub 데이터라 데이터 완전성 점수가 낮게 반영되었습니다. 7개 모듈이 fallback으로 처리되어 일부 감점되었습니다. 이 값은 입력 정보의 구체성과 분석 일관성 등을 종합한 참고 지표이며, 실제 시장 예측의 정확도를 보장하지 않습니다."
  },
  "uncertainty_factors": [
    "LLM 분석 미수행으로 상세 불확실성 미평가",
    "사용자 입력 정보의 사실 여부 미확인",
    "뚜렷한 내부 리스크 신호 없음"
  ],
  "agent_reactions": [
    {
      "agent_type": "individual_investor",
      "agent_name_ko": "개인 투자자",
      "reaction_direction": "buy",
      "reaction_direction_ko": "매수",
      "reaction_strength": "high",
      "reaction_strength_ko": "높음",
      "base_weight": 0.2,
      "input_relevance": "high",
      "key_reasons": ["테마 기대감", "뉴스 주목도"],
      "comment": "긍정적 뉴스에 매수 관심이 높아질 수 있습니다.",
      "risk_factors": ["단기 과열 가능성"]
    }
    // ... institutional_investor, foreign_investor, short_term_investor, long_term_investor (항상 5개, 고정 순서)
  ],
  "overall_explanation": "입력 정보는 전반적으로 긍정적 영향으로 해석되며, ... 사용자는 ... 주요 불확실성 요소를 함께 고려하여 모의투자 판단을 수행할 필요가 있습니다.",
  "meta": {
    "llm_model": "llama3.1:8b",
    "llm_status": "fallback",
    "fallback_used": true,
    "fallback_modules": [
      "external_context",
      "agent:individual_investor",
      "agent:institutional_investor",
      "agent:foreign_investor",
      "agent:short_term_investor",
      "agent:long_term_investor",
      "summary"
    ],
    "stock_data_source": "stub",
    "db_save_status": "not_used"
  },
  "created_at": "2026-06-07T00:00:00Z"
}
```

#### 주요 enum 값

- `impact_direction`: `positive` / `negative` / `neutral`
- `impact_strength`, `reaction_strength`: `low` / `medium` / `high`
- `time_horizon`: `short_term` / `mid_term` / `long_term`
- `reaction_direction`, `market_pressure.dominant`: `buy` / `sell` / `hold`
- `input_relevance`: `low` / `normal` / `high` (압력 계산 시 0.8 / 1.0 / 1.2 로 환산)
- `market_sentiment.code`: `very_positive` / `positive` / `neutral` / `negative` / `very_negative` / `uncertain`
- `analysis_confidence.grade`: `high`(≥0.75) / `medium`(≥0.50) / `low`
- `meta.llm_status`: `ok`(fallback 0개) / `partial_failure`(1~6개) / `fallback`(7개 전부)
- `meta.db_save_status`: 항상 `not_used`

> 시장 압력의 5개 에이전트 고정 가중치(`base_weight`)는 코드 상수입니다:
> 개인 0.20 · 기관 0.25 · 외국인 0.25 · 단기 0.15 · 장기 0.15.
> 사용자 보유 상태/평균 매입가/손익 상태는 에이전트 판단과 압력 계산에 **사용하지 않습니다.**

### 거절 응답 (422)

```json
{
  "status": "rejected",
  "reason_code": "DIRECT_ADVICE_REQUEST",
  "message": "본 기능은 직접적인 매수·매도 추천을 제공하지 않습니다."
}
```

거절 사유(rule-based 분류, `app/core/fallback.py`):

| reason_code | 조건 | message |
|-------------|------|---------|
| `DIRECT_ADVICE_REQUEST` | "지금 사야/팔아야", "매수/매도 추천", "사도 되" 등 직접 투자 행동 요청 | 본 기능은 직접적인 매수·매도 추천을 제공하지 않습니다. |
| `TOO_SHORT_OR_VAGUE` | 입력 10자 미만 | 보다 구체적인 정보를 입력해 주세요. |
| `LOW_RELEVANCE` | 종목명·산업 키워드가 모두 없음 | 입력 내용이 선택 종목과 관련성이 낮습니다. 다시 입력해 주세요. |
| `UNANALYZABLE` | 동일 문자 6회 이상 반복, 한글 자모 단독 나열 등 무의미 문자열 | 분석할 수 없는 입력입니다. |

> "오를까/내릴까/어떻게 반응할까" 같은 **시장 반응 질문은 거절하지 않습니다.**
> 사용자의 투자 행동을 직접 결정해 달라는 요청만 거절합니다.

---

## Fallback 정책

LLM 호출 단계는 **외부 맥락(1) + 에이전트(5) + 종합 해설(1) = 총 7개** 입니다.

- **모듈 단위 격리**: 한 단계의 LLM 호출/파싱/검증이 실패하면 **그 모듈만** `app/core/fallback.py`
  의 deterministic 로직으로 대체되고, 나머지는 LLM 결과를 유지합니다.
  (에이전트는 5개 중 일부만 실패하면 해당 에이전트만 fallback)
- **항상 완주**: Ollama 가 완전히 꺼져 있어도 7개 모듈 전부 fallback 으로 채워 **200** 을 반환합니다.
- **입력 검증은 별도**: 현재 `validator.py` 는 LLM 분류를 쓰지 않고 항상 rule-based(`fallback_classify_input`)
  로 동작합니다. 입력이 부적합하면 fallback 이전 단계에서 **422** 로 거절합니다.
- **시세는 stub 고정**: `stock_data.py` 는 외부 시세 API 를 호출하지 않고 stub 데이터만 반환합니다.
  (`data_source: "stub"`, `is_realtime: false`) 그래서 신뢰도에서 데이터 완전성이 항상 낮게 반영됩니다.
- **메타 반영**:
  - `meta.fallback_modules` 에 fallback 처리된 모듈명이 기록됩니다. (`external_context`, `agent:<type>`, `summary`)
  - `meta.llm_status`: 0개 → `ok`, 1~6개 → `partial_failure`, 7개 전부 → `fallback`.
  - 분석 신뢰도는 **fallback 모듈 1개당 -0.05**, **stub 시세 사용 시 -0.10** 감점됩니다.
- **순수 계산은 fallback 무관**: 시장 압력/분위기/신뢰도(`pressure`/`sentiment`/`confidence`)는
  LLM 을 쓰지 않는 순수 함수이며, 에이전트 출력(LLM 또는 fallback)을 입력으로 동일하게 동작합니다.
- **출력 가드레일**: fallback 자연어 출력은 모두 시장 반응 설명형 한국어이며, 직접 매수/매도 추천
  문구나 구체적 가격 예측을 포함하지 않습니다.

---

## Node backend proxy 연동 방식

Node(Express) 백엔드가 프론트엔드 요청을 받아 이 Python 서비스로 **그대로 프록시**합니다.
(`server/src/controller/marketReaction.controller.ts`, `server/src/routes.ts`)

- **라우트**: `POST /api/market-reaction/simulate` → Python `POST /simulate`
- **대상 주소**: 환경변수 `MARKET_REACTION_URL` (기본값 `http://127.0.0.1:8002`)
- **요청 매핑**: Node 가 `user_id`, `selected_stock`, `input_text`, `input_type_hint` 를 전달.
  - `user_id` 가 없으면 `"test_user_001"` 로 보정
  - `input_type_hint` 가 없으면 `null` 로 전달
- **입력 가드**: Node 단에서 `input_text` 가 비어 있으면 Python 호출 없이 **400** 반환.
- **상태코드 보존**: `validateStatus: () => true` 로 설정해 **Python 이 정한 상태코드/본문을 그대로 전달**합니다.
  (정상 200, 거절 422, fallback 200 등을 변형하지 않음)
- **timeout**: Node axios 호출 timeout 은 **120초**.
- **연결 실패 처리**: Python 서비스에 연결하지 못하면(네트워크/타임아웃) Node 가 **503** 과
  안내 메시지(`"시장 반응 분석 서비스(Python)에 연결하지 못했습니다..."`)를 반환합니다.

요청 흐름:

```
프론트엔드
  → POST /api/market-reaction/simulate (Node:Express)
    → POST {MARKET_REACTION_URL}/simulate (Python:FastAPI, 8002)
      → 200 SimulationResponse / 422 RejectedResponse
    ← (Python 상태코드·본문 그대로 전달, 연결 실패 시 503)
```

---

## 개발 시 주의사항

- **stateless 원칙 유지**: 이 서비스에서 DB 저장/조회를 추가하지 마세요. `db_save_status` 는 항상
  `not_used` 이고, 저장은 Node backend + MongoDB 의 책임입니다. `GET /simulations/{id}` 는 501 입니다.
- **사용자 보유 상태 미사용**: 보유 수량/평균 매입가/손익 상태는 에이전트 프롬프트, StandardInput,
  시장 압력 계산 어디에도 넣지 마세요. (의도적 설계)
- **추천·가격 예측 금지**: 모든 LLM 프롬프트와 fallback 문구는 직접 매수/매도 추천과 구체적 가격
  예측을 금지합니다. 새 문구를 추가할 때도 시장 반응 설명형으로 작성하세요.
- **프롬프트 인젝션 방어**: 사용자 입력은 `wrap_user_content()` 로 `<user_content>` 태그에 감싸고,
  시스템 프롬프트에 `PROMPT_INJECTION_GUARD` 를 포함합니다. 사용자 텍스트를 LLM 에 넘길 때
  이 helper 를 거치세요.
- **LLM 실패는 예외가 아니라 fallback**: `llm_client.chat_json` 은 실패 시 `LLMError` 를 던지며,
  **각 호출부(`core/*`)가 try/except 로 받아 fallback 으로 대체**합니다. 라우트에서 500 을 내지 마세요.
  (입력 부적합 → 422, LLM 실패 → 200 fallback)
- **데이터 계약 우선**: 응답 필드/enum 은 `app/schemas/` 와 `docs/market_reaction_backend_spec.md`
  (섹션 15) 의 계약과 1:1 로 맞춥니다. 필드를 바꾸면 Node proxy(상태코드 그대로 전달)와 프론트가
  영향을 받습니다.
- **enum 은 `schemas/analysis.py` 에 중앙화**: 순환 import 를 피하기 위해 enum 은 이 파일에서만 정의하고
  다른 schema 모듈이 import 합니다.
- **에이전트는 항상 5개, 고정 순서**: `AGENT_ORDER`(개인→기관→외국인→단기→장기) 를 유지하고
  `base_weight` 는 LLM 이 아니라 코드 상수(`BASE_WEIGHTS`)로 주입합니다.
- **시세 stub**: 실제 시세 API 연동 전 단계입니다. stub 종목은 `005930`(삼성전자), `000660`(SK하이닉스)
  이며 그 외는 default stub 을 사용합니다. 실연동 시 `stock_data.py` 와 `data_source`/`is_realtime`/
  `observed_at` 표기를 함께 갱신하세요.
- **오프라인 테스트**: 새 LLM 모듈을 추가하면 `conftest.py` 의 `offline` fixture 로 fallback 경로
  테스트를 함께 추가하세요. Ollama 없이도 `pytest tests` 가 통과해야 합니다.
