"""
규칙 채점기: 객관식 답 → M1~M4 점수.
- rubric의 answer_rules(good/trap)와 사용자 답을 대조. LLM 없음.
- 자유서술(Q39, M5)은 여기서 안 다룸 → llm_scorer가 담당.
"""
from data.models import QuestionScore


def _score_one_question(answer, rule) -> QuestionScore:
    """질문 하나 채점. answer=사용자답(dict), rule=answer_rules[qid]."""
    picked = answer.get("selected", [])
    good = rule.get("good", [])
    trap = rule.get("trap", [])

    good_hit = [p for p in picked if p in good]
    trap_hit = [p for p in picked if p in trap]

    # 점수 규칙 (1~5)
    # 점수 규칙 (1~5): 기본 3점에서 정답은 올리고 함정은 내린다
    if not picked:
        score = 1.0  # 아무것도 안 고름
    else:
        good_ratio = len(good_hit) / max(1, len(good))  # 정답을 얼마나 짚었나 (0~1)
        score = 3.0
        score += 2.0 * good_ratio  # 정답 맞힌 만큼 올림 (최대 +2 → 5점)
        score -= 1.5 * len(trap_hit)  # 함정 하나당 내림

    score = max(1.0, min(5.0, score))    # clip

    return QuestionScore(
        question_id=answer.get("question_id", ""),
        metric=rule.get("metric", ""),
        score=round(score, 2),
        picked=picked,
        good_hit=good_hit,
        trap_hit=trap_hit,
        note=rule.get("note", ""),
    )


def score_objective(user_answers: list[dict], rubric: dict) -> list[QuestionScore]:
    """
    객관식 답들을 채점.
    user_answers: [{"question_id":"Q1","selected":[...]}, ...]
    rubric: rubric_turn3.json 내용 (answer_rules 포함)
    return: 질문별 채점 결과 리스트 (자유서술 Q39 제외)
    """
    rules = rubric.get("answer_rules", {})
    results = []
    for ans in user_answers:
        qid = ans.get("question_id")
        rule = rules.get(qid)
        if rule is None:
            continue                     # 이 턴 질문 아님, 건너뜀
        if rule.get("type") == "free":
            continue                     # 자유서술은 LLM이 → 여기선 skip
        results.append(_score_one_question(ans, rule))
    return results


def aggregate_by_metric(qscores: list[QuestionScore]) -> dict[str, float]:
    """질문별 점수를 M축별 평균으로 묶기. (한 M축에 질문 여러 개일 수 있음)"""
    buckets: dict[str, list[float]] = {}
    for qs in qscores:
        buckets.setdefault(qs.metric, []).append(qs.score)
    return {m: round(sum(v) / len(v), 2) for m, v in buckets.items()}