"""가중치 결과로부터 매수/매도/관망을 threshold 기반으로 결정한다.
직접/간접요인 모두 net에 반영되며, 둘의 상대적 비중은 rubric.py의
BASE_TYPE_WEIGHT(직접>간접)가 weight 계산 단계에서 이미 반영한 값을 그대로 쓴다.
임계치는 config.py(judge_sell_threshold, judge_hold_threshold)에서 관리하는 데모 값이며,
실제 서비스에서는 실데이터로 튜닝해야 한다.
"""
from app.config import settings


def decide_judgment(weighted_factors: list[dict]) -> str:
    if not weighted_factors:
        return "관망"

    positive = sum(w["weight"] for w in weighted_factors if w["direction"] == "긍정")
    negative = sum(w["weight"] for w in weighted_factors if w["direction"] == "부정")
    net = positive - negative

    if net <= -settings.judge_sell_threshold:
        return "매도"
    if net <= -settings.judge_hold_threshold:
        return "관망"
    return "매수"
