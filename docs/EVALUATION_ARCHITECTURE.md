# 평가엔진 경계와 자체 모델 도입 순서

## 현재 운영 흐름

```text
UserDecision + turn rubric
        ↓
evaluator.evaluate(EvaluationInput)
        ↓
ScoreResult (M1~M5, PORTFOLIO, 감점, 함정)
        ↓
feedback_planner.build(...)
        ↓
FeedbackPlan (표현해도 되는 검증 재료)
        ↓
feedback_renderer.render(...)
        ↓
RenderedFeedback
        ↓
output_validator.validate(...)
        ↓
기존 Scorecard/API/Mongo 형식으로 변환
```

시나리오 점수와 피드백은 외부 LLM API를 호출하지 않는다. 피드백 렌더러는 현재
`template-v1`이며 동일한 입력에 항상 같은 결과를 반환한다. 실시간 AI 판단과 시장 반응에서
문장 생성이 필요한 경우에는 로컬 Ollama만 사용한다.

## 고정한 내부 계약

`services/scenario-server/scoring/contracts.py`에 다음 계약이 있다.

- `EvaluationInput`: 사용자 판단, 기준표, 향후 snapshot/bundle 식별자
- `Evidence`: 검증된 원문 span과 factor/scope/direction 속성
- `RelationEvidence`: 두 Evidence 사이의 검증된 관계
- `ScoreResult`: 표현 문장이 없는 점수와 검증 결과
- `FeedbackPlan`: 렌더러가 사용할 수 있는 피드백 재료
- `RenderedFeedback`: 사용자 문장과 참조한 fact ID

현재 규칙 평가기의 단어 매칭 결과를 정확한 원문 span으로 간주하지 않으므로 `Evidence`와
`RelationEvidence`는 비워 둔다. 자체 extractor가 추가되면 원문 범위와 confidence 검증을
통과한 결과만 채운다. `evidence_validator`는 question 원문의 정확한 span, rubric의
factor/entity, 현재 턴에서 볼 수 있는 claim, relation의 Evidence 참조를 실패 시 차단한다.

## 호환성 경계

- `engine.score_turn(decision, rubric) -> Scorecard` 공개 함수는 유지한다.
- 직접 채점 API의 `feedback`은 기존처럼 JSON 문자열이다.
- 세션 제출 경로는 문자열을 객체로 변환하고 기존 코칭 필드를 추가한다.
- 기존 M1~M5·PORTFOLIO 계산, 가중치, 반올림, 품질 상한을 변경하지 않았다.
- 렌더러 또는 출력 검증이 실패하면 `template-v1`으로 복구하며 점수는 다시 계산하지 않는다.
- 현재 `output_validator`는 `template-v1`의 전체 문장과 근거 참조를 대조한다. 로컬 모델
  renderer는 구조화된 근거 조립 규칙과 전용 validator가 등록되기 전까지 허용하지 않는다.

## 다음 단계

1. MongoDB를 읽기 전용으로 집계해 `turn_records`와 `turn_evaluations` 연결률 및
   `evaluator_version` 분포를 확인한다. 준비된 명령은
   `python -m scripts.audit_evaluation_data`이다.
2. 원본 답변과 검수 라벨을 연결하는 review 데이터 계약을 추가한다.
3. 시나리오·사용자·원본 답변 단위로 학습/검증/시험 split을 먼저 고정한다.
4. 사람 검수 데이터로 Evidence extractor를 학습하고 shadow 결과만 저장한다.
5. 관계 분류기와 M6를 추가하되 기존 사용자 점수에는 영향을 주지 않는다.
6. 템플릿 품질을 먼저 평가한 뒤 필요한 경우에만 로컬 Ollama renderer를 추가한다.
