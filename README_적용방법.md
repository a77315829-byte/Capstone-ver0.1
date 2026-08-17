# Antitude 차트 통합 패치

이번 패치는 아래 3개 작업을 **한 번에** 적용합니다.

2. 실시간 차트 레이아웃 변경
3. AI 라면을 차트 오른쪽 주문 영역으로 이동
4. 시장 반응 시뮬레이터를 차트 상단 버튼 + Modal로 변경

추가로 Sidebar에서 `AI 라면`, `시장반응 시뮬레이터` 메뉴만 숨깁니다.
기존 `/ai-judgment`, `/simulator` 라우트는 삭제하지 않습니다.

## 수정되는 파일

- `app/src/pages/DomesticExchange.tsx`
- `app/src/components/AiRamenPanel.tsx`
- `app/src/components/MarketSimulatorPanel.tsx`
- `app/src/components/navigation/Sidebar.tsx`

각 파일 옆에 자동 백업 파일이 생성됩니다.

예:
`DomesticExchange.tsx.before_chart_redesign.bak`

## 적용 방법

1. ZIP을 풉니다.
2. `apply_chart_ai_simulator_patch.py` 파일 하나를 `Capstone-ver0.1` 폴더 바로 안에 복사합니다.

```text
Capstone-ver0.1/
  app/
  server/
  services/
  apply_chart_ai_simulator_patch.py
```

3. PowerShell에서 저장소 루트로 이동합니다.

```powershell
cd C:\dev\PycharmProjects\Capstone-ver0.1
```

4. 실행합니다.

```powershell
python .\apply_chart_ai_simulator_patch.py
```

5. 완료 후 프론트 빌드:

```powershell
cd .\app
npm run build
```

## 바뀌는 화면 동작

- 차트는 기존처럼 넓게 유지
- 오른쪽 기본 패널은 주문
- `AI 라면 ›` 클릭 시 오른쪽 주문 패널이 AI 판단 패널로 교체
- AI 패널의 `←` 클릭 시 주문 패널로 복귀
- 상단 `시장 반응 시뮬레이터 ›` 클릭 시 기존 시뮬레이터 UI가 Modal로 열림
- 시장 반응 분석 로직/API와 기존 결과 UI는 보존

## 이전에 잘못 보낸 ZIP

이전 답변의 `antitude_steps_2_3_4.zip`은 이번 디자인 2/3/4 작업과 관계없는 파일입니다.
이번 작업에는 사용하지 않아도 됩니다.

현재 스크립트는 GitHub `main`의 최신 구조를 기준으로 작성했습니다.
로컬 파일이 `main`과 크게 다르면 임의로 계속 수정하지 않고 `[FAIL]`에서 멈추도록 했습니다.
