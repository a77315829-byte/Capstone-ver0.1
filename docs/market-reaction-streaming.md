# 시장 반응 분석 중간 결과 표시

`master`의 통합 서버 구조에 시장 반응 SSE 기능을 추가했다. 기존 JSON API와 최종 결과 형식은 유지한다.

## 사용자 화면

- 현재 처리 단계와 경과 시간을 표시한다.
- 입력 영향 분석이 끝나면 먼저 표시하고, 투자자 5명의 반응을 완료 순서대로 추가한다.
- 교차 검토 후 시장 압력·분위기를 표시하고, 마지막에 기존 최종 결과 화면으로 전환한다.
- 중간 결과에는 `분석 중 · 최종 결과가 달라질 수 있음`을 표시한다. 규칙 대체 결과에는 `기본 규칙`을 표시한다.
- 최종 신뢰도와 종합 해설은 완료 후 제공한다. 미완료 값을 0%로 채우거나 임의 진행률을 표시하지 않는다.
- 분석 취소, 창 닫기, 종목 변경, 화면 이탈 시 요청을 취소한다. 이전 요청이 새 화면을 덮어쓰지 않는다.
- 입력 거절·시간 초과·연결 중단을 안내하며 자동으로 분석을 재요청하지 않는다.

총 추론 시간을 줄이는 변경은 아니다. 완료된 분석부터 전달해 기다리는 동안 확인할 수 있게 한다. 모델·프롬프트·LLM 호출 횟수는 변경하지 않는다.

## 적용 및 실행

`app`, `server`, `services/market-reaction` 변경을 함께 적용한다. 기존 환경변수·MongoDB Atlas·KIS·Ollama 설정을 그대로 사용한다. 새 환경변수나 패키지는 필요하지 않다.

이미 설정된 환경에서는 최신 코드를 받은 뒤 기존 서버를 종료하고 저장소 루트에서 다시 실행한다.

```powershell
.\start.bat
```

설치·환경변수 안내는 [전체 기능 로컬 실행 방법](RUN_LOCAL.md)을 따른다. Ollama도 기존 방식으로 실행한다. 운영 빌드를 사용하는 환경은 프론트와 Node를 다시 빌드한 뒤 배포해야 한다.

## API와 제한 시간

| 경로 | 동작 |
|---|---|
| Node `POST /api/market-reaction/simulate/stream` | 기존 요청 JSON을 받아 Python SSE를 즉시 전달 |
| Python `POST /simulate/stream` | 단계·중간 결과·최종 결과를 SSE로 전달 |
| 기존 Node `/api/market-reaction/simulate`, Python `/simulate` | 기존 JSON 응답 유지 |

SSE 이벤트는 `progress`, `context`, `agent`, `aggregate`, `result`, `error`다. `result`에는 기존 `SimulationResponse` 전체가 들어간다. 스트리밍 시작 이후 오류는 `error` 이벤트로 전달된다. 최종 이벤트 없이 연결이 닫히면 실패로 처리한다.

Python은 10초 간격으로 heartbeat를 보내며 분석 제한은 110초다. Node는 기존 `MARKET_REACTION_URL`과 `MARKET_REACTION_TIMEOUT_MS`를 사용한다. 스트림의 Node 제한 시간은 초기 KIS 조회를 포함하며 기본 120초다. 클라이언트 연결이 끊기면 Python의 진행 중 작업까지 취소한다.

별도 프록시가 있다면 SSE 응답을 버퍼링하지 않아야 한다. Node와 Python 응답에는 `X-Accel-Buffering: no`를 설정했다.

## 검증 방법

```powershell
# services/market-reaction 에서, 기존 가상환경 사용
python -m pytest -q

# server 에서
node --test -r ts-node/register tests/marketReactionStream.test.ts
npm run test:proxy

# app 에서 (스트림 테스트는 Node 22.6 이상, 검증 환경은 Node 24)
node --experimental-strip-types --test tests/marketSimulationStream.test.mts
npm run build
```

스트림 테스트는 중간 전달, 기존 JSON 응답과 최종 결과의 동등성, 완료 순서, 한글 UTF-8·CRLF 분할, 인증 헤더, 취소와 하위 작업 정리, 거절·오류·시간 초과를 검증한다. PC·태블릿 화면 검증에는 예시 응답을 사용했다. 실제 Ollama·KIS·Atlas 연결, 추론 시간 비교, 전시회 동시 부하는 별도 운영 검증이 필요하다.
