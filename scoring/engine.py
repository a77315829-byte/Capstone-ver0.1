"""
채점 엔진: 규칙(M1~M3) + 행동 방향(M4) + LLM(M5) + PORTFOLIO를 합쳐 Scorecard로.
- turn_score = 6축 가중 평균 (코드가 계산, LLM 아님).
- 빈 입력·기준표 누락 방어.
"""
import json
from data.models import (
    UserDecision, Scorecard, CardStatus, MetricResult, MetricId, TrapResult
)
from scoring import rule_scorer, llm_scorer, feedback_generator, action_scorer

# 6축 가중치 (합=1.0). 말 축(M1~M3,M5)=0.68, 행동 축(M4,PORTFOLIO)=0.32 → 말이 더 무겁게.
DEFAULT_WEIGHTS = {
    "M1": 0.20, "M2": 0.18, "M3": 0.18, "M4": 0.17, "M5": 0.12, "PORTFOLIO": 0.15,
}


def score_turn(decision: UserDecision, rubric: dict) -> Scorecard:
    sid = decision.scenario_id
    tno = decision.turn_no

    # ── 방어 1: 빈 입력 ──
    if decision.is_empty():
        return Scorecard(scenario_id=sid, turn_no=tno, status=CardStatus.EMPTY_INPUT,
                         feedback="판단이 비어 있어 채점할 수 없습니다.")

    # ── 방어 2: 기준표 누락 ──
    if not rubric or not rubric.get("answer_rules"):
        return Scorecard(scenario_id=sid, turn_no=tno, status=CardStatus.MISSING_RUBRIC,
                         feedback="채점 기준표가 없습니다.")

    # 사용자 답을 dict 리스트로
    answers = [
        {"question_id": a.question_id, "selected": a.selected, "text": a.text}
        for a in decision.answers
    ]

    # ── 1. 규칙 채점 (M1~M3, 그리고 Q36 등도 계산되지만 M4는 아래서 덮어씀) ──
    qscores = rule_scorer.score_objective(answers, rubric)
    metric_map = rule_scorer.aggregate_by_metric(qscores)

    # ── 2. LLM 채점 (M5, 자유서술) ──
    free_answer = next(
        (
            a
            for a in answers
            if rubric.get("answer_rules", {})
            .get(a["question_id"], {})
            .get("type") == "free"
        ),
        None,
    )
    ctx = rubric.get("turn_context", "")
    free_text = free_answer.get("text", "") if free_answer else ""
    has_free_text = bool(free_text.strip())
    m5 = llm_scorer.score_freetext(free_text, answers, ctx)
    metric_map["M5"] = m5.score

    m5_unavailable = any(p.cause == "LLM_UNAVAILABLE" for p in m5.penalties)

    # ── 3. 행동 채점 (M4 = 행동 방향, PORTFOLIO = 배분 품질) ──
    action_rule = rubric.get("action_rule", {})
    q36 = next((a["selected"] for a in answers if a["question_id"] == "Q36"), [])
    m4_action = None
    portfolio = None
    if action_rule:
        m4_action, portfolio = action_scorer.score_actions(
            decision.holdings, decision.cash_pct, q36, action_rule
        )
        metric_map["M4"] = m4_action.score
        metric_map["PORTFOLIO"] = portfolio.score

    # ── 4. MetricResult 리스트로 정리 ──
    metrics = []
    for mid in ["M1", "M2", "M3"]:
        if mid in metric_map:
            metrics.append(MetricResult(metric=MetricId(mid), score=metric_map[mid]))
    if m4_action is not None:
        metrics.append(m4_action)
    elif "M4" in metric_map:
        metrics.append(MetricResult(metric=MetricId.M4, score=metric_map["M4"]))
    metrics.append(m5)
    if portfolio is not None:
        metrics.append(portfolio)

    # ── 5. turn_score = 가중 평균 (코드 계산) ──
    weights = rubric.get("metric_weights") or DEFAULT_WEIGHTS
    total_w = 0.0
    total_s = 0.0
    for m in metrics:
        # LLM 장애로 넣은 임시 3점은 사용자 총점에 반영하지 않는다.
        if any(p.cause == "LLM_UNAVAILABLE" for p in m.penalties):
            continue
        w = weights.get(m.metric.value, 0)
        total_s += m.score * w
        total_w += w
    turn_score = round(total_s / total_w, 2) if total_w else 0.0

    # ── 6. 재료 수집 (피드백용) ──
    material = _collect_material(qscores, rubric, m5)
    # action 감점도 피드백 재료에 추가
    if portfolio is not None:
        for p in portfolio.penalties:
            material["missed_points"].append(f"{p.evidence}")
        for p in m4_action.penalties:
            material["missed_points"].append(f"{p.evidence}")
        material["missed_points"] = material["missed_points"][:6]

    # ── 7. 피드백 생성 ──
    fb = feedback_generator.generate_feedback(
        material,
        ctx,
        use_llm=has_free_text and not m5_unavailable,
    )

    # ── 8. Scorecard 조립 ──
    traps = [
        TrapResult(trap_id=t, triggered=True, explanation=e)
        for t, e in material.get("triggered_traps", [])
    ]
    return Scorecard(
        scenario_id=sid, turn_no=tno, status=CardStatus.SCORED,
        metrics=metrics, traps=traps, turn_score=turn_score,
        feedback=json.dumps(fb, ensure_ascii=False),
    )


def _collect_material(qscores, rubric, m5) -> dict:
    """채점 결과에서 잘 본 것/놓친 것/함정을 뽑아 피드백 재료로."""
    good_points = []
    missed_points = []
    triggered_traps = []

    rules = rubric.get("answer_rules", {})

    for qs in qscores:
        rule = rules.get(qs.question_id, {})
        note = rule.get("note", "")
        if qs.good_hit and not qs.trap_hit:
            good_points.append(note or f"{qs.question_id}에서 핵심을 잘 짚음")
        if qs.trap_hit:
            missed_points.append(f"{note} (함정: {', '.join(qs.trap_hit)}에 주의)")
            triggered_traps.append((f"TRAP_{qs.question_id}", note))
        elif not qs.picked:
            missed_points.append(note or f"{qs.question_id}를 고려하지 못함")

    for penalty in m5.penalties:
        if penalty.cause == "INCONSISTENT_REASON":
            missed_points.append(penalty.evidence)

    score_summary = ", ".join(f"{qs.metric} {qs.score}점" for qs in qscores) + f", M5 {m5.score}점"

    return {
        "good_points": good_points[:4],
        "missed_points": missed_points[:4],
        "ai_baseline": rubric.get("ai_baseline", {}).get("rationale", ""),
        "score_summary": score_summary,
        "triggered_traps": triggered_traps,
    }
