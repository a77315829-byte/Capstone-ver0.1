"""사용자 판단을 점수와 검증 근거로 변환하는 결정론적 평가기."""
from __future__ import annotations

from data.models import CardStatus, MetricId, MetricResult, Penalty, TrapResult
from scoring import action_scorer, rationale_scorer, rule_scorer
from scoring.contracts import EvaluationInput, ScoreResult


DEFAULT_WEIGHTS = {
    "M1": 0.20,
    "M2": 0.18,
    "M3": 0.18,
    "M4": 0.17,
    "M5": 0.12,
    "PORTFOLIO": 0.15,
}

OBJECTIVE_WEIGHT = 0.45
RATIONALE_WEIGHT = 0.55
M4_RATIONALE_WEIGHT = 0.55
M4_ACTION_FIT_WEIGHT = 0.25
M4_OBJECTIVE_WEIGHT = 0.20


def _merge_penalties(*groups: list[Penalty]) -> list[Penalty]:
    result: list[Penalty] = []
    seen: set[tuple[str, str]] = set()
    for group in groups:
        for penalty in group:
            key = (penalty.cause, penalty.evidence)
            if key in seen:
                continue
            seen.add(key)
            result.append(penalty)
    return result


def _apply_quality_cap(score: float, quality: str) -> float:
    if quality == rationale_scorer.INSUFFICIENT:
        return min(score, 2.0)
    if quality == rationale_scorer.WEAK:
        return min(score, 3.5)
    return score


def _combine_objective_and_rationale(
    metric_id: str,
    objective_score: float | None,
    rationale_metric: MetricResult,
    quality: str,
) -> MetricResult:
    if objective_score is None:
        score = rationale_metric.score
        component_reason = f"자유서술 {rationale_metric.score:.2f}"
    else:
        score = (
            float(objective_score) * OBJECTIVE_WEIGHT
            + rationale_metric.score * RATIONALE_WEIGHT
        )
        component_reason = (
            f"객관식 {float(objective_score):.2f}×{OBJECTIVE_WEIGHT:.2f} + "
            f"자유서술 {rationale_metric.score:.2f}×{RATIONALE_WEIGHT:.2f}"
        )
    score = _apply_quality_cap(score, quality)
    return MetricResult(
        metric=MetricId(metric_id),
        score=round(max(1.0, min(5.0, score)), 2),
        penalties=list(rationale_metric.penalties),
        reason=f"{component_reason}; {rationale_metric.reason}",
    )


def _combine_m4(
    rationale_metric: MetricResult,
    action_fit: MetricResult | None,
    objective_score: float | None,
    quality: str,
) -> MetricResult:
    components: list[tuple[float, float, str]] = [
        (rationale_metric.score, M4_RATIONALE_WEIGHT, "자유서술-실제행동"),
    ]
    penalty_groups = [rationale_metric.penalties]
    if action_fit is not None:
        components.append((action_fit.score, M4_ACTION_FIT_WEIGHT, "행동 적합도"))
        penalty_groups.append(action_fit.penalties)
    if objective_score is not None:
        components.append((float(objective_score), M4_OBJECTIVE_WEIGHT, "객관식"))

    total_weight = sum(weight for _, weight, _ in components)
    score = sum(value * weight for value, weight, _ in components) / total_weight
    score = _apply_quality_cap(score, quality)
    component_reason = " + ".join(
        f"{label} {value:.2f}×{weight:.2f}"
        for value, weight, label in components
    )
    return MetricResult(
        metric=MetricId.M4,
        score=round(max(1.0, min(5.0, score)), 2),
        penalties=_merge_penalties(*penalty_groups),
        reason=f"{component_reason}; {rationale_metric.reason}",
    )


def _build_traps(question_scores, rationale_analysis: dict) -> list[TrapResult]:
    traps: list[TrapResult] = []
    for question_score in question_scores:
        if not question_score.trap_hit:
            continue
        traps.append(
            TrapResult(
                trap_id=f"TRAP_{question_score.question_id}",
                triggered=True,
                explanation=question_score.note,
            )
        )
    for factor_id in rationale_analysis.get("trap_factors", []):
        traps.append(
            TrapResult(
                trap_id=f"TRAP_RATIONALE_{factor_id}",
                triggered=True,
                explanation=(
                    f"자유서술에서 함정 또는 비핵심 요인 {factor_id}에 의존했습니다."
                ),
            )
        )
    return traps


def evaluate(evaluation_input: EvaluationInput) -> ScoreResult:
    """피드백 문장을 만들지 않고 점수와 검증 결과만 반환한다."""
    decision = evaluation_input.decision
    rubric = evaluation_input.rubric

    if decision.is_empty():
        return ScoreResult(
            scenario_id=decision.scenario_id,
            turn_no=decision.turn_no,
            status=CardStatus.EMPTY_INPUT,
            message="판단이 비어 있어 채점할 수 없습니다.",
        )
    if not rubric or not rubric.get("answer_rules"):
        return ScoreResult(
            scenario_id=decision.scenario_id,
            turn_no=decision.turn_no,
            status=CardStatus.MISSING_RUBRIC,
            message="채점 기준표가 없습니다.",
        )

    answers = [
        {
            "question_id": answer.question_id,
            "selected": answer.selected,
            "text": answer.text,
        }
        for answer in decision.answers
    ]
    question_scores = rule_scorer.score_objective(answers, rubric)
    objective_metric_map = rule_scorer.aggregate_by_metric(question_scores)

    free_answer = next(
        (
            answer
            for answer in answers
            if rubric.get("answer_rules", {})
            .get(answer["question_id"], {})
            .get("type")
            == "free"
        ),
        None,
    )
    free_text = free_answer.get("text", "") if free_answer else ""
    rationale_evaluation = rationale_scorer.evaluate_rationale(
        str(free_text),
        rubric,
        decision.holdings,
    )
    quality = str(
        rationale_evaluation.analysis.get(
            "quality", rationale_scorer.INSUFFICIENT
        )
    )

    action_fit = None
    portfolio = None
    action_rule = rubric.get("action_rule", {})
    if action_rule:
        q36 = next(
            (
                answer["selected"]
                for answer in answers
                if answer["question_id"] == "Q36"
            ),
            [],
        )
        action_fit, portfolio = action_scorer.score_actions(
            decision.holdings,
            decision.cash_pct,
            q36,
            action_rule,
        )

    metrics: list[MetricResult] = []
    for metric_id in ("M1", "M2", "M3"):
        metrics.append(
            _combine_objective_and_rationale(
                metric_id,
                objective_metric_map.get(metric_id),
                rationale_evaluation.metrics[metric_id],
                quality,
            )
        )
    metrics.append(
        _combine_m4(
            rationale_evaluation.metrics["M4"],
            action_fit,
            objective_metric_map.get("M4"),
            quality,
        )
    )
    metrics.append(rationale_evaluation.metrics["M5"])
    if portfolio is not None:
        metrics.append(portfolio)

    weights = rubric.get("metric_weights") or DEFAULT_WEIGHTS
    total_weight = 0.0
    total_score = 0.0
    for metric in metrics:
        weight = float(weights.get(metric.metric.value, 0))
        total_score += metric.score * weight
        total_weight += weight

    return ScoreResult(
        scenario_id=decision.scenario_id,
        turn_no=decision.turn_no,
        status=CardStatus.SCORED,
        metrics=metrics,
        traps=_build_traps(question_scores, rationale_evaluation.analysis),
        turn_score=round(total_score / total_weight, 2) if total_weight else 0.0,
        rationale_analysis=rationale_evaluation.analysis,
        question_scores=question_scores,
    )
