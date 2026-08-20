from app.scoring.fuzzy_judge import compute_judgment


def test_strong_direct_negative_yields_sell():
    weighted = [
        {"direction": "부정", "factor": "외국인 순매도 전환", "weight": 90, "raw_strength": 0.9},
        {"direction": "부정", "factor": "RSI 과매수 이탈", "weight": 80, "raw_strength": 0.8},
    ]
    result = compute_judgment(weighted)
    assert result["judge"] == "매도"
    assert result["probabilities"]["매도"] == max(result["probabilities"].values())


def test_multiple_positive_factors_outweigh_single_negative():
    weighted = [
        {"direction": "부정", "factor": "외국인 순매도 전환", "weight": 30, "raw_strength": 0.3},
        {"direction": "긍정", "factor": "외국인 순매수 전환", "weight": 100, "raw_strength": 1.0},
        {"direction": "긍정", "factor": "RSI 과매도 이탈", "weight": 100, "raw_strength": 1.0},
        {"direction": "긍정", "factor": "골든크로스", "weight": 100, "raw_strength": 1.0},
    ]
    assert compute_judgment(weighted)["judge"] == "매수"


def test_hold_when_no_factors():
    result = compute_judgment([])
    assert result["judge"] == "관망"
    assert result["probabilities"] == {"매수": 0.0, "매도": 0.0, "관망": 100.0}


def test_multiple_negative_factors_yield_sell():
    weighted = [
        {"direction": "부정", "factor": "IT 섹터 전반 약세", "weight": 100, "raw_strength": 1.0},
        {"direction": "부정", "factor": "IT 섹터 전반 약세", "weight": 90, "raw_strength": 0.9},
    ]
    assert compute_judgment(weighted)["judge"] == "매도"


def test_probabilities_sum_to_100():
    weighted = [{"direction": "긍정", "factor": "a", "weight": 45, "raw_strength": 0.5}]
    result = compute_judgment(weighted)
    assert round(sum(result["probabilities"].values()), 1) == 100.0


def test_balanced_factors_never_show_negative_zero():
    """긍정/부정 weight가 정확히 같으면 net이 +0.0이 되고 -net은 -0.0이 되는데,
    이게 그대로 새 나가면 API 응답에 '-0.0'으로 찍힌다 (repr로 부호비트까지 확인)."""
    weighted = [
        {"direction": "긍정", "factor": "a", "weight": 50, "raw_strength": 0.5},
        {"direction": "부정", "factor": "b", "weight": 50, "raw_strength": 0.5},
    ]
    result = compute_judgment(weighted)
    assert repr(result["probabilities"]["매수"]) == "0.0"
    assert repr(result["probabilities"]["매도"]) == "0.0"


def test_confidence_exceeds_baseline_hold_when_signal_is_strong():
    """약한 단일 요인은 관망 쪽이 우세하지만(신호가 baseline을 못 넘음), 강한
    요인이 여럿 쌓이면 매수 쪽이 관망을 역전하며 confidence도 더 높아진다."""
    weak = [{"direction": "긍정", "factor": "a", "weight": 15, "raw_strength": 0.15}]
    strong = [
        {"direction": "긍정", "factor": f"f{i}", "weight": 100, "raw_strength": 1.0}
        for i in range(5)
    ]
    weak_result = compute_judgment(weak)
    strong_result = compute_judgment(strong)
    assert weak_result["judge"] == "관망"
    assert strong_result["judge"] == "매수"
    assert strong_result["confidence"] > weak_result["confidence"]
