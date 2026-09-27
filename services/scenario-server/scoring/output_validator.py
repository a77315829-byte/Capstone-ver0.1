"""렌더링 결과가 FeedbackPlan의 경계를 벗어나지 않았는지 검사한다."""
from __future__ import annotations

from scoring import feedback_renderer
from scoring.contracts import FeedbackPlan, RenderedFeedback


class FeedbackValidationError(ValueError):
    pass


def validate(plan: FeedbackPlan, rendered: RenderedFeedback) -> None:
    if rendered.good_points != plan.good_points:
        raise FeedbackValidationError("렌더러가 good_points를 변경했습니다.")
    if rendered.missed_points != plan.missed_points:
        raise FeedbackValidationError("렌더러가 missed_points를 변경했습니다.")
    if not rendered.explanation.strip():
        raise FeedbackValidationError("피드백 설명이 비어 있습니다.")

    unknown_fact_ids = set(rendered.cited_fact_ids) - plan.allowed_fact_ids
    if unknown_fact_ids:
        raise FeedbackValidationError(
            f"계획에 없는 근거를 참조했습니다: {sorted(unknown_fact_ids)}"
        )

    # 현재 허용한 renderer는 신뢰 가능한 결정론적 템플릿뿐이다. 새 renderer는
    # 사실을 구조적으로 인용·재조립하는 검증 규칙과 함께 등록하기 전까지 차단한다.
    if rendered.renderer != "template-v1":
        raise FeedbackValidationError(
            f"검증 규칙이 등록되지 않은 renderer입니다: {rendered.renderer}"
        )
    expected = feedback_renderer.render_template(plan)
    if rendered.explanation != expected.explanation:
        raise FeedbackValidationError("템플릿에 없는 설명 내용이 추가됐습니다.")
    if rendered.cited_fact_ids != expected.cited_fact_ids:
        raise FeedbackValidationError("템플릿의 근거 참조가 변경됐습니다.")
