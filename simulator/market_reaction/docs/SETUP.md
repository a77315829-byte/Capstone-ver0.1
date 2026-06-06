# SETUP.md — 개발 환경 설정

> **이 문서의 목적**
> Claude Code가 프로젝트를 처음 세팅할 때 참고하는 환경 설정 명세.
> 로컬 개발 환경만 대상. Docker 불필요.

---

## 1. 시스템 요구사항

- **OS**: macOS / Linux / Windows (WSL2 권장)
- **Python**: 3.11 이상 (3.12 권장)
- **Ollama**: 최신 버전 (https://ollama.com)
- **Git**: 버전 관리용

---

## 2. Ollama 설치 및 모델 준비

```bash
# 1. Ollama 설치 (macOS)
brew install ollama

# 1. Ollama 설치 (Linux)
curl -fsSL https://ollama.com/install.sh | sh

# 2. Ollama 서버 시작 (별도 터미널)
ollama serve

# 3. Llama 3.1 8B 모델 다운로드 (약 4.7GB)
ollama pull llama3.1:8b

# 4. 모델 동작 확인
ollama run llama3.1:8b "Hello, respond in JSON: {\"status\": \"ok\"}"
```

> **중요**: `ollama serve`가 떠 있어야 API 호출이 가능하다.
> 기본 포트는 `http://localhost:11434`.
> GPU가 없으면 CPU로 동작하지만 응답이 느리다 (8b 기준 CPU: 30~120초, GPU: 3~10초).

---

## 3. 프로젝트 초기화

```bash
# 프로젝트 디렉토리 생성
mkdir finsight-sim-api
cd finsight-sim-api

# Python 가상환경
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt
```

---

## 4. requirements.txt

이 내용으로 `requirements.txt` 생성:

```
# Web framework
fastapi==0.115.6
uvicorn[standard]==0.34.0

# Data validation
pydantic==2.10.4
pydantic-settings==2.7.1

# HTTP client (Ollama 호출용 - 비동기)
httpx==0.28.1

# Database
sqlalchemy==2.0.36
aiosqlite==0.20.0

# Testing
pytest==8.3.4
pytest-asyncio==0.25.0

# Utilities
python-dotenv==1.0.1
```

---

## 5. 환경변수 (.env)

프로젝트 루트에 `.env` 파일 생성:

```env
# === Ollama 설정 ===
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# === Ollama 호출 설정 ===
OLLAMA_TIMEOUT_SECONDS=120
OLLAMA_MAX_RETRIES=1
OLLAMA_TEMPERATURE=0.3

# === 데이터베이스 ===
DATABASE_URL=sqlite+aiosqlite:///./finsight_sim.db

# === 서버 ===
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=true
```

---

## 6. config.py 구현 가이드

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Ollama
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_timeout_seconds: int = 120
    ollama_max_retries: int = 1
    ollama_temperature: float = 0.3

    # Database
    database_url: str = "sqlite+aiosqlite:///./finsight_sim.db"

    # Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = True

    class Config:
        env_file = ".env"

settings = Settings()
```

> `pydantic-settings`는 `requirements.txt`에 추가 필요: `pydantic-settings==2.7.1`

---

## 7. 서버 실행

```bash
# 개발 모드 (자동 리로드)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 실행 확인
curl http://localhost:8000/health
# → {"status": "ok", "ollama": "connected", "model": "llama3.1:8b"}
```

---

## 8. 테스트 실행

```bash
# 전체 테스트
pytest tests/ -v

# 순수 함수 테스트만 (Ollama 불필요)
pytest tests/test_pressure.py tests/test_sentiment.py tests/test_confidence.py -v

# E2E 테스트 (Ollama 필요, 의미 방향성 검증용 통합 테스트)
pytest tests/test_e2e_sample.py -v

# Offline E2E 테스트 (Ollama 꺼진 상태, fallback 파이프라인 검증)
pytest tests/test_e2e_offline_fallback.py -v
```

---

## 9. 디렉토리 구조 (최종)

```
finsight-sim-api/
├── .env
├── .gitignore
├── requirements.txt
├── README.md
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app, 라우터, /health, startup event
│   ├── config.py               # Settings (pydantic-settings)
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py           # POST /simulate, GET /simulations/{id}
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── request.py          # SimulationRequest
│   │   ├── standard_input.py   # StandardInput (에이전트 공통 입력)
│   │   ├── agent_output.py     # AgentOutput
│   │   └── response.py         # SimulationResponse (최종 JSON)
│   ├── core/
│   │   ├── __init__.py
│   │   ├── validator.py        # 입력값 적합성 확인
│   │   ├── external_context.py # 외부 시장 맥락 분석
│   │   ├── realtime_context.py # 실시간 모의투자 맥락 분석
│   │   ├── integrator.py       # 분석 결과 통합
│   │   ├── agents.py           # 5개 에이전트 (비동기 병렬)
│   │   ├── pressure.py         # 시장 압력 (순수 함수)
│   │   ├── sentiment.py        # 시장 분위기 (순수 함수)
│   │   ├── confidence.py       # 신뢰도/불확실성
│   │   └── summary.py          # 종합 해설
│   ├── services/
│   │   ├── __init__.py
│   │   ├── llm_client.py       # Ollama 호출 래퍼 (비동기)
│   │   └── stock_data.py       # 시세 stub
│   └── db/
│       ├── __init__.py
│       ├── models.py           # SQLAlchemy 모델
│       └── repository.py       # 저장/조회
├── tests/
│   ├── __init__.py
│   ├── conftest.py             # pytest fixtures
│   ├── test_pressure.py        # 시장 압력 단위 테스트
│   ├── test_sentiment.py       # 시장 분위기 단위 테스트
│   ├── test_confidence.py      # 신뢰도 단위 테스트
│   ├── test_validator.py       # 입력 검증 테스트
│   ├── test_e2e_sample.py      # 통합 테스트
│   └── test_e2e_offline_fallback.py # Ollama 없이 fallback E2E
├── fixtures/
│   └── test_fixtures.json      # 테스트 데이터
└── docs/
    ├── market_reaction_backend_spec.md
    ├── prompts_spec.md
    ├── fallback_rules.md
    └── SETUP.md
```

---

## 10. .gitignore

```
__pycache__/
*.pyc
.venv/
.env
*.db
.pytest_cache/
```

---

## 11. /health 엔드포인트 구현 가이드

`app/main.py`에 Ollama 연결 확인용 헬스체크 포함:

```python
@app.get("/health")
async def health():
    # Ollama 연결 확인
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.ollama_host}/api/tags")
            ollama_status = "connected" if resp.status_code == 200 else "error"
    except Exception:
        ollama_status = "disconnected"

    return {
        "status": "ok",
        "ollama": ollama_status,
        "model": settings.ollama_model
}
```

---

## 12. SQLite 초기화

개발용 SQLite는 앱 시작 시 SQLAlchemy 모델 기준으로 테이블을 생성한다. Alembic 마이그레이션은 MVP 필수 범위가 아니다.

```python
@app.on_event("startup")
async def on_startup():
    await init_db()
```

`init_db()`는 `app/db/models.py`의 `Base.metadata.create_all`을 비동기 엔진으로 실행한다.

---

## 13. 주의사항

- `ollama serve`가 꺼져 있으면 LLM 의존 모듈이 전부 fallback으로 동작한다. 테스트는 통과하지만 출력 품질이 떨어진다.
- 8b 모델은 VRAM 6GB 이상 권장. Metal (macOS) / CUDA (Linux) 자동 감지.
- SQLite는 개발용. 동시 쓰기가 많아지면 PostgreSQL로 교체. (`DATABASE_URL`만 바꾸면 됨)
- `.env` 파일은 git에 올리지 않는다.
