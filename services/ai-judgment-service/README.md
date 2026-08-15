# ai-judgment-service

앤티튜드 AI 판단(AI라면) 백엔드. 5단계 파이프라인으로 구성:

1. `app/triggers/` - 이벤트 트리거 (폴링 아님)
2. `app/factors/` - 사전 태깅된 요인 카탈로그 + 실시간 데이터 매칭 (결정론적)
3. `app/scoring/` - 마스터 루브릭 기반 가중치·신뢰도·판단 계산 (결정론적, LLM 없음)
4. `app/narrative/` - GPT-4o로 판단근거/비교 문장만 생성 (숫자는 절대 재계산하지 않음)
5. `app/history/`, `app/api/` - 이력 저장 및 FastAPI 응답

## 설치

```bash
pip install -r requirements.txt
cp .env.example .env   # OPENAI_API_KEY, MONGO_URI 채우기
```

## 요인 카탈로그 시딩 (최초 1회)

```bash
python -m app.db.seed_factors
```

## 실행

```bash
uvicorn app.main:app --reload
```

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

- `app/narrative/router.py`에 로컬 모델(Qwen2.5/Ollama) 분기 추가
- `scripts/review_new_factors.py`로 뉴스 분류 확신도 낮은 케이스 검토 후
  `app/factors/catalog.py` 카탈로그 확장
