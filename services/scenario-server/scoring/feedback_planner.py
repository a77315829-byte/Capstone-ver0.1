"""검증된 평가 결과에서 피드백에 포함할 내용을 선택한다."""
from __future__ import annotations

from scoring.contracts import EvaluationInput, FeedbackPlan, ScoreResult


def _dedupe(values: list[str], limit: int) -> tuple[str, ...]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = str(value).strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
        if len(result) >= limit:
            break
    return tuple(result)


def build(
    evaluation_input: EvaluationInput,
    score_result: ScoreResult,
) -> FeedbackPlan:
    """점수는 변경하지 않고 피드백 재료만 선택한다."""
    rubric = evaluation_input.rubric
    good_points: list[str] = []
    missed_points: list[str] = []
    rules = rubric.get("answer_rules", {})

    for question_score in score_result.question_scores:
        rule = rules.get(question_score.question_id, {})
        note = str(rule.get("note", ""))
        if question_score.good_hit and not question_score.trap_hit:
            good_points.append(
                note or f"{question_score.question_id}에서 핵심을 잘 짚음"
            )
        if question_score.trap_hit:
            missed_points.append(
                f"{note} (함정: {', '.join(question_score.trap_hit)}에 주의)"
            )

    labels = {
        "M1": "핵심 요인 식별",
        "M2": "정보 해석",
        "M3": "위험 인식",
        "M4": "행동-근거 일치",
        "M5": "논리 일관성",
        "PORTFOLIO": "포트폴리오 관리",
    }
    for metric in score_result.metrics:
        metric_id = metric.metric.value
        if metric.score >= 4 and metric.reason:
            good_points.append(
                f"{labels.get(metric_id, metric_id)}: {metric.reason}"
            )
        for penalty in metric.penalties:
            if penalty.evidence:
                missed_points.append(penalty.evidence)

    return FeedbackPlan(
        good_points=_dedupe(good_points, 5),
        missed_points=_dedupe(missed_points, 7),
        reference_guidance=str(
            rubric.get("ai_baseline", {}).get("rationale", "")
        ).strip(),
        score_summary=", ".join(
            f"{metric.metric.value} {metric.score}점"
            for metric in score_result.metrics
        ),
        turn_context=str(rubric.get("turn_context", "")),
        triggered_trap_ids=tuple(trap.trap_id for trap in score_result.traps),
    )
