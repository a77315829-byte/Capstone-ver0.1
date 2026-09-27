"""FeedbackPlan을 사용자에게 보여줄 문장으로 표현한다."""
from __future__ import annotations

from scoring.contracts import FeedbackPlan, RenderedFeedback


def render_template(plan: FeedbackPlan) -> RenderedFeedback:
    """외부 API 없이 동일 입력에 항상 같은 문장을 만든다."""
    sentences: list[str] = []
    cited_fact_ids: list[str] = []

    if plan.good_points:
        sentences.append(f"잘 본 점은 다음과 같습니다. {plan.good_points[0]}")
        cited_fact_ids.append("good:0")
    else:
        sentences.append("이번 판단에서는 기준표의 핵심 요인을 충분히 짚지 못했습니다.")

    if plan.missed_points:
        sentences.append(f"보완할 점은 다음과 같습니다. {plan.missed_points[0]}")
        cited_fact_ids.append("missed:0")
    elif plan.good_points:
        sentences.append("규칙 채점에서 추가로 확인된 주요 누락이나 함정은 없습니다.")

    if plan.reference_guidance:
        sentences.append(
            "다음 판단에서는 다음 기준을 참고해 보세요. "
            f"{plan.reference_guidance}"
        )
        cited_fact_ids.append("reference_guidance")
    else:
        sentences.append("다음 판단에서는 상황의 핵심 요인과 위험을 함께 확인해 보세요.")

    return RenderedFeedback(
        good_points=plan.good_points,
        missed_points=plan.missed_points,
        explanation=" ".join(sentences),
        renderer="template-v1",
        cited_fact_ids=tuple(cited_fact_ids),
    )


def render(plan: FeedbackPlan) -> RenderedFeedback:
    """현재 운영 렌더러. 로컬 모델은 이 함수 뒤의 구현체로 추가한다."""
    return render_template(plan)
