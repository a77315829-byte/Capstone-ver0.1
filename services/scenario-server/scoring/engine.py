"""객관식, 자유서술, 실제 행동을 함께 사용하는 하이브리드 채점 엔진.

- M1~M3: 객관식 45% + 자유서술 분석 55%
- M4: 자유서술-실제행동 일치 55% + 시나리오 행동 적합도 25% + 객관식 20%
- M5: 자유서술의 원인→영향→행동 논리
- PORTFOLIO: 실제 포트폴리오 규칙

자유서술 분석은 결정론적이며 외부 LLM 장애와 관계없이 항상 수행된다.
"""
from __future__ import annotations

import json

from data.models import (
    CardStatus,
    MetricId,
    MetricResult,
    Penalty,
    Scorecard,
    TrapResult,
    UserDecision,
)
from scoring import action_scorer, feedback_generator, rationale_scorer, rule_scorer


# 6축 가중치 (합=1.0). 수익률은 판단 점수에 포함하지 않는다.
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


def score_turn(decision: UserDecision, rubric: dict) -> Scorecard:
    sid = decision.scenario_id
    tno = decision.turn_no

    if decision.is_empty():
        return Scorecard(
            scenario_id=sid,
            turn_no=tno,
            status=CardStatus.EMPTY_INPUT,
            feedback="판단이 비어 있어 채점할 수 없습니다.",
        )
    if not rubric or not rubric.get("answer_rules"):
        return Scorecard(
            scenario_id=sid,
            turn_no=tno,
            status=CardStatus.MISSING_RUBRIC,
            feedback="채점 기준표가 없습니다.",
        )

    answers = [
        {"question_id": answer.question_id, "selected": answer.selected, "text": answer.text}
        for answer in decision.answers
    ]
    qscores = rule_scorer.score_objective(answers, rubric)
    objective_metric_map = rule_scorer.aggregate_by_metric(qscores)

    free_answer = next(
        (
            answer
            for answer in answers
            if rubric.get("answer_rules", {})
            .get(answer["question_id"], {})
            .get("type") == "free"
        ),
        None,
    )
    free_text = free_answer.get("text", "") if free_answer else ""
    has_free_text = bool(str(free_text).strip())

    rationale_evaluation = rationale_scorer.evaluate_rationale(
        str(free_text),
        rubric,
        decision.holdings,
    )
    quality = str(rationale_evaluation.analysis.get("quality", rationale_scorer.INSUFFICIENT))

    action_rule = rubric.get("action_rule", {})
    q36 = next(
        (answer["selected"] for answer in answers if answer["question_id"] == "Q36"),
        [],
    )
    action_fit = None
    portfolio = None
    if action_rule:
        action_fit, portfolio = action_scorer.score_actions(
            decision.holdings,
            decision.cash_pct,
            q36,
            action_rule,
        )

    metrics: list[MetricResult] = []
    for metric_id in ("M1", "M2", "M3"):
        metrics.append(_combine_objective_and_rationale(
            metric_id,
            objective_metric_map.get(metric_id),
            rationale_evaluation.metrics[metric_id],
            quality,
        ))
    metrics.append(_combine_m4(
        rationale_evaluation.metrics["M4"],
        action_fit,
        objective_metric_map.get("M4"),
        quality,
    ))
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
    turn_score = round(total_score / total_weight, 2) if total_weight else 0.0

    material = _collect_material(
        qscores,
        rubric,
        metrics,
        rationale_evaluation.analysis,
    )
    feedback = feedback_generator.generate_feedback(
        material,
        str(rubric.get("turn_context", "")),
        use_llm=has_free_text and quality != rationale_scorer.INSUFFICIENT,
    )
    traps = [
        TrapResult(trap_id=trap_id, triggered=True, explanation=explanation)
        for trap_id, explanation in material.get("triggered_traps", [])
    ]
    return Scorecard(
        scenario_id=sid,
        turn_no=tno,
        status=CardStatus.SCORED,
        metrics=metrics,
        traps=traps,
        turn_score=turn_score,
        feedback=json.dumps(feedback, ensure_ascii=False),
        rationale_analysis=rationale_evaluation.analysis,
    )


def _dedupe(values: list[str], limit: int) -> list[str]:
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
    return result


def _collect_material(
    qscores,
    rubric: dict,
    metrics: list[MetricResult],
    rationale_analysis: dict,
) -> dict:
    """객관식과 자유서술 양쪽의 근거를 피드백 재료로 합친다."""
    good_points: list[str] = []
    missed_points: list[str] = []
    triggered_traps: list[tuple[str, str]] = []
    rules = rubric.get("answer_rules", {})

    for question_score in qscores:
        rule = rules.get(question_score.question_id, {})
        note = str(rule.get("note", ""))
        if question_score.good_hit and not question_score.trap_hit:
            good_points.append(note or f"{question_score.question_id}에서 핵심을 잘 짚음")
        if question_score.trap_hit:
            value = f"{note} (함정: {', '.join(question_score.trap_hit)}에 주의)"
            missed_points.append(value)
            triggered_traps.append((f"TRAP_{question_score.question_id}", note))

    labels = {
        "M1": "핵심 요인 식별",
        "M2": "정보 해석",
        "M3": "위험 인식",
        "M4": "행동-근거 일치",
        "M5": "논리 일관성",
        "PORTFOLIO": "포트폴리오 관리",
    }
    for metric in metrics:
        if metric.score >= 4 and metric.reason:
            good_points.append(f"{labels.get(metric.metric.value, metric.metric.value)}: {metric.reason}")
        for penalty in metric.penalties:
            if penalty.evidence:
                missed_points.append(penalty.evidence)

    for factor_id in rationale_analysis.get("trap_factors", []):
        explanation = f"자유서술에서 함정 또는 비핵심 요인 {factor_id}에 의존했습니다."
        triggered_traps.append((f"TRAP_RATIONALE_{factor_id}", explanation))

    score_summary = ", ".join(
        f"{metric.metric.value} {metric.score}점"
        for metric in metrics
    )
    return {
        "good_points": _dedupe(good_points, 5),
        "missed_points": _dedupe(missed_points, 7),
        "ai_baseline": rubric.get("ai_baseline", {}).get("rationale", ""),
        "score_summary": score_summary,
        "triggered_traps": triggered_traps,
    }
