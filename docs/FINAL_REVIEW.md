# 최종 문서 검토 결과

## 1. 검토 결과 요약
- 구현 준비 상태: Ready
- 검토한 파일: `outputs/market_reaction_backend_spec.md`, `outputs/prompts_spec.md`, `outputs/fallback_rules.md`, `outputs/SETUP.md`, `outputs/test_fixtures.json`
- 수정한 파일: 위 5개 파일
- 발견한 문제 수: 12
- 해결한 문제 수: 12
- 남은 결정 사항 수: 0

## 2. 파일 간 정합성 검증
- 데이터 계약: 요청 JSON, ExternalContext, RealtimeContext, StandardInput, AgentOutput, MarketPressure, MarketSentiment, AnalysisConfidence, 최종 응답 JSON의 필드와 enum을 맞췄다.
- enum 및 한글 매핑: `test_fixtures.json`의 enum 매핑과 백엔드 명세의 매핑이 일치한다.
- 계산식: 시장 압력, 시장 분위기, 분석 신뢰도 계산 규칙과 테스트 픽스처가 일치한다.
- 최종 응답 JSON: `meta`, `current_stock_context`, `impact_analysis`, `market_pressure`, `market_sentiment`, `analysis_confidence`, `agent_reactions` 검증 항목을 E2E 픽스처에 반영했다.
- fallback 응답: fallback 에이전트 결과가 `AgentOutput.input_relevance: float` 계약을 만족하도록 문자열 enum을 숫자로 매핑한다.
- 테스트 픽스처: JSON 파싱이 정상이며 `_description`, `_note`는 테스트에서 무시 가능한 보조 필드로 유지했다.

## 3. 수학적 검증
- 대표 시장 압력 계산 과정 및 결과:
  - 개인: `3 * 0.20 * 1.2 = 0.72`
  - 기관: `2 * 0.25 * 1.0 = 0.50`
  - 외국인: `2 * 0.25 * 1.0 = 0.50`
  - 단기: `3 * 0.15 * 1.2 = 0.54`
  - 장기: `2 * 0.15 * 1.0 = 0.30`
  - 매수 합계 `1.76`, 매도 합계 `0`, 관망 합계 `0.80`, 전체 `2.56`
  - 정수 반올림 및 보정 후 `buy=69`, `sell=0`, `hold=31`
- 시장 압력 합계 100 검증: 모든 pressure fixture 계산 결과 합계가 100이다.
- 대표 분석 신뢰도 계산 과정 및 결과:
  - `1.0*0.20 + 1.0*0.20 + 0.3*0.20 + 1.0*0.25 + 0.7*0.15 - 0.10 = 0.715`
  - 등급은 `medium`이다.

## 4. 장애 및 Fallback 검증
- 부분 실패: 일부 LLM 모듈만 fallback이면 `meta.fallback_used=true`, `meta.llm_status=partial_failure`, 실패 모듈은 `meta.fallback_modules`에 기록한다.
- 전체 Ollama 실패: 모든 LLM 호출 모듈이 fallback이면 `meta.llm_status=fallback`이며 Offline E2E fixture가 이를 검증한다.
- Stub 시세 사용: `data_source=stub`, `is_realtime=false`, `observed_at=null`이며 `meta.stock_data_source=stub`로 반영한다.
- DB 저장 실패: 응답 자체는 200으로 유지하고 `meta.db_save_status=failed`로 표시한다.

## 5. 수정 내역
- `market_reaction_backend_spec.md`: HTTP 400/422 기준, ExternalContext enum, 공개 시장 컨텍스트 선택 입력, pressure 동률/보정, sentiment fallback, 신뢰도 감점 범위, 대표 신뢰도 값을 정리했다.
- `prompts_spec.md`: LLM 래퍼의 Pydantic 검증 타입, `ValidationError` 처리, 공개 시장 컨텍스트 인자, 에이전트 프롬프트의 사용자 유래 텍스트 구분자와 직접 조언/가격 예측 금지를 보강했다.
- `fallback_rules.md`: 직접 투자 추천 fallback 키워드, fallback `input_relevance` 숫자 매핑, `llm_status` 판정 기준, 시세 fallback 기본값을 정리했다.
- `SETUP.md`: SQLite 초기화 가이드를 추가했다.
- `test_fixtures.json`: total 0, 반올림 보정, dominant 동률, sentiment edge case, confidence 경계값, validator 허용/거절 케이스, E2E 응답 필드 검증을 추가 또는 수정했다.

## 6. 남은 결정 사항
없음

## 7. 최종 구현 권고
- 구현 시작 가능 여부: 가능
- 구현 시작 전 반드시 확인할 사항: 테스트 작성 시 `test_fixtures.json`의 `_description`, `_note`, `_formula` 보조 필드는 검증 대상에서 제외한다.
