# ANTITUDE

투자 학습 웹의 국내·미국 모의투자, 과거 시나리오, 뉴스, 금융 퀴즈, AI 판단, 시장 반응 분석을 위한 코드입니다. [기존 Capstone-ver0.1](https://github.com/a77315829-byte/Capstone-ver0.1)의 `90fa87ef`에서 별도 작업본을 만들었습니다. 기존 저장소와 DB는 수정하지 않았습니다. 원본의 MIT 라이선스 고지를 보존합니다.

## 프로젝트 디렉터리

```text
antitude/
├── app/          # 투자 학습 웹: 국내·미국 투자, 시나리오, 뉴스, 퀴즈
├── server/       # Node API: 인증, 시세·주문, Python 서비스 연결
├── services/
│   ├── scenario-server/      # 시나리오 플레이·채점·피드백·학습 기록
│   ├── market-reaction/      # 시장 반응 분석·RAG
│   └── ai-judgment-service/  # 종목 판단·비교·이력
├── docs/         # 서버 구조, 평가엔진 구조, 정리·검증 기록
├── setup.py / setup.bat     # 전체 의존성 설치
├── run.py / start.bat       # 전체 또는 기능별 실행
├── README.md
└── LICENSE
```

투자 관련 화면·API·시드·가격 적재·테스트·개발 도구는 유지합니다. 국방 해커톤의
급여 계산기·자동 급여 입금·군 프로필·커뮤니티와 군 전용 학습 콘텐츠는 포함하지 않습니다.
`node_modules`, `.venv`, 빌드 산출물, 캐시, 실제 `.env`는 저장소와 배포 압축본에서 제외합니다.

## 실행 구조

| 프로세스 | 포트 | 역할 | 이 화면을 볼 때 필요 |
| --- | ---: | --- | --- |
| `app` (Vite) | 5173 | 웹 UI | 모든 화면 |
| `server` (Node/Express) | 3010 | 로그인, 주식·주문, `/api` 연결 | 대부분의 화면 |
| `services/scenario-server` (FastAPI) | 8000 | 시나리오·주문·평가·학습 이력 | 과거 시나리오 |
| `services/market-reaction` (FastAPI) | 8002 | 시장 반응 분석 | 시뮬레이터·거래 화면의 분석 패널 |
| `services/ai-judgment-service` (FastAPI) | 8003 | 종목 AI 판단·비교·이력 | AI 판단 화면 |

브라우저는 주로 Node의 `/api`로 요청하고 Node가 필요한 Python 서비스에 전달합니다. **한 번에 시작**해도 내부적으로는 이 다섯 개가 각각 실행됩니다. MongoDB는 별도 데이터 저장소이고 Ollama는 사용 설정에 따라 필요한 외부 프로세스입니다.

Node는 로그인·주식·거래 API를 직접 처리하고, 시나리오와 로컬 AI 요청은 전용 라우터를 통해
각 Python 서비스에 전달합니다. 하위 서비스 연결 실패는 `502`, 응답 시간 초과는 `504`로
통일했습니다. 자세한 코드 경계와 배포 전 확인 사항은 [서버 구조 문서](docs/SERVER_ARCHITECTURE.md)에
정리했습니다.

이 독립 저장소의 평가·설명 경로는 상용 LLM API를 사용하지 않습니다. 시나리오 평가는
결정론적 규칙과 템플릿 피드백으로 동작하고, 실시간 AI 판단과 시장 반응의 문장 생성은
로컬 Ollama만 사용합니다.

## Windows에서 설치와 시작

현재 PC에서 시나리오 기능만 확인하려면 Atlas나 `.env`를 다시 설정하지 말고
[시나리오 실행 방법](docs/RUN_SCENARIO.md)을 따르세요.

Node.js/npm 및 Python 3.11을 준비하고 저장소 루트에서:

```powershell
.\setup.bat
```

이 명령은 웹·Node 의존성 및 Python 서비스 3개의 독립 가상환경을 설치하고, 각 폴더에 `.env.example`을 복사해 `.env`를 만듭니다. **아래 설정을 먼저 검토**한 다음:

```powershell
.\start.bat
```

웹 주소는 `http://127.0.0.1:5173`입니다. 같은 터미널에서 `Ctrl+C`를 누르면 실행기가 시작한 서버들을 종료합니다. 포트에 이미 다른 프로세스가 있으면 자동으로 다른 포트를 고르거나 기존 프로세스를 종료하지 않고 오류를 보여줍니다.

### 필요한 설정

| 파일 | 설정할 항목 | 관련 기능 |
| --- | --- | --- |
| `server/.env` | `STOTRA_MONGODB_USERNAME`, `STOTRA_MONGODB_PASSWORD`, `STOTRA_MONGODB_CLUSTER`, `MONGO_DB_NAME`, `STOTRA_JWT_SECRET`, `STOTRA_TURNSTILE_SECRET` | 로그인, 사용자 데이터, 모의투자 |
| `server/.env` | `STOTRA_KIS_APP_KEY`, `STOTRA_KIS_APP_SECRET`; 뉴스 사용 시 `STOTRA_NAVER_CLIENT_ID`, `STOTRA_NAVER_CLIENT_SECRET` | 국내·미국 시세 및 뉴스 |
| `server/.env` | 필요 시 `STOTRA_SERVER_HOST`, `SCENARIO_SERVICE_TIMEOUT_MS`, `MARKET_REACTION_TIMEOUT_MS`, `AI_JUDGMENT_SERVICE_TIMEOUT_MS`, `DOWNSTREAM_HEALTH_TIMEOUT_MS` | bind 주소와 하위 서비스 제한 시간 |
| `services/scenario-server/.env` | `MONGODB_URI`, `MONGODB_DATABASE` | 시나리오 콘텐츠·세션·결과 |
| `services/ai-judgment-service/.env` | `OLLAMA_MODEL`; 필요하면 `KIS_APP_KEY`, `KIS_APP_SECRET` | 로컬 실시간 판단·설명; MongoDB 계정은 기본적으로 `server/.env`를 재사용 |
| `services/market-reaction/.env` | `OLLAMA_HOST`, `OLLAMA_MODEL`; RAG를 쓰려면 MongoDB 접속 정보와 자료 | 시장 반응 분석 |

기존 Atlas 데이터를 쓸 경우 `server/.env`의 `MONGO_DB_NAME`을 **실제 기존 DB 이름**으로 맞추세요. 템플릿의 `antitude`는 신규 DB 예시입니다. 시나리오 DB와 AI 판단 DB는 각자 별도 이름이므로, 새 `.env`를 복사했다고 이전 데이터가 자동으로 나타나지는 않습니다. 실제 비밀키나 `.env`는 Git에 올리지 않습니다.

### 기존 환경변수 옮기기

기존 프로젝트의 `.env`를 통째로 복사하면 제거한 Gemini/OpenAI·군 급여·커뮤니티 변수까지
따라옵니다. 아래 도구는 새 코드가 사용하는 키만 골라 네 서비스의 `.env`를 만들고,
Naver·KIS·MongoDB의 구형 키를 현재 이름으로 옮깁니다. 비밀값은 화면에 출력하지 않습니다.

```powershell
.\scripts\migrate-env.ps1 -SourceRoot C:\dev\PycharmProjects\Capstone-ver0.1
```

이미 새 `.env`가 있으면 작업을 중단합니다. 기존 파일을 백업하고 다시 만들려면 `-Force`를
붙입니다. 생성 후 각 `.env`의 DB 이름과 Ollama 모델을 확인하고 `git status`에 `.env`가
나타나지 않는지 확인하세요.

시나리오 JSON 콘텐츠만 준비할 때는 아래 명령을 **대상 DB를 확인한 후** 실행합니다. 실행 시 기존 DB에 쓰기가 발생하므로 자동 시작 과정에는 넣지 않았습니다. 실제 과거 일봉 적재는 [시나리오 서버 안내](services/scenario-server/README.md)를 따릅니다.

```powershell
cd services\scenario-server
.\.venv\Scripts\python.exe -m scripts.seed_database --scenario semiconductor
.\.venv\Scripts\python.exe -m scripts.seed_database --scenario growth_rate_hike_2022
.\.venv\Scripts\python.exe -m scripts.seed_database --scenario svb_bank_run_2023
cd ..\..
```

Ollama를 사용하는 경우 해당 서비스의 `.env`에 지정한 모델을 별도로 준비하고 Ollama 서버를 실행하세요. 시장 반응 서비스는 연결이 없어도 fallback 응답을 낼 수 있으나, 이때 LLM 설명이나 RAG 자료는 제한됩니다. AI 판단 서비스는 KIS 키가 없으면 시세 폴링을 시작하지 않습니다.

## 기능별 실행 및 점검

```powershell
.\start.bat --profile scenario  # 웹 + Node + 시나리오
.\start.bat --profile realtime  # 웹 + Node + 시장 반응 + AI 판단
.\start.bat --profile trading   # 웹 + Node (국내·미국 모의투자)
.\start.bat --only scenario     # Python 시나리오 API 하나만
.\start.bat --dry-run           # 실행할 서비스와 포트만 확인
py -3.11 run.py --status        # 다른 터미널에서 5개 HTTP 상태 확인
```

`--profile`로 빠진 서비스의 화면은 일부 기능이 동작하지 않습니다. `--status`의 HTTP 200은 서버 응답 확인입니다. 시나리오 DB가 `unavailable`이거나 시장 반응의 Ollama가 `disconnected`이면 같이 표시합니다. 실제 주문, DB 내용, 유료/외부 API, 모델 응답까지 보증하는 검사는 아닙니다.

## 변경 범위와 이전 데이터

- 웹의 투자 화면과 `/api` 호출 방식은 유지했습니다. 직접 주소로만 열리던 군 해커톤의 급여 계산기·커뮤니티와 오래된 시나리오 카탈로그 화면을 제거했습니다.
- 국내·미국 주식 화면이 호출했지만 Node에 연결되지 않았던 체결·투자자·호가 라우트 4개를 등록했습니다.
- 군 해커톤의 자동 급여 입금 코드가 투자 계좌 조회에서 실행되던 경로를 제거했습니다. 기존 DB의 계좌 잔액과 이전 입금 기록을 지우는 마이그레이션은 하지 않았습니다.
- 한 번에 실행하는 명령은 **설치, DB 시드, 데이터 적재, Ollama 시작을 자동 수행하지 않습니다.** 초기 설정과 데이터 준비는 각각 한 번 수행합니다.

자세한 분리 내역과 검증 범위는 [정리 기록](docs/CLEANUP.md), 평가엔진 도입 순서는
[평가엔진 문서](docs/EVALUATION_ARCHITECTURE.md)를 참고하세요.

## GitHub 저장소

독립 저장소는 [stakewant/antitude](https://github.com/stakewant/antitude)에 있습니다. 다른 PC에서 내려받을 때는 다음 명령을 사용합니다.

```powershell
git clone https://github.com/stakewant/antitude.git
```

원본 `a77315829-byte/Capstone-ver0.1`의 커밋 기록은 가져오지 않았고, 출처와 기존 라이선스는 이 저장소에 기록했습니다.
