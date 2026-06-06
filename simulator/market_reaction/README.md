# Market Reaction Simulator (신규)

## 목적

- 이 서비스는 신규 **시장 반응 시뮬레이션 FastAPI 서비스**입니다.
- 기존 `simulator/archive/simulator_hyunwoo/`(폐기된 Mesa 기반 ABM)와 **별개의 신규 구현**입니다.
- 사용자가 실시간 모의투자에서 선택한 종목 + 입력(뉴스/이벤트/시나리오)에 대해
  **시장 압력 · 시장 분위기 · 에이전트별 반응 · 분석 신뢰도 · 불확실성 · 종합 해설**을 반환합니다.
- **직접적인 매수·매도 추천이나 구체적 미래 가격 예측은 제공하지 않습니다.** (교육용 분석)
- 세부 구현은 `docs/` 명세(`market_reaction_backend_spec.md`, `prompts_spec.md`, `fallback_rules.md`, `test_fixtures.json`)를 기준으로 단계적으로 진행합니다.

## 현재 구현 상태

- ✅ Pydantic schemas (`app/schemas/`)
- ✅ 순수 계산 로직: pressure / sentiment / confidence (`app/core/`)
- ✅ fallback 로직 (`app/core/fallback.py`) — Ollama 없이도 동작
- ✅ FastAPI 골격 + `/health` (`app/main.py`, `app/config.py`)
- ⏳ 예정: LLM client, external/realtime 분석, integrator, agents, service 파이프라인, `/simulate`

## 실행 방법

conda 기준:

```bash
cd simulator/market_reaction
conda activate SIM_API
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

> `.env` 가 없어도 기본값으로 실행됩니다. 필요하면 `.env.example` 을 복사해 `.env` 로 사용하세요.

## health check

```bash
curl http://localhost:8002/health
```

Ollama 연결 시:

```json
{ "status": "ok", "service": "market-reaction", "version": "0.1.0", "ollama": "connected", "model": "llama3.1:8b" }
```

Ollama 꺼진 경우(서비스는 그대로 200):

```json
{ "status": "ok", "service": "market-reaction", "version": "0.1.0", "ollama": "disconnected", "model": "llama3.1:8b" }
```

## 테스트 실행

```bash
pytest tests -v
python -m compileall app tests
```

## 저장 정책

- 현재 Python 서비스는 **DB를 직접 사용하지 않는 stateless 분석 API**입니다. (SQLite/MongoDB 등 자체 DB 없음)
- 응답의 `db_save_status`는 service 단계에서 `not_used`로 처리할 예정입니다.
- 결과 저장은 후속 **Node backend + MongoDB** 연동 단계에서 처리합니다.
