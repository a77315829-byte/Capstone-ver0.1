# ANTITUDE 전시 실행 안내

**학교용 PRIVATE ZIP을 받은 경우:** 실제 `.env`와 학교용 `.env.exhibition`이 이미 포함되어 있다. `README-SCHOOL.txt`에 따라 프로그램 설치 → `setup-exhibition.bat` → `start-exhibition.bat` 순서로 실행한다. 아래 수동 환경변수 복사는 일반 소스 ZIP을 사용하는 경우의 안내다. PRIVATE ZIP은 외부에 공개하지 않는다.

기준: v1116 기반 전시 보완본 / 2026-11-19 GitHub 반영. 최신 거래·수익률·순위 동작은 [시간외 및 보유 수익률](EXTENDED-HOLDINGS-20261117.txt), [장 마감 순위](RANKING-CLOSED-20261117.txt)를 참고한다. 외부 인터넷 배포는 이번 작업에 포함하지 않았다.

## 1. 처음 준비할 때

Node.js 22(검증: 22.23.2), Python 3.12, 필요하면 Ollama를 설치한다. Python 3.10~3.12를 지원 범위로 검사하며 3.13 이상은 기존 FAISS 의존성과 맞지 않을 수 있다. 명령은 app/server 안이 아니라 이 저장소 최상위에서 실행한다.

기존 server/.env, 시나리오·판단·시장 서비스의 .env는 각자 보관한 원본을 해당 폴더로 옮긴다. 비밀키를 GitHub에 올리지 않는다.

```powershell
npm run setup
```

이 명령은 Node 의존성 설치·빌드, Python 서비스별 .venv 생성·설치를 처리하고 .env.exhibition이 없을 때만 생성한다. JWT 비밀키와 서비스 간 통신키는 임의 값으로 생성한다. 기존 DB 이름은 감지되면 이어받는다. **.env.exhibition의 실제 URI와 DB 이름을 기존 설정과 반드시 비교한다.** 설치는 DB에 접속하거나 전시 데이터를 삭제·초기화하지 않는다.

환경변수 우선순위: 운영체제 환경변수 > .env.exhibition의 비어 있지 않은 값 > server/.env. Python 서비스의 기존 .env는 공통 설정에 없는 값을 보충한다. **DB 주소는 예외적으로 서비스별 기존 주소를 보존한다.** 시나리오는 SCENARIO_MONGODB_URI → 시나리오 .env의 MONGODB_URI → 공통 MONGODB_URI, 판단은 JUDGMENT_MONGODB_URI → 판단 .env의 MONGO_URI → 공통 MONGODB_URI 순서다. 서로 다른 기존 DB를 의도 없이 같은 DB로 바꾸지 않는다.

- MONGODB_URI 또는 기존 STOTRA_MONGODB_USERNAME/PASSWORD/CLUSTER를 설정한다.
- MONGO_DB_NAME: 기존 웹 계정·모의투자 DB.
- SCENARIO_DB_NAME: 기존 시나리오·퀴즈 진행 DB.
- JUDGMENT_DB_NAME: 기존 AI 판단 이력 DB.
- STOTRA_KIS_APP_KEY/SECRET, STOTRA_KIS_ENV 등 실제 시세 키는 기존 값 유지.
- STOTRA_DART_API_KEY: DART 재무정보 조회 키. 본인의 server/.env에 설정한다. GitHub에는 키가 없으며, 학교용 PRIVATE ZIP에는 별도로 준비한 설정이 포함되어 있다.
- GEMINI_API_KEY를 쓰면 시나리오 해설에서 사용한다. 없으면 기존 규칙 피드백으로 동작한다.
- AUTH_CAPTCHA_MODE=disabled는 명시적인 로컬 전시 설정이다. 공개 호스팅 시 실제 Turnstile 키와 접근 정책을 별도로 구성한다.

Ollama를 사용할 경우 모델은 미리 내려받는다. 저장 공간과 다운로드 시간이 필요하다.

```powershell
ollama pull qwen2.5:1.5b
ollama pull bge-m3
```

bge-m3는 공시 RAG 임베딩용이다. 기존에 다른 모델을 사용했다면 OLLAMA_MODEL, STOTRA_LLM_MODEL, SALARY_AI_MODEL 등을 그 이름으로 설정한다. 기존 RAG 자료·MongoDB rag_chunks/rag_manifest가 없다면 모델 설치만으로 공시 자료가 생기지는 않는다.

현재 개인 PC 점검에는 RAM 약 8GB 환경에 맞춰 qwen2.5:1.5b와 bge-m3를 사용했다. 작은 모델은 복잡한 JSON 분석의 정확도·성공률이 낮을 수 있으며, 원래 7B/8B 모델의 실행 성능을 검증한 것은 아니다. 설치형 Ollama가 PATH에 없으면 OLLAMA_EXECUTABLE에 공식 실행 파일 경로를 지정할 수 있다.

**학교 PC에는 개인 PC의 .env.exhibition을 그대로 덮어쓰지 않는다.** 개인 PC의 점검 설정에는 .qa 아래 휴대용 Ollama 실행 파일/모델의 절대 경로가 포함될 수 있다. GitHub 소스를 사용하는 경우 서비스별 .env를 준비한 뒤 setup으로 새 .env.exhibition을 만들고, 실제 DB 이름·모델·경로를 확인한다. GitHub에서 받은 소스 ZIP에는 실제 .env와 API 키가 없다. 별도로 전달한 학교용 PRIVATE ZIP에는 학교용으로 조정한 설정이 포함되어 있으므로 README-SCHOOL.txt를 따른다. 두 배포본 모두 모델과 설치 의존성은 설치 과정에서 내려받는다.

## 2. 한 PC에서 모두 실행

```powershell
npm start
```

또는 start-exhibition.bat을 실행한다. 접속: http://localhost:3010

한 명령이 Node 웹/API와 Python 세 서비스를 함께 관리한다. 여러 런타임을 하나의 프로세스로 합친 것은 아니다. React 빌드 결과를 Node가 함께 제공하므로 app의 Vite 개발 서버는 켜지 않아도 된다. 이미 실행 중인 포트가 있으면 중복 실행을 막는다. 이 창에서 Ctrl+C를 누르면 이 명령이 띄운 서비스만 종료한다. 이미 실행 중이던 Ollama는 종료하지 않는다.

코드를 수정했으면 실행 전에 npm run build를 사용한다.

## 3. 현재 전시 구성과 다른 기기 접속

현재 작업 범위는 **한 PC에서 웹 화면 제공, Node API, Python AI·시나리오 서비스와 Ollama를 함께 실행하는 구성**이다. 별도로 존재하는 앱 프로젝트는 후속 작업이며 이번 저장소 검토·통합 실행에 포함하지 않는다. 이 저장소의 app 폴더는 React 웹 프런트다.

| 대상 | 실행 방식 |
|---|---|
| 웹·AI용 PC | 최초 npm run setup → .env.exhibition 확인 → npm start |
| 별도 앱용 PC | 앱 프로젝트를 나중에 확인하고 실행 방법 결정 |

웹과 AI를 서로 다른 PC로 나누는 start:web / start:services는 선택적인 분리 실행 기능이다. 현재 전시 구성에서는 두 명령을 쓰지 않고 npm start를 사용한다.

내 PC의 웹 브라우저에서는 http://localhost:3010 으로 접속한다. 기본 설정은 다음과 같이 내부 서비스 주소를 모두 로컬로 유지한다.

```dotenv
HOST=127.0.0.1
SERVICE_HOST=127.0.0.1
SCENARIO_SERVICE_URL=http://127.0.0.1:8000
MARKET_REACTION_URL=http://127.0.0.1:8002
AI_JUDGMENT_SERVICE_URL=http://127.0.0.1:8003
OLLAMA_BASE_URL=http://127.0.0.1:11434
STOTRA_LLM_BASE_URL=http://127.0.0.1:11434
```

다른 기기의 **브라우저로 웹 전시를 볼 때만** HOST=0.0.0.0으로 바꾸고 웹·AI PC의 학교 IP와 3010 포트로 접속한다. SERVICE_HOST와 Python/Ollama 주소는 위의 로컬 설정 그대로 둔다. Windows 방화벽은 필요한 전시 기기에 3010 접근을 허용하도록 운영자가 확인한다. 이번 작업에서 방화벽이나 공유기 설정은 변경하지 않았다.

같은 Wi-Fi여도 학교의 단말 격리 때문에 접속이 막힐 수 있다. 다른 기기 접속은 학교가 허용하는 네트워크에서 확인해야 한다. 외부 인터넷 접속은 별도 HTTPS 호스팅/인증/네트워크 설계가 필요한 후속 작업이다.

별도 앱이 이 웹 API를 공유하는지, 독립적인 서버를 사용하는지는 앱 코드를 확인한 뒤 정한다. 웹 접속 안내를 별도 앱의 실행 방법으로 간주하지 않는다.

## 4. AI가 없거나 느릴 때

```dotenv
AI_MODE=rules
```

설정을 바꾸고 재실행하면 시장·판단 Python 서비스와 Ollama를 자동 시작하지 않고 Node의 규칙 결과를 사용한다. 시나리오 서비스와 실제 MongoDB는 계속 필요하다. auto는 정상 서비스에 먼저 요청하고 연결 실패/시간 초과 시 대체한다.

| 기능 | 대체 동작 | 저장 |
|---|---|---|
| 시장 반응 | 뉴스 키워드와 참여자 규칙으로 결과 생성, 규칙 기반 표시 | 기존과 같이 분석 결과는 별도 저장 안 함 |
| AI 판단/비교 | 확보한 시세의 등락률 구간으로 계산, 시세 없으면 자료 부족·관망 표시 | 서비스가 없을 때 가짜 판단 이력 생성 안 함 |
| 자금 플래너 | 입력 예산과 기존 계산식, 규칙 기반 문구 표시 | 정상 MongoDB에 결과 저장 |
| 자산 조언·주식 도우미 | 기존 기본 설명으로 대체, LLM 대기시간 제한 | 해당 기능의 기존 방식 유지 |
| 시나리오 | 기존 규칙 채점/피드백, rules 모드에서 Gemini 생략 | 정상 MongoDB에 진행 저장 |

AI_MODE=rules는 인터넷 전체 없이 모든 기능이 동작한다는 의미가 아니다. Atlas DB·실시간 시세·뉴스는 해당 연결이 필요하다. DB 장애를 가짜 저장 성공으로 바꾸지 않는다. auto 모드의 주식/플래너/자산 분석 제한은 60초다. 시장 분석은 이 PC에서 실제 AI 응답 약 75초를 확인했으며, 하드웨어와 동시 사용에 따라 달라진다. 빠른 전시 진행이 우선이면 rules를 미리 선택한다.

시장 Python 분석 전체는 110초 제한 후 남은 작업을 취소한다(MARKET_PIPELINE_TIMEOUT_SECONDS). Node는 120초, 시장 화면 요청만 130초 제한을 적용한다. 다른 프런트 요청은 기존 95초 제한이다. 다섯 투자자 관점은 하나의 구조화 요청으로 생성하고 각각 검증한다. 규칙 대체는 계속 유지한다.

## 5. 당일 점검

```powershell
npm run doctor
```

각 서비스의 health 응답을 확인한다. rules 모드에서 사용하지 않는 AI 서비스/Ollama는 UNAVAILABLE이어도 대체 기능을 사용할 수 있다. health OK만으로 모델 다운로드, RAG 자료, 모든 DB 컬렉션, 서비스 공통키가 검증되는 것은 아니다.

판단 서비스 health는 실제 MongoDB ping 결과를 포함한다. 2026-11-17 개인 PC 점검에서는 기존 판단 DB 호스트가 NXDOMAIN으로 조회됐으며, 사용자 요청에 따라 새 주소를 받기 전까지 원본을 유지했다. 따라서 현재 judgment: UNAVAILABLE 표시는 예상된 상태이고 해당 기능은 규칙 대체로 동작한다. 웹/시나리오 주소는 Windows 기본 DNS의 조회 결과를 이용해 동일 Atlas의 TLS 연결 주소로 변환하여 정상 연결했다. DNS 서버·방화벽·Atlas 접근 정책은 변경하지 않았다.

1. 서버 /api/health가 database: connected를 반환하는지 확인한다. Atlas 사용 시 학교 공인 IP 접근 허용과 학교 네트워크 차단 여부를 확인한다.
2. 테스트 계정 회원가입 → 로그인 → 로그아웃 → 재로그인을 확인한다. 실제 계정 정보는 MongoDB에 저장된다.
3. 시나리오 1턴 진행 후 새로고침해 이어지는지, 퀴즈 진행이 계정에 귀속되는지 확인한다.
4. 모의투자·게시글 등 실제 전시 기능을 소액 가상 데이터로 확인한다. 동일 계정에서 동시 주문을 반복하는 부하 테스트는 아직 별도 검증이 필요하다.
5. AI_MODE=rules로도 시장 분석·AI 판단·자금 플래너 결과가 나오는지 확인한다.
6. 다른 기기로 웹을 보여줄 계획이라면 웹·AI PC의 주소로 접속을 확인한다. 별도 앱 실행은 후속 작업이다. 공개 와이파이에 실제 다른 서비스의 비밀번호를 입력하지 않는다.
7. 전시 시작 전 DB 백업과 전시 종료 후 보관·삭제 담당/날짜를 확정한다. 자동 삭제 기능은 없다.

기존 시나리오 DB를 그대로 쓰면 seed를 다시 실행할 필요가 없다. 새 DB를 의도적으로 사용할 때만 npm run seed:scenario를 실행한다. 이 명령은 버전 관리된 콘텐츠를 upsert하므로 기존 콘텐츠 문서가 갱신될 수 있다. 과거 일봉 등 시세 데이터 수집은 기존 기술 문서의 별도 절차이며 seed만으로 생성되지 않는다.

## 6. 기존 실행 명령과 차이

| 기존 | 통합 실행 후 |
|---|---|
| app에서 npm run dev | 불필요: 빌드 파일을 Node 3010에서 제공 |
| server에서 npm run dev | launcher가 빌드된 Node 실행 |
| scenario uvicorn 8000 | 자동 실행 |
| ai-judgment uvicorn 8003 | auto 모드에서 자동 실행 |
| chatbot/market_reaction uvicorn 8002 | 이 저장소의 simulator/market_reaction을 자동 실행 |

기존 외부 chatbot 폴더를 수정했다면 그 변경사항은 이번 GitHub v1116 검토에 포함되지 않는다. .env·RAG 자료와 코드 차이를 옮기기 전에 비교한다.

Python을 수동 실행할 때도 EXHIBITION_SERVICE_KEY가 필요하다. 시나리오 API는 인증된 Node 경유로 사용한다. 직접 포트에 보내는 예전 호출은 401/403이 날 수 있다. 운영에서는 launcher 사용을 권장한다.

문제 해결: 포트 충돌 → 예전 터미널 종료 / 401·403 → 내부 서비스 공통키·로그인 확인 / DB 연결 실패 → URI·DB 이름·Atlas 허용 IP 확인 / 중복 아이디 오류 → 기존 users 중복 레코드를 운영자가 확인. 자동 병합·삭제하지 않는다.

## 재무정보 및 실제 AI 최종 확인 (2026-11-17)

삼성전자·SK하이닉스 공식 DART 연간/분기 재무제표 조회를 확인했다. KIS 재무 전용 API 오류는 남아 있어 DART를 우선 사용하고, 누락된 ROE·기간은 네이버 증권의 발표된 실적으로 보완한다. 컨센서스는 제외하며 출처를 표시한다. 네이버 공개 응답 구조가 바뀌거나 제공이 중단되면 해당 보완 값은 빠질 수 있다.

시가총액은 상세 화면에서 억원→원 단위를 교정했다. DART 당기 누적금액을 단일 분기 실적으로 표시하지 않도록 수정했다. 기존 재무표의 연간/분기 버튼·비교 기간 데이터를 연결했으며 배치와 색상은 유지했다. 없는 지표는 -로 남긴다.

실제 AI 확인: 자금 플래너 Ollama 약 26초, 자산 조언 약 18~20초, 과거 시나리오 실제 기준표의 Gemini 피드백 약 5초, 웹 시장 시뮬레이션 약 75초(공시 RAG 2건, fallback_used=false). AI 판단 DB는 새 설정을 받기 전까지 기존 주소와 규칙 대체를 유지한다.
