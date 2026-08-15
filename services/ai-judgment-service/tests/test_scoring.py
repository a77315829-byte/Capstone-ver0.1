from app.scoring.judge import decide_judgment
from app.scoring.confidence import compute_confidence


def test_decide_judgment_sell_when_strong_direct_negative():
    weighted = [
        {"type": "직접", "direction": "부정", "factor": "외국인 순매도 전환", "weight": 90},
        {"type": "직접", "direction": "부정", "factor": "RSI 과매수 이탈", "weight": 80},
    ]
    assert decide_judgment(weighted) == "매도"


def test_decide_judgment_buy_when_direct_positive_offsets_negative():
    weighted = [
        {"type": "직접", "direction": "부정", "factor": "외국인 순매도 전환", "weight": 70},
        {"type": "직접", "direction": "긍정", "factor": "외국인 순매수 전환", "weight": 90},
    ]
    assert decide_judgment(weighted) == "매수"


def test_decide_judgment_hold_when_no_factors():
    assert decide_judgment([]) == "관망"


def test_decide_judgment_considers_indirect_factors():
    weighted = [
        {"type": "간접", "direction": "부정", "factor": "IT 섹터 전반 약세", "weight": 100},
        {"type": "간접", "direction": "부정", "factor": "뉴스 감성 부정", "weight": 90},
    ]
    assert decide_judgment(weighted) == "매도"


def test_confidence_increases_with_more_factors():
    few = [{"type": "직접", "factor": "a", "weight": 50}]
    many = [
        {"type": "직접", "factor": "a", "weight": 50},
        {"type": "직접", "factor": "b", "weight": 40},
        {"type": "간접", "factor": "c", "weight": 30},
    ]
    assert compute_confidence(many) >= compute_confidence(few)
