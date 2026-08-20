"""턴별 개선 행동을 다음 턴과 최종 평가까지 이어 주는 코칭 추적기.

현재 턴의 점수나 감점 사유에서 구조화된 ``next_actions``를 만들고,
다음 턴에서 같은 문제가 반복됐는지 또는 조언을 반영했는지 판정한다.
코칭 판정은 피드백에만 사용하며 M1~M5 점수를 다시 가감하지 않는다.
"""
from __future__ import annotations

from typing import Any


FOLLOWED = "FOLLOWED"
REPEATED = "REPEATED"
NOT_VERIFIABLE = "NOT_VERIFIABLE"


_GUIDANCE_RULES = (
    {
        "guidance_code": "AVOID_EMPTY_RATIONALE",
        "causes": {"INSUFFICIENT_RATIONALE"},
        "target_metrics": ("M5",),
        "message": "근거 없이 한 글자나 의미 없는 짧은 답변만 제출하지 마세요.",
        "priority": 100,
    },
    {
        "guidance_code": "AVOID_CORE_FACTOR_OMISSION",
        "causes": {"MISSING_KEY_FACTORS"},
        "target_metrics": ("M1",),
        "message": "시나리오의 핵심 요인을 빼고 판단하지 마세요.",
        "priority": 90,
    },
    {
        "guidance_code": "AVOID_TRAP_DEPENDENCE",
        "causes": {"IRRELEVANT_OR_TRAP_FACTOR", "PICKED_TRAP_ASSET"},
        "target_metrics": ("M1", "PORTFOLIO"),
        "message": "뉴스 테마만으로 비핵심 요인이나 함정 종목을 선택하지 마세요.",
        "priority": 88,
    },
    {
        "guidance_code": "AVOID_DIRECTION_GUESS",
        "causes": {
            "NO_INTERPRETABLE_FACTOR",
            "MISINTERPRETED_DIRECTION",
            "UNEXPLAINED_DIRECTION",
        },
        "target_metrics": ("M2",),
        "message": "요인의 호재·악재 방향을 근거 없이 단정하거나 반대로 해석하지 마세요.",
        "priority": 85,
    },
    {
        "guidance_code": "AVOID_RISK_OMISSION",
        "causes": {"RISK_NEGLECT", "NO_COUNTER_SCENARIO"},
        "target_metrics": ("M3",),
        "message": "호재만 보고 손실 위험과 반대 시나리오를 생략하지 마세요.",
        "priority": 84,
    },
    {
        "guidance_code": "AVOID_ACTION_REASONING_MISMATCH",
        "causes": {
            "MISSING_ACTION_CONCLUSION",
            "ACTION_REASONING_MISMATCH",
            "ACTION_WITHOUT_EVIDENCE",
        },
        "target_metrics": ("M4",),
        "message": "자유서술의 결론과 다른 방향이나 강도의 주문을 실행하지 마세요.",
        "priority": 82,
    },
    {
        "guidance_code": "AVOID_CAUSAL_JUMP",
        "causes": {"CAUSE_EFFECT_GAP", "CONCLUSION_JUMP"},
        "target_metrics": ("M5",),
        "message": "원인과 영향을 설명하지 않은 채 행동 결론부터 내리지 마세요.",
        "priority": 80,
    },
    {
        "guidance_code": "AVOID_OVER_AGGRESSIVE_ACTION",
        "causes": {"TOO_AGGRESSIVE"},
        "target_metrics": ("M4",),
        "message": "시나리오의 적정 범위를 넘는 공격적인 매수를 하지 마세요.",
        "priority": 78,
    },
    {
        "guidance_code": "AVOID_OVER_DEFENSIVE_ACTION",
        "causes": {"TOO_DEFENSIVE"},
        "target_metrics": ("M4",),
        "message": "근거보다 과도하게 방어적인 전량 매도나 매매 포기를 하지 마세요.",
        "priority": 77,
    },
    {
        "guidance_code": "AVOID_OVER_CONCENTRATION",
        "causes": {"OVERWEIGHT"},
        "target_metrics": ("PORTFOLIO",),
        "message": "한 종목에 적정 상한을 넘는 비중을 집중하지 마세요.",
        "priority": 76,
    },
    {
        "guidance_code": "AVOID_CASH_DEPLETION",
        "causes": {"LOW_CASH"},
        "target_metrics": ("PORTFOLIO",),
        "message": "불확실한 구간에서 대응할 현금을 지나치게 소진하지 마세요.",
        "priority": 75,
    },
)


_METRIC_FALLBACKS = {
    "M1": (
        "AVOID_CORE_FACTOR_OMISSION",
        "시나리오의 핵심 요인을 빼고 판단하지 마세요.",
    ),
    "M2": (
        "AVOID_DIRECTION_GUESS",
        "요인의 호재·악재 방향을 근거 없이 단정하지 마세요.",
    ),
    "M3": (
        "AVOID_RISK_OMISSION",
        "호재만 보고 손실 위험과 반대 시나리오를 생략하지 마세요.",
    ),
    "M4": (
        "AVOID_ACTION_REASONING_MISMATCH",
        "작성한 판단과 다른 방향이나 강도의 주문을 실행하지 마세요.",
    ),
    "M5": (
        "AVOID_CAUSAL_JUMP",
        "원인과 영향을 설명하지 않은 채 행동 결론부터 내리지 마세요.",
    ),
    "PORTFOLIO": (
        "AVOID_UNMANAGED_PORTFOLIO",
        "현금과 종목별 비중을 확인하지 않은 채 주문하지 마세요.",
    ),
}


def _metric_name(value: Any) -> str:
    return str(getattr(value, "value", value))


def metric_scores(scorecard: dict) -> dict[str, float]:
    result: dict[str, float] = {}
    for metric in scorecard.get("metrics", []):
        try:
            result[_metric_name(metric.get("metric"))] = float(metric.get("score", 0))
        except (TypeError, ValueError):
            continue
    return result


def penalty_causes(scorecard: dict) -> set[str]:
    result: set[str] = set()
    for metric in scorecard.get("metrics", []):
        for penalty in metric.get("penalties", []):
            cause = str(penalty.get("cause", "")).strip()
            if cause:
                result.add(cause)
    return result


def build_next_actions(scorecard: dict, source_turn: int, limit: int = 3) -> list[dict]:
    """현재 턴의 감점 근거에서 다음 판단의 금지 행동을 만든다."""
    causes = penalty_causes(scorecard)
    scores = metric_scores(scorecard)
    actions: list[dict] = []
    used_codes: set[str] = set()

    for rule in sorted(_GUIDANCE_RULES, key=lambda item: item["priority"], reverse=True):
        matched = causes.intersection(rule["causes"])
        if not matched:
            continue
        code = str(rule["guidance_code"])
        if code in used_codes:
            continue
        used_codes.add(code)
        actions.append(
            {
                "guidance_code": code,
                "kind": "AVOID",
                "message": str(rule["message"]),
                "source_turn": int(source_turn),
                "target_metrics": list(rule["target_metrics"]),
                "trigger_causes": sorted(matched),
                "check_causes": sorted(rule["causes"]),
            }
        )
        if len(actions) >= limit:
            return actions

    # 객관식 점수만 낮아 구체적인 penalty가 없을 때도 최소한의 조언을 남긴다.
    for metric_id in ("M1", "M2", "M3", "M4", "M5", "PORTFOLIO"):
        if len(actions) >= limit:
            break
        if scores.get(metric_id, 5.0) >= 3.0:
            continue
        code, message = _METRIC_FALLBACKS[metric_id]
        if code in used_codes:
            continue
        used_codes.add(code)
        actions.append(
            {
                "guidance_code": code,
                "kind": "AVOID",
                "message": message,
                "source_turn": int(source_turn),
                "target_metrics": [metric_id],
                "trigger_causes": [],
                "check_causes": [],
            }
        )
    return actions


def review_previous_actions(
    previous_actions: list[dict],
    current_scorecard: dict,
    current_turn: int,
) -> list[dict]:
    """직전 턴 조언을 현재 턴에서 반영했는지 보수적으로 판정한다."""
    current_causes = penalty_causes(current_scorecard)
    scores = metric_scores(current_scorecard)
    result: list[dict] = []

    for action in previous_actions[:3]:
        code = str(action.get("guidance_code", "")).strip()
        message = str(action.get("message", "")).strip()
        target_metrics = [str(value) for value in action.get("target_metrics", [])]
        check_causes = {str(value) for value in action.get("check_causes", [])}
        matched_causes = sorted(current_causes.intersection(check_causes))
        target_scores = {
            metric: scores[metric]
            for metric in target_metrics
            if metric in scores
        }

        if matched_causes:
            status = REPEATED
            evidence = "현재 턴에서도 같은 유형의 감점 사유가 확인됐습니다."
        elif not check_causes and any(score < 3.0 for score in target_scores.values()):
            status = REPEATED
            evidence = "현재 턴에서도 관련 평가축이 3점 미만입니다."
        elif target_scores and all(score >= 3.5 for score in target_scores.values()):
            status = FOLLOWED
            score_text = ", ".join(
                f"{metric} {score:.2f}점" for metric, score in target_scores.items()
            )
            evidence = f"관련 감점이 반복되지 않았고 {score_text}으로 확인됐습니다."
        else:
            status = NOT_VERIFIABLE
            evidence = "관련 문제의 반복은 없지만 조언 준수를 확정할 근거가 부족합니다."

        result.append(
            {
                "guidance_code": code,
                "message": message,
                "source_turn": int(action.get("source_turn", current_turn - 1)),
                "evaluated_turn": int(current_turn),
                "status": status,
                "evidence": evidence,
                "matched_causes": matched_causes,
                "target_scores": target_scores,
            }
        )
    return result


def latest_guidance(evaluations: list[dict], before_turn: int) -> list[dict]:
    """현재 턴 바로 전 평가에서 저장한 구조화 조언을 가져온다."""
    candidates = [
        evaluation
        for evaluation in evaluations
        if int(evaluation.get("turn_no", 0)) < int(before_turn)
    ]
    if not candidates:
        return []
    previous = max(candidates, key=lambda item: int(item.get("turn_no", 0)))
    feedback = previous.get("scorecard", {}).get("feedback", {})
    if not isinstance(feedback, dict):
        return []
    actions = feedback.get("next_actions", [])
    return [item for item in actions if isinstance(item, dict)]


def _review_sentence(reviews: list[dict]) -> str:
    repeated = next((item for item in reviews if item.get("status") == REPEATED), None)
    if repeated:
        return (
            "이전 턴에서 지적된 행동이 이번에도 반복됐습니다. "
            f"관련 조언: {repeated['message']}"
        )
    followed = next((item for item in reviews if item.get("status") == FOLLOWED), None)
    if followed:
        return (
            "이전 턴의 조언을 이번 판단에 반영했습니다. "
            f"관련 조언: {followed['message']}"
        )
    if reviews:
        return "이전 턴의 조언은 이번 정보만으로 준수 여부를 확정하기 어렵습니다."
    return ""


def enrich_scorecard(
    scorecard: dict,
    previous_actions: list[dict],
    turn_no: int,
    *,
    is_final_turn: bool = False,
) -> dict:
    """기존 점수는 유지하고 피드백에 현재 조언과 이전 조언 검토를 추가한다."""
    actions = build_next_actions(scorecard, turn_no)
    reviews = review_previous_actions(previous_actions, scorecard, turn_no)
    feedback = scorecard.setdefault("feedback", {})
    if not isinstance(feedback, dict):
        feedback = {"explanation": str(feedback)}
        scorecard["feedback"] = feedback
    feedback["next_actions"] = actions
    feedback["previous_guidance_review"] = reviews

    original = str(feedback.get("explanation", "")).strip()
    parts = [_review_sentence(reviews), original]
    if actions:
        lead = "다음 투자 판단에서는" if is_final_turn else "다음 턴에는"
        parts.append(f"{lead} {actions[0]['message']}")
    feedback["explanation"] = " ".join(part for part in parts if part).strip()
    return scorecard


def summarize_progress(evaluations: list[dict]) -> dict:
    """최종 평가에서 사용할 조언 준수 이력과 미해결 행동을 집계한다."""
    history: list[dict] = []
    ordered = sorted(evaluations, key=lambda item: int(item.get("turn_no", 0)))
    for evaluation in ordered:
        feedback = evaluation.get("scorecard", {}).get("feedback", {})
        if not isinstance(feedback, dict):
            continue
        history.extend(
            item
            for item in feedback.get("previous_guidance_review", [])
            if isinstance(item, dict)
        )

    latest_actions: list[dict] = []
    if ordered:
        feedback = ordered[-1].get("scorecard", {}).get("feedback", {})
        if isinstance(feedback, dict):
            latest_actions = [
                item
                for item in feedback.get("next_actions", [])
                if isinstance(item, dict)
            ]

    counts = {
        FOLLOWED: sum(item.get("status") == FOLLOWED for item in history),
        REPEATED: sum(item.get("status") == REPEATED for item in history),
        NOT_VERIFIABLE: sum(
            item.get("status") == NOT_VERIFIABLE for item in history
        ),
    }
    latest_review_by_code: dict[str, dict] = {}
    for entry in history:
        code = str(entry.get("guidance_code", "")).strip()
        if code:
            latest_review_by_code[code] = entry

    unresolved_messages: list[str] = []
    for item in [
        *(
            entry
            for entry in latest_review_by_code.values()
            if entry.get("status") == REPEATED
        ),
        *latest_actions,
    ]:
        message = str(item.get("message", "")).strip()
        if message and message not in unresolved_messages:
            unresolved_messages.append(message)

    return {
        "reviewed_guidance_count": len(history),
        "followed_count": counts[FOLLOWED],
        "repeated_count": counts[REPEATED],
        "not_verifiable_count": counts[NOT_VERIFIABLE],
        "history": history,
        "unresolved_actions": unresolved_messages[:3],
    }


def progress_summary(progress: dict) -> str:
    reviewed = int(progress.get("reviewed_guidance_count", 0))
    followed = int(progress.get("followed_count", 0))
    repeated = int(progress.get("repeated_count", 0))
    uncertain = int(progress.get("not_verifiable_count", 0))
    if not reviewed:
        return "턴 사이에 검토할 이전 조언이 없었습니다."
    return (
        f"이전 턴 조언 {reviewed}건 중 {followed}건을 반영했고, "
        f"{repeated}건은 같은 문제가 반복됐으며, {uncertain}건은 판단 근거가 부족했습니다."
    )
