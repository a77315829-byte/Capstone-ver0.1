# FINAL_REVIEW_CHANGELOG

## market_reaction_backend_spec.md
- 요청 계약에 선택 필드 `public_market_context`를 명시했다.
- 필수 필드 누락/Pydantic 검증 실패는 `422`, JSON 파싱 불가는 `400`으로 정리했다.
- `ExternalContext.event_type`을 프롬프트 JSON Schema와 동일한 enum으로 수정했다.
- 시장 압력 `total == 0`, 반올림 잔여값, `dominant` 동률 처리 기준을 추가했다.
- 시장 분위기 분기에서 buy/sell 공동 최댓값과 hold 최댓값 fallback 케이스를 명확히 했다.
- 분석 신뢰도에서 fallback 감점 대상과 Stub 이중 감점 의도를 명확히 했다.
- 대표 신뢰도 예시를 공식과 일치하는 `0.715`로 수정했다.

## prompts_spec.md
- LLM 래퍼 예시에 `BaseModel`, `ValidationError` import와 명시적 ValidationError 처리를 추가했다.
- `response_model` 타입을 `type[BaseModel] | None`으로 명확히 했다.
- 외부 시장 맥락 분석 호출 시 선택적 `public_market_context` 인자를 반영했다.
- 에이전트 판단 초점 및 에이전트별 시스템 프롬프트에 직접 투자 조언과 구체적 가격 예측 금지를 명시했다.
- 에이전트 공통 유저 프롬프트에서 사용자 유래 가능 텍스트를 `<user_content>`로 감쌌다.

## fallback_rules.md
- fallback 직접 추천 키워드를 투자 행동 요청 중심으로 정리했다.
- fallback 에이전트의 `input_relevance` 문자열을 숫자 값으로 변환하도록 명시했다.
- 시세 fallback 흐름의 기본값 설명을 `DEFAULT_STOCK_DATA`로 통일했다.
- `llm_status`의 `ok`, `partial_failure`, `fallback` 결정 기준을 추가했다.
- 기본 Stub 가격을 `test_fixtures.json`의 default stub과 맞췄다.

## SETUP.md
- 개발용 SQLite 초기화 가이드를 추가했다.

## test_fixtures.json
- 시장 압력 `total == 0`, 반올림 잔여값 보정, `dominant` 동률 테스트를 추가했다.
- 시장 분위기 edge case 테스트를 수정 및 추가했다.
- 분석 신뢰도 낮음 케이스 기대값을 공식과 맞추고 경계값 테스트를 추가했다.
- 직접 매도 행동 요청과 허용되는 하락 반응 질문 테스트를 추가했다.
- E2E 최종 응답 구조 검증에 누락된 표시 필드와 `meta.db_save_status`를 추가했다.
