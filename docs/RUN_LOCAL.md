# 전체 기능 로컬 실행 방법

이 문서는 `integration/clean-server-scenario` 브랜치에서 전체 투자 웹을 실행하는
방법을 설명합니다. 시나리오 UI·평가·학습 이력과 서버 실행 구조를 정리했으며,
실행할 때는 기존 국내·미국 투자, 시장 반응, AI 판단 기능도 모두 함께 켭니다.

## 현재 PC의 준비 상태

- 실제 `.env`는 Git에서 제외되므로 새 worktree나 clone에는 자동으로 생기지 않습니다.
- 아래 환경변수 이관 도구는 기존 MongoDB·JWT·Turnstile·KIS 값을 노출하지 않고 필요한 키만 옮깁니다.
- 이번 시나리오 변경으로 새로 추가해야 하는 환경변수는 없습니다.
- 기존 Atlas 클러스터와 데이터에 연결되므로 새 클러스터·사용자·라이선스를 만들 필요가 없습니다.
- 이관한 `.env`는 브랜치 전환이나 푸시에 포함되지 않습니다.
- 저장소의 MIT `LICENSE`는 고지 파일이며 별도의 활성화·등록 절차가 없습니다.

새 작업 폴더에서는 한 번만 다음 명령을 실행합니다. 이미 `.env`가 있으면 이관 도구가
덮어쓰지 않고 중단합니다.

```powershell
.\scripts\migrate-env.ps1 -SourceRoot C:\dev\PycharmProjects\antitude
.\setup.bat
```

기존 의존성 폴더까지 직접 옮겼다면 `setup.bat`은 생략할 수 있습니다. DB 시드는 기존
시나리오 데이터가 없는 경우에만 대상 DB 이름을 확인한 뒤 실행합니다.

## Ollama 상태

이 PC에서는 Ollama가 `127.0.0.1:11434`에서 실행 중이며 다음 모델이 준비돼 있습니다.

- `qwen3.5:4b`: 시장 반응과 AI 판단 문장 생성
- `bge-m3`: RAG 임베딩

두 AI 서비스의 `.env`도 `qwen3.5:4b`를 가리키고 있습니다. `ollama ps`가 빈 목록을
보여도 요청이 없어서 모델이 메모리에 올라오지 않은 상태일 뿐, Ollama 서버가 꺼진 것은
아닙니다. 아래 명령이 모델 목록을 반환하면 연결된 상태입니다.

```powershell
ollama list
```

PC를 재시작한 뒤 Ollama가 꺼져 있을 때만 별도 PowerShell에서 `ollama serve`를 먼저
실행합니다. `start.bat`은 앱 서버 5개를 관리하며 Ollama 자체는 종료하거나 재시작하지 않습니다.

## 전체 기능 실행

현재 시나리오 프로필을 실행 중이라면 그 터미널에서 먼저 `Ctrl+C`를 눌러 종료합니다.
그다음 PowerShell에서 실행합니다.

```powershell
cd C:\dev\PycharmProjects\Capstone-clean-server-scenario
git switch integration/clean-server-scenario
.\start.bat
```

`--profile`을 생략한 기본 실행이 전체 기능 모드입니다.

| 주소 | 역할 |
| --- | --- |
| `http://127.0.0.1:5173` | 웹 화면 |
| `http://127.0.0.1:3010` | Node 로그인·주식·주문·서비스 프록시 |
| `http://127.0.0.1:8000` | 시나리오·채점·학습 이력 |
| `http://127.0.0.1:8002` | 시장 반응 분석·RAG |
| `http://127.0.0.1:8003` | AI 판단·비교·이력 |
| `http://127.0.0.1:11434` | 기존 Ollama 백그라운드 서버 |

브라우저에서 `http://127.0.0.1:5173`을 열고 기존 계정으로 로그인합니다. 실행한
PowerShell에서 `Ctrl+C`를 누르면 `start.bat`이 시작한 앱 서버 5개가 함께 종료됩니다.

## 상태 확인

전체 서버를 실행한 상태에서 새 PowerShell을 열고 다음을 실행합니다.

```powershell
cd C:\dev\PycharmProjects\Capstone-clean-server-scenario
.\start.bat --status
```

`scenario`, `market`, `judgment`, `api`, `web`이 모두 `OK`면 됩니다. 시장 반응에
`Ollama disconnected`가 표시되면 `ollama list`를 확인합니다.

## 기존 환경변수 사용 범위

| 파일 | 기존 설정을 사용하는 기능 |
| --- | --- |
| `server/.env` | Atlas, 로그인, JWT·Turnstile, 국내·미국 시세·주문·뉴스 |
| `services/scenario-server/.env` | 시나리오 DB·가격 데이터 |
| `services/market-reaction/.env` | Ollama 시장 반응·RAG DB |
| `services/ai-judgment-service/.env` | Ollama AI 판단·이력 DB·KIS |

`setup.bat`은 `.env`가 없을 때만 예제 파일을 복사하므로 기존 파일을 덮어쓰지 않습니다.
그래도 현재 PC에는 의존성이 이미 설치돼 있어 실행할 필요가 없습니다.

## 시나리오 수정 확인 순서

1. 과거 시나리오 목록에서 시나리오를 시작합니다.
2. 한 턴을 제출하고 점수·백분율·한 줄 요약·판단 근거를 확인합니다.
3. 끝까지 완료하고 최종 결과와 마이페이지 학습 이력을 확인합니다.
4. 같은 계정으로 같은 시나리오를 다시 완료해 반복·감소·신규 실수 비교를 확인합니다.

## Atlas 연결이 실패할 때만 확인할 것

새 Atlas 프로젝트를 만들지 않습니다. 기존 연결값을 그대로 둔 채 인터넷 연결,
Atlas Network Access의 현재 공인 IP, 각 `.env`의 기존 DB 이름만 확인합니다. 공인 IP가
바뀐 경우에만 기존 Atlas 프로젝트의 Network Access 허용 주소를 갱신하면 됩니다.

시나리오 기능만 개발할 때는 `start.bat --profile scenario`를 쓸 수 있지만, 이 모드에서는
시장 반응과 AI 판단 서버가 꺼지므로 전체 기능 확인에는 사용하지 않습니다.
