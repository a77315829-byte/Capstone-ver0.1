# 📈 Stotra - 뉴스·시나리오 기반 주식 투자 판단 학습 시스템

## 프로젝트 소개

Stotra는 초보 투자자를 위한 AI 기반 투자 학습 플랫폼입니다.

기존 모의투자 서비스가 단순히 수익률 경쟁에 집중하는 것과 달리, 본 프로젝트는 사용자의 투자 의사결정 과정 자체를 학습하고 평가하는 것을 목표로 합니다.

사용자는 실시간 모의투자와 과거 금융 이벤트 기반 시나리오 학습을 통해 투자 판단을 연습할 수 있으며, AI로부터 자신의 투자 근거와 판단에 대한 교육적 피드백을 받을 수 있습니다.

---

## 주요 기능

### 1. 실시간 모의투자

* 국내 주식 실시간 시세 조회
* 종목 검색
* 매수 / 매도 주문
* 포트폴리오 관리
* 수익률 확인
* 호가창 조회

### 2. 과거 시나리오 학습

과거 실제 금융 이벤트를 기반으로 투자 판단을 연습할 수 있습니다.

예시

* 코로나19 팬데믹
* 러시아-우크라이나 전쟁
* 금리 인상 사이클
* 반도체 업황 변화
* 금융위기 사례

사용자는 당시 뉴스와 시장 상황을 보고

* 매수
* 매도
* 관망

중 하나를 선택하고 투자 근거를 작성합니다.

---

### 3. AI 투자 판단 피드백

사용자의 투자 판단을 분석하여

* 시장 이해도
* 리스크 판단
* 투자 근거 적절성
* 전략 적합성

항목별 피드백을 제공합니다.

---

### 4. 투자 성과 분석

* 거래 기록 관리
* 포트폴리오 평가
* 투자 학습 이력 저장
* 사용자별 학습 결과 분석

---

## 시스템 구조

Frontend

* React
* TypeScript
* Chakra UI
* Axios
* Highcharts

Backend

* Node.js
* Express
* TypeScript
* MongoDB
* Mongoose

AI

* Ollama
* Qwen 2.5
* 금융 시나리오 해설 생성

데이터

* 한국투자증권 KIS Open API
* 뉴스 데이터
* 과거 시장 데이터

---

## 프로젝트 구조

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

## 실행 방법

### Frontend

```bash
cd app
npm install
npm run dev
```

### Backend

```bash
cd server
npm install
npm run dev
```

### Environment Variables

```env
MONGODB_URI=

JWT_SECRET=

KIS_APP_KEY=
KIS_APP_SECRET=

OLLAMA_URL=http://localhost:11434
```

---

## 차별점

기존 모의투자 서비스

* 수익률 중심
* 투자 결과만 평가

Stotra

* 투자 판단 과정 평가
* 뉴스 해석 능력 학습
* 리스크 분석 훈련
* AI 기반 교육 피드백 제공

---

## Capstone Project

2026 Capstone Design Project

뉴스·시나리오 기반 주식 투자 판단 학습 시스템

Developed by Team Stotra
