# 시나리오 기능 실행 방법

이 문서는 `feature/scenario-learning-feedback` 브랜치의 시나리오 화면과 서버를
현재 PC에서 실행하는 방법만 설명합니다.

## 현재 PC에서는 다시 설정하지 않아도 되는 것

- `server/.env`와 `services/scenario-server/.env`가 이미 있으며 필요한 값도 설정돼 있습니다.
- 두 파일의 MongoDB·JWT·Turnstile·KIS 설정이 기존 `Capstone-ver0.1` 설정과 같은지 값 노출 없이 확인했습니다.
- 이번 시나리오 변경으로 새로 추가해야 하는 환경변수는 없습니다.
- `app/node_modules`, `server/node_modules`, 각 Python 서비스의 `.venv`가 이미 있습니다.
- 실제 `.env`는 Git에서 제외되므로 브랜치를 전환하거나 푸시해도 변경·업로드되지 않습니다.
- 기존 Atlas 클러스터, DB 사용자와 데이터를 그대로 사용합니다. 새 클러스터나 사용자를 만들 필요가 없습니다.
- 저장소의 MIT `LICENSE`는 고지 파일이며 별도의 활성화·등록 절차가 없습니다.
- 시나리오 프로필은 Ollama, Gemini, OpenAI API가 필요하지 않습니다.
- 현재 DB에는 시나리오 데이터가 있으므로 `seed_database`를 다시 실행하지 않습니다.

따라서 현재 PC에서는 `setup.bat`, `scripts/migrate-env.ps1`, 시나리오 시드 명령을
다시 실행하지 않고 바로 시작하면 됩니다.

## 실행

PowerShell에서 다음 명령을 실행합니다.

```powershell
cd C:\dev\PycharmProjects\antitude
git switch feature/scenario-learning-feedback
.\start.bat --profile scenario
```

이 명령은 다음 세 프로세스를 함께 시작합니다.

| 주소 | 역할 |
| --- | --- |
| `http://127.0.0.1:5173` | 웹 화면 |
| `http://127.0.0.1:3010` | Node 로그인·API·시나리오 프록시 |
| `http://127.0.0.1:8000` | Python 시나리오·채점·학습 이력 서버 |

브라우저에서 `http://127.0.0.1:5173`을 열고 기존 계정으로 로그인합니다.
실행한 PowerShell에서 `Ctrl+C`를 누르면 세 프로세스가 함께 종료됩니다.

## 상태 확인

서버를 실행한 상태에서 새 PowerShell을 열고 다음을 실행합니다.

```powershell
cd C:\dev\PycharmProjects\antitude
.\start.bat --profile scenario --status
```

`scenario`, `api`, `web`이 모두 `OK`면 됩니다. 시나리오 DB가 연결되지 않으면
`DB unavailable`이 함께 표시됩니다.

## 기존 환경변수 사용 범위

시나리오 실행에서 실제로 사용하는 파일은 두 개입니다.

| 파일 | 그대로 사용하는 값 |
| --- | --- |
| `server/.env` | 기존 Atlas 접속 정보, DB 이름, JWT·Turnstile 설정 |
| `services/scenario-server/.env` | 기존 `MONGODB_URI`, `MONGODB_DATABASE`, KIS 설정 |

`services/market-reaction/.env`와 `services/ai-judgment-service/.env`는
`--profile scenario`에서 실행되지 않으므로 이번 확인에는 관여하지 않습니다.

`setup.bat`은 `.env`가 없을 때만 `.env.example`을 복사하므로 기존 파일을 덮어쓰지
않습니다. 다만 현재 PC에는 의존성이 이미 설치돼 있어 실행할 필요가 없습니다.

## 화면 확인 순서

1. 과거 시나리오 목록에서 시나리오를 시작합니다.
2. 한 턴을 제출하고 점수·백분율·한 줄 요약·판단 근거를 확인합니다.
3. 끝까지 완료하고 최종 결과와 마이페이지 학습 이력을 확인합니다.
4. 같은 계정으로 같은 시나리오를 다시 완료해 반복·감소·신규 실수 비교를 확인합니다.

같은 시나리오라도 평가 버전이 달라졌거나 이전 기록의 턴 근거가 부족하면 점수 변화를
억지로 비교하지 않고 비교 불가 이유를 표시합니다.

## Atlas 연결이 실패할 때만 확인할 것

새 Atlas 프로젝트나 라이선스를 만들지 않습니다. 기존 연결값을 그대로 둔 채 다음만
확인합니다.

1. 인터넷 연결 상태
2. Atlas Network Access에 현재 공인 IP가 허용돼 있는지
3. `services/scenario-server/.env`의 DB 이름이 기존 시나리오 DB 이름인지

공인 IP가 바뀐 경우에만 기존 Atlas 프로젝트의 Network Access 허용 주소를 갱신하면 됩니다.
