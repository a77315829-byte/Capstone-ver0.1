# ai-judgment-service

앤티튜드 AI 판단(AI라면) 백엔드. 5단계 파이프라인으로 구성:

1. `app/triggers/` - 이벤트 트리거 (폴링 아님)
2. `app/factors/` - 사전 태깅된 요인 카탈로그 + 실시간 데이터 매칭 (결정론적)
3. `app/scoring/` - 마스터 루브릭 기반 가중치·신뢰도·판단 계산 (결정론적, LLM 없음)
4. `app/narrative/` - GPT-4o로 판단근거/비교 문장만 생성 (숫자는 절대 재계산하지 않음)
5. `app/history/`, `app/api/` - 이력 저장 및 FastAPI 응답

## 설치

Windows에서는 전용 가상환경과 의존성을 다음 명령으로 준비합니다.

```powershell
setup.bat
Copy-Item .env.example .env
```

기본 `.env.example`은 Ollama `qwen3.5:4b`를 사용합니다. `MONGO_URI`를 비워 두면
통합 저장소의 `server/.env`에 있는 Atlas 계정을 노출 없이 재사용하고,
`MONGO_DB_NAME=anttitude_ai_judgment`로 컬렉션을 분리합니다. 독립 실행에서는
`MONGO_URI`를 직접 지정합니다. OpenAI를 사용할 때만 `LLM_PROVIDER=openai`로 바꾸고
`OPENAI_API_KEY`를 입력합니다.

## 요인 카탈로그 시딩 (최초 1회)

```bash
python -m app.db.seed_factors
```

## 실행

```powershell
start.bat
```

직접 실행할 때는 다른 Python 서비스와 충돌하지 않도록 `8003`을 사용합니다.

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8003 --reload
```

- 상태 확인: `http://127.0.0.1:8003/health`
- API 문서: `http://127.0.0.1:8003/docs`

## 엔드포인트

- `GET  /judgment/{symbol}` - 최신 AI 판단 조회
- `POST /judgment/compare` - 사용자 판단 vs AI 판단 비교
- `GET  /judgment/{symbol}/history` - 판단 이력

## 테스트

```bash
pytest
```

## 서버 없이 파이프라인만 테스트

`uvicorn` 서버를 띄우지 않고도 `scripts/run_local.py`로 파이프라인을 직접 호출해볼 수 있다.

```bash
python -m scripts.run_local judge --symbol 011070
python -m scripts.run_local compare --symbol 011070 --user-judge 매수
```

`judge`는 샘플 시세 데이터로 AI 판단을 생성해 DB에 저장하고,
`compare`는 방금 생성된 AI 판단과 사용자 판단을 비교한다 (judge를 먼저 실행해야 함).

## 향후 확장

- 검수된 데이터가 쌓이면 `app/factors/catalog.py`의 요인 카탈로그를 버전별로 확장
- Ollama 후보와 OpenAI 후보를 같은 고정 테스트셋에서 비교
