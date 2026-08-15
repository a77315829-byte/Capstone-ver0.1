import pytest

from app.marketdata.features import compute_rsi_14, detect_foreign_flow_flip


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
