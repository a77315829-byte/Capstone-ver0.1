# 서버 구조와 책임

## 실행 경계

```text
Browser :5173
    │ /api
    ▼
Node BFF :3010
    ├── MongoDB ── 계정, 국내·미국 모의투자
    ├── KIS/Naver ── 시세, 주문용 시장 데이터, 뉴스
    ├── Scenario :8000 ── 시나리오 세션, 주문, 결정론적 평가
    ├── Market reaction :8002 ── 시장 반응 분석, 로컬 Ollama/RAG
    └── AI judgment :8003 ── 실시간 종목 판단, 로컬 Ollama
```

`start.bat`은 위 프로세스를 하나의 프로그램으로 합치지 않는다. `run.py`가 선택한 프로세스를
같이 시작하고 종료하며, 서비스별 장애와 의존성을 분리한다. 기능별 `scenario`, `realtime`,
`trading` 프로필도 이 경계를 그대로 사용한다.

## 코드 소유권

| 경로 | 책임 |
| --- | --- |
| `server/src/app.ts` | Express 미들웨어, rate limit, 최상위 라우터 조립 |
| `server/src/index.ts` | DB 연결 시작, HTTP listen, 종료 신호 처리, Swagger 시작 |
| `server/src/routes.ts` | Node가 직접 소유한 인증·주식·거래·뉴스 라우트 |
| `server/src/routes/scenarioProxy.routes.ts` | 시나리오 서비스 BFF 계약 |
| `server/src/routes/aiJudgmentProxy.routes.ts` | 실시간 판단 서비스 BFF 계약 |
| `server/src/config/downstream.ts` | 하위 서비스 URL과 timeout의 단일 설정 위치 |
| `server/src/services/downstreamProxy.service.ts` | 하위 HTTP 상태 전달 및 네트워크 오류의 `502`/`504` 변환 |
| `services/scenario-server` | 시나리오 원본, 세션 상태, 주문, 점수와 피드백, 평가 기록 |
| `services/market-reaction` | 입력 기반 시장 반응 분석 |
| `services/ai-judgment-service` | 감시 종목의 판단과 이력 |

하위 서비스가 반환한 정상·검증 오류 상태코드는 BFF가 그대로 전달한다. 연결 자체가 실패하면
`502 DOWNSTREAM_UNAVAILABLE`, 제한 시간을 넘기면 `504 DOWNSTREAM_TIMEOUT`으로 통일한다.
기본 제한 시간은 헬스 체크 3초, 시나리오 30초, 생성형 분석 120초이며 `server/.env`에서
조정할 수 있다. Node와 Vite 개발 서버는 기본적으로 `127.0.0.1`에만 bind한다. 별도 서버나
컨테이너에서 공개해야 할 때만 `STOTRA_SERVER_HOST=0.0.0.0`과 앞단 접근 제어를 명시한다.

## 평가엔진 경계

Node는 시나리오 답변을 채점하지 않고 시나리오 서비스로 전달한다. 점수와 검증된 근거는
`evaluator`, 피드백 내용 선택은 `feedback_planner`, 문장 표현은 `feedback_renderer`가 맡는다.
현재 채점은 결정론적 규칙이고 문장 렌더러는 템플릿이다. 자체 Evidence/Relation 모델은
`services/scenario-server/scoring`의 계약 뒤에 shadow 모드로 연결한다. 자세한 내용은
[평가엔진 문서](EVALUATION_ARCHITECTURE.md)에 있다.

## 배포 전 확인할 경계

- 실제 Atlas의 DB 이름, 컬렉션 수, 인덱스는 아직 확인하지 않았다. 현재 사용자 스키마는
  가입 전 username 중복 조회에 의존하고 password에 과거의 unique 선언이 남아 있다.
  username 고유 인덱스 추가와 password 인덱스 제거는 기존 중복 및 실제 인덱스를 읽기
  전용으로 확인한 뒤 별도 DB 마이그레이션으로 처리해야 한다.
- 현재 시나리오 진행도 API의 `userId`는 기존 웹 계약대로 URL에서 받는다. 인터넷에 공개하기
  전에는 JWT 사용자와 URL 사용자가 같은지 BFF에서 강제해야 한다. 이 변경은 게스트/시연
  계정 규칙을 확정한 뒤 적용한다.
- 실제 KIS·Turnstile·Atlas 키를 사용한 로그인과 국내·미국 주문은 아직 end-to-end로
  검증하지 않았다.
- Swagger는 `http://127.0.0.1:3010/api/docs`, 통합 상태 점검은
  `py -3.11 run.py --status`에서 확인한다.
