[GitHub 소스와 학교용 PRIVATE ZIP 구분]
GitHub 소스에는 실제 .env와 API 키가 없습니다. 각 서비스의 .env.example을 참고해
본인 설정을 준비하거나 별도로 전달받은 .env를 옮기세요. docs/EXHIBITION.md를 참고하세요.
아래의 '설정 포함' 안내는 별도로 전달한 학교용 PRIVATE ZIP에만 해당합니다.

[최신 추가 보완: 시간외 지정가 / 보유 수익률 / 장 마감 순위]
국장·미장 지정가를 정규장과 지원하는 시간외 세션에 30초 간격으로 자동 확인합니다.
최근 실제 시세가 확인되고 지정가 조건을 만족할 때만 모의체결합니다. 시장가는 정규장만 지원합니다.
마이페이지 수익률은 현재 보유분 매입금액 대비 평가손익이며, 현금·원금·실현손익은 별도입니다.
장 마감에도 최근 저장 순위를 조회하고, 기준 시각과 집계 기간을 표시합니다.
검증 상세: docs/EXTENDED-HOLDINGS-20261117.txt / docs/RANKING-CLOSED-20261117.txt

[모바일 / 투자성과 최종 보완]
모바일 검색·보유주식·AI 화면과 마이페이지 손익 계산을 보완했습니다.
전체 거래 이력과 충전/환전 원금을 반영하며 PC 배치·색상은 유지합니다.
검증 상세: docs/MOBILE-PERFORMANCE-20261117.txt

[최신 추가 안내 / 2026-11-17]
AI 판단 DB 연결이 복구되었습니다. 이전 문서의 '판단 DB 미연결' 제한은 해결되었습니다.
서버만 켜면 삼성전자/SK하이닉스/현대차/NAVER/카카오를 상시 감시합니다.
AI 라면은 저장된 최근 결과를 먼저 표시하고 뒤에서 갱신합니다.
이번 ZIP의 .env를 그대로 쓰면 됩니다. 자세한 검증: docs/ALWAYS-WATCH-20261117.txt

ANTITUDE 학교 전시용 / Windows 64비트 / 학교 Wi-Fi 접속 지원

이번 ZIP은 같은 로컬 네트워크의 다른 PC/휴대폰에서도 접속할 수 있는 설정입니다.
학교 PC에서 설치 후 enable-school-lan.bat을 관리자 권한으로 한 번 실행하세요.
접속 주소는 show-school-address.bat에서 확인합니다. 외부 인터넷 공개 설정은 없습니다.

1. ZIP 전체를 로컬 폴더에 압축 해제합니다. ZIP 안에서 직접 실행하지 마세요.
   예: C:\ANTITUDE\Capstone-ver0.1

2. 아래 프로그램을 최초 한 번 설치합니다.
   - Node.js 22.23.2 (node-v22.23.2-x64.msi)
     https://nodejs.org/download/release/v22.23.2/
   - Python 3.12 (Windows installer 64-bit, Add python.exe to PATH 체크)
     https://www.python.org/downloads/release/python-31210/
   - Ollama for Windows
     https://ollama.com/download/windows
   설치 후 새 창에서 실행하세요. 기존에 다른 Python 버전이 있다면
   python --version이 3.12인지 확인하세요.

3. setup-exhibition.bat을 더블클릭합니다.
   웹/서버 패키지 설치와 빌드, Python 가상환경 설치,
   qwen2.5:1.5b 및 bge-m3 다운로드를 순서대로 처리합니다.
   Ollama 프로그램 설치는 2번에서 먼저 해야 합니다. 모델은 이 단계에서 자동으로 받습니다.
   인터넷과 모델 저장 공간이 필요하며 첫 설치는 시간이 걸립니다.
   오류가 나면 원인을 해결한 후 같은 파일을 다시 실행하면 됩니다.

4. 서버 PC를 학교 Wi-Fi에 연결합니다.
   enable-school-lan.bat을 우클릭 → 관리자 권한으로 실행합니다(최초 한 번).
   현재 PORT의 Node.js 웹 접속만 같은 서브넷에서 허용합니다. 방화벽을 끄지 않습니다.
   관리자 권한을 쓸 수 없다면 학교 담당자에게 이 파일의 실행을 요청하세요.

5. start-exhibition.bat을 더블클릭하고 창을 켜 둡니다.
   브라우저에서 http://localhost:3010 에 접속합니다.
   이후 실행부터는 이 파일만 실행하면 됩니다. 종료는 실행 창에서 Ctrl+C.
   별도의 npm run dev / uvicorn 실행은 필요하지 않습니다.
   웹 화면+API(3010), 과거시나리오(8000), 시장시뮬(8002), AI 라면(8003)을 함께 시작합니다.
   Ollama는 이미 실행 중이면 재사용하고, 꺼져 있으면 자동으로 시작합니다.

6. show-school-address.bat을 더블클릭합니다.
   Same Wi-Fi / Wi-Fi 옆의 http://주소:3010 을 다른 기기 브라우저에 입력합니다.
   예: http://192.168.0.10:3010 (예시일 뿐이며 실제 표시 주소를 사용하세요.)
   다른 기기도 같은 학교 Wi-Fi에 연결해야 합니다. 방문 기기는 브라우저만 있으면 됩니다.
   다른 기기에서 localhost를 입력하면 서버 PC에 연결되지 않습니다.
   학교로 이동하거나 IP가 변경되면 서버를 다시 켜고 주소를 다시 확인하세요.

7. 실행 상태 확인은 check-exhibition.bat을 더블클릭합니다.
   web/database, scenario, market, judgment, ollama 모두 OK인지 확인하세요.
   판단 DB 연결은 복구된 상태입니다. UNAVAILABLE이면 학교 네트워크와 DB 접속 허용을 확인하세요.

설정
- 학교용 ZIP은 .env 3개와 .env.exhibition을 포함합니다. 수동 복사/수정 불필요.
- 개인 PC의 Ollama 실행/모델 절대 경로는 제거했습니다.
- 기존 웹/시나리오 DB, 실제 API 키, 검증한 AI 모델 설정을 유지합니다.
- 설치는 DB를 초기화하거나 seed를 실행하지 않습니다.
- AI_MODE=auto: 실제 AI 우선, 실패/시간 초과 시 알고리즘 대체.
- 학교 PC 속도에 따라 AI 응답 시간이 달라집니다.
- Atlas DB/시세/뉴스/Gemini는 인터넷이 필요합니다.
- DB 연결 오류 시 Atlas의 학교 공인 IP 허용과 학교 네트워크 제한을 확인하세요.
- 이번 ZIP은 HOST=0.0.0.0 / NETWORK_ACCESS=lan 설정입니다.
- 웹 포트만 공유하며 Python 서비스와 Ollama는 127.0.0.1에 유지합니다.
- 별도 앱 프로젝트와 외부 인터넷 공개는 이번 패키지 범위에 포함되지 않습니다.

포트 충돌 / 접속 문제
- 다른 PC의 3010과 내 PC의 3010은 IP가 다르므로 충돌하지 않습니다.
- 서버 PC에서 이미 다른 프로그램이 3010을 사용하면 실행 시 충돌 안내가 나옵니다.
  이전 전시 실행 창이 남아 있으면 그 창에서 Ctrl+C로 종료하세요.
  다른 프로그램이 필요한 경우 .env.exhibition의 PORT=3010을 PORT=3020 등으로 변경하고,
  enable-school-lan.bat을 관리자 권한으로 다시 실행한 뒤 서버를 시작하세요.
  접속 주소도 :3020으로 바뀝니다. AI 포트와 서비스 URL은 변경하지 않습니다.
- 같은 Wi-Fi 이름이어도 학교가 기기 간 통신을 차단하거나 다른 서브넷을 배정하면
  접속할 수 없습니다. 학교 담당자에게 전시용 기기 간 통신 허용망을 요청하세요.
- 공유기 포트 포워딩이나 외부 터널 설정은 하지 않습니다.
- LAN 사용을 끝내려면 서버 종료 후 .env.exhibition에서 NETWORK_ACCESS=local,
  HOST=127.0.0.1로 바꾸고 disable-school-lan.bat을 관리자 권한으로 실행하세요.
  이 파일은 ANTITUDE가 추가한 규칙만 제거합니다. 다음 실행부터 PC 내부 전용입니다.
- 자세한 설정/검증 범위: docs/SCHOOL-LAN-20261117.txt

이 ZIP에는 실제 DB 비밀번호와 API 키가 있습니다.
개인 USB 등으로 옮기고 GitHub, 공개 링크, 단체 채팅에 올리지 마세요.
