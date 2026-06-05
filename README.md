# 📈 ANTITUDE

## AI 기반 투자 판단 학습 플랫폼

ANTITUDE는 초보 투자자의 투자 의사결정 능력 향상을 목표로 개발된 AI 기반 투자 학습 플랫폼입니다.

기존 모의투자 서비스가 단순 수익률 경쟁에 집중하는 것과 달리, ANTITUDE는 사용자의 투자 판단 과정 자체를 분석하고 학습시키는 데 초점을 둡니다.

사용자는 실시간 모의투자와 과거 금융 이벤트 기반 시나리오 학습을 통해 투자 의사결정을 연습할 수 있으며, AI로부터 자신의 판단에 대한 교육적 피드백을 받을 수 있습니다.

---

# 🎯 프로젝트 목표

투자 초보자는 다음과 같은 어려움을 겪습니다.

* 뉴스를 어떻게 해석해야 하는지 모름
* 주가 변동 원인을 이해하기 어려움
* 매수/매도 판단 근거를 세우기 어려움
* 투자 결과는 알 수 있지만 판단 과정은 평가받지 못함

ANTITUDE는 이러한 문제를 해결하기 위해

* 시장 이해
* 뉴스 해석
* 리스크 분석
* 투자 전략 수립

능력을 학습할 수 있는 환경을 제공합니다.

---

# 🚀 주요 기능

## 실시간 모의투자

* 국내 주식 시세 조회
* 종목 검색
* 매수 / 매도 주문
* 포트폴리오 관리
* 수익률 분석
* 호가창 조회

---

## 뉴스 기반 투자 학습

사용자는 최신 금융 뉴스와 시장 데이터를 확인한 후 투자 결정을 내릴 수 있습니다.

* 뉴스 조회
* 종목 관련 정보 제공
* 시장 상황 분석

---

## 시나리오 기반 투자 훈련

과거 실제 금융 이벤트를 기반으로 투자 판단을 연습할 수 있습니다.

예시

* 코로나19 팬데믹
* 글로벌 금융위기
* 금리 인상 사이클
* 반도체 업황 변화
* 지정학적 리스크

사용자는 당시 상황을 재현한 시나리오를 보고

* 매수
* 매도
* 관망

중 하나를 선택하고 투자 근거를 작성합니다.

---

## AI 투자 판단 피드백

사용자의 답변을 AI가 분석하여 다음 항목을 평가합니다.

* 시장 이해도
* 리스크 판단
* 근거 적절성
* 전략 적합성

이를 통해 사용자는 자신의 투자 사고 과정을 개선할 수 있습니다.

---

# 🏗️ 시스템 구조

## Frontend

* React
* TypeScript
* Chakra UI
* Axios
* Highcharts

## Backend

* Node.js
* Express
* TypeScript
* MongoDB
* Mongoose

## AI

* Ollama
* Qwen 2.5

## Data Source

* 한국투자증권 KIS Open API
* 금융 뉴스 데이터
* 과거 시장 데이터

---

# 📂 프로젝트 구조

```text
app/
 ├─ components/
 ├─ pages/
 └─ services/

server/
 ├─ controller/
 ├─ models/
 ├─ services/
 └─ utils/

simulator/
 ├─ data/
 ├─ scripts/
 └─ training/
```

---

# ⚙️ 실행 방법

## Frontend

```bash
cd app
npm install
npm run dev
```

## Backend

```bash
cd server
npm install
npm run dev
```

---

# 🔑 환경 변수

```env
MONGODB_URI=

JWT_SECRET=

KIS_APP_KEY=
KIS_APP_SECRET=

OLLAMA_URL=http://localhost:11434
```

---

# 💡 차별점

기존 모의투자 서비스

* 결과 중심 평가
* 수익률 위주 학습

ANTITUDE

* 투자 판단 과정 평가
* 뉴스 해석 능력 향상
* 시나리오 기반 학습
* AI 교육 피드백 제공

---

# 🎓 Capstone Design Project

2026 Capstone Design

뉴스·시나리오 기반 주식 투자 판단 학습 시스템

Team ANTITUDE
