"""자유서술(Q39)로 M5 논리 일관성을 채점한다."""
from __future__ import annotations

import config
from data.models import MetricResult, MetricId, Penalty
from scoring.gemini_client import generate_json


_PROMPT = """너는 투자 교육 서비스의 판단 채점관이다.
사용자의 자유서술에 대해 'M5 논리 일관성'만 1~5점으로 채점한다.

[이번 턴 상황]
{turn_context}

[사용자가 객관식으로 선택한 답]
{objective_summary}

[사용자의 자유서술 근거]
{free_text}

[M5 채점 기준]
- 5점: 객관식과 서술이 일치하며, 호재와 위험을 균형 있게 보고 행동 결론이 근거에서 자연스럽게 이어진다.
- 4점: 전반적으로 일관되지만 위험 또는 행동 근거의 구체성이 조금 부족하다.
- 3점: 기본적인 논리는 있으나 한쪽 요인에 치우치거나 연결이 약하다.
- 2점: 객관식과 서술의 방향은 맞을 수 있으나 위험을 거의 고려하지 않는 등 논리적 균형이 크게 부족하다.
- 1점: 근거가 없거나 문장이 논리적으로 성립하지 않거나 객관식과 서술이 직접 충돌한다.

[consistent 판정 규칙]
- consistent는 오직 '객관식 답과 자유서술이 서로 직접 모순되는가'만 나타낸다.
- 상황을 잘못 해석했거나 위험을 누락했더라도 객관식과 서술의 방향이 같다면 true다.
- 객관식에서는 고평가를 골랐는데 서술에서는 저평가라고 말하는 것처럼 직접 충돌할 때만 false다.
- 점수가 낮다는 이유만으로 consistent를 false로 만들지 마라.

반드시 아래 JSON 객체 하나만 출력하라.
{{"score": <1~5 숫자>, "reason": "<한국어 한두 문장>", "consistent": <true 또는 false>}}"""


def score_freetext(
    free_text: str,
    objective_answers: list[dict],
    turn_context: str,
) -> MetricResult:
    """자유서술과 객관식 선택을 함께 비교해 M5를 반환한다."""
    if not free_text or not free_text.strip():
        return MetricResult(
            metric=MetricId.M5,
            score=1.0,
            reason="자유서술이 비어 있어 논리 일관성을 평가할 수 없음.",
        )

    objective_lines = []
    for answer in objective_answers:
        selected = answer.get("selected", [])
        if not selected:
            continue
        objective_lines.append(
            f"- {answer.get('question_id', '')}: {', '.join(selected)}"
        )

    objective_summary = "\n".join(objective_lines) or "(선택한 객관식 답 없음)"
    prompt = _PROMPT.format(
        turn_context=turn_context,
        objective_summary=objective_summary,
        free_text=free_text.strip(),
    )

    result = generate_json(
        prompt,
        config.SCORING_MODELS,
        temperature=config.LLM_TEMPERATURE,
        required_keys=("score", "reason", "consistent"),
    )

    # 모든 모델이 실패해도 서버를 중단하지 않는다.
    if not result.ok or result.data is None:
        return MetricResult(
            metric=MetricId.M5,
            score=3.0,
            penalties=[
                Penalty(
                    amount=0.0,
                    cause="LLM_UNAVAILABLE",
                    evidence="모든 M5 채점 모델 호출에 실패함",
                )
            ],
            reason="LLM을 사용할 수 없어 M5를 임시 중립 점수로 표시했습니다.",
        )

    data = result.data
    try:
        score = float(data["score"])
    except (TypeError, ValueError):
        return MetricResult(
            metric=MetricId.M5,
            score=3.0,
            penalties=[
                Penalty(
                    amount=0.0,
                    cause="LLM_INVALID_RESPONSE",
                    evidence="M5 점수가 숫자 형식이 아님",
                )
            ],
            reason="M5 채점 응답 형식이 잘못되어 임시 중립 점수로 표시했습니다.",
        )

    score = round(max(1.0, min(5.0, score)), 2)
    reason = str(data.get("reason", "")).strip()
    consistent = data.get("consistent")

    penalties = []
    if consistent is False:
        penalties.append(
            Penalty(
                amount=0.0,
                cause="INCONSISTENT_REASON",
                evidence="객관식 답과 자유서술이 직접 충돌함",
            )
        )
    elif not isinstance(consistent, bool):
        penalties.append(
            Penalty(
                amount=0.0,
                cause="LLM_INVALID_RESPONSE",
                evidence="consistent 값이 boolean 형식이 아님",
            )
        )

    return MetricResult(
        metric=MetricId.M5,
        score=score,
        penalties=penalties,
        reason=reason,
    )
