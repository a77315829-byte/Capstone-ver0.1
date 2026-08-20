import pytest

from app.marketdata.features import (
    compute_rsi_14, detect_foreign_flow_flip,
    compute_volume_ratio, compute_ma_cross, compute_52w_extreme,
)


def test_compute_rsi_14_reference_series():
    # 표준 RSI-14 예시로 흔히 쓰이는 15개 종가 시퀀스 (상승 추세 -> RSI 70대 기대)
    closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42,
              45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28]
    assert compute_rsi_14(closes) == 70.46


def test_compute_rsi_14_all_gains_is_100():
    closes = [float(i) for i in range(1, 17)]  # 15연속 상승, 하락 없음
    assert compute_rsi_14(closes) == 100.0


def test_compute_rsi_14_requires_at_least_15_closes():
    with pytest.raises(ValueError):
        compute_rsi_14([1.0, 2.0, 3.0])


def test_detect_foreign_flow_flip_negative():
    # 3일 연속 순매수(양수) -> 오늘 순매도(음수) 전환
    result = detect_foreign_flow_flip([100, 200, 150, -50])
    assert result == {"foreign_net_flow_flipped_negative": True, "foreign_net_flow_flipped_positive": False}


def test_detect_foreign_flow_flip_positive():
    result = detect_foreign_flow_flip([-100, -200, -150, 50])
    assert result == {"foreign_net_flow_flipped_negative": False, "foreign_net_flow_flipped_positive": True}


def test_detect_foreign_flow_flip_no_flip_when_not_consistent():
    # 직전 3일이 부호가 섞여있으면(연속 아님) 전환으로 보지 않는다
    result = detect_foreign_flow_flip([100, -200, 150, -50])
    assert result == {"foreign_net_flow_flipped_negative": False, "foreign_net_flow_flipped_positive": False}


def test_detect_foreign_flow_flip_needs_at_least_four_days():
    result = detect_foreign_flow_flip([100, 200, -50])
    assert result == {"foreign_net_flow_flipped_negative": False, "foreign_net_flow_flipped_positive": False}


def test_compute_volume_ratio():
    # 과거 3일 평균 100, 오늘 300 -> 3.0배
    assert compute_volume_ratio([100.0, 100.0, 100.0, 300.0]) == 3.0


def test_compute_volume_ratio_requires_at_least_two_values():
    with pytest.raises(ValueError):
        compute_volume_ratio([100.0])


def test_compute_ma_cross_detects_golden_cross():
    # 20일간 100 횡보하다 오늘 200으로 급등 -> 단기(5일) 이평이 장기(20일) 이평을 상향 돌파
    closes = [100.0] * 20 + [200.0]
    result = compute_ma_cross(closes)
    assert result["golden_cross"] is True
    assert result["dead_cross"] is False
    assert result["ma_gap_pct"] > 0


def test_compute_ma_cross_requires_enough_closes():
    with pytest.raises(ValueError):
        compute_ma_cross([100.0] * 10)


def test_compute_52w_extreme_detects_new_high():
    result = compute_52w_extreme([100.0, 110.0, 90.0, 120.0])
    assert result["week52_high"] is True
    assert result["week52_low"] is False
    assert result["week52_distance_pct"] > 0


def test_compute_52w_extreme_detects_new_low():
    result = compute_52w_extreme([100.0, 110.0, 90.0, 80.0])
    assert result["week52_low"] is True
    assert result["week52_high"] is False


def test_compute_52w_extreme_requires_at_least_two_closes():
    with pytest.raises(ValueError):
        compute_52w_extreme([100.0])
