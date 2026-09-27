"""build_eval_set.py 의 순수 라벨링 로직 테스트."""

import pytest

from scripts.build_eval_set import compute_label, pick_trading_days

# 거래일: 8/20(목) 8/21(금) 8/24(월) 8/25(화). 8/22~23 은 주말.
STOCK = {"20260820": 100.0, "20260821": 100.0, "20260824": 103.0, "20260825": 104.0}
INDEX = {"20260820": 1000.0, "20260821": 1000.0, "20260824": 1010.0, "20260825": 1020.0}


def test_pick_trading_days_uses_last_day_before_and_first_day_after():
    """기준일은 공시일 이전(당일 포함) 마지막 거래일, 비교일은 공시일 직후 첫 거래일."""
    assert pick_trading_days(sorted(STOCK), "20260821") == ("20260821", "20260824")


def test_pick_trading_days_handles_non_trading_day_event():
    """공시가 주말에 접수되면 직전 금요일 종가와 직후 월요일 종가를 쓴다."""
    assert pick_trading_days(sorted(STOCK), "20260822") == ("20260821", "20260824")


def test_pick_trading_days_returns_none_without_following_day():
    """공시 이후 거래일 데이터가 없으면 라벨을 만들 수 없다."""
    assert pick_trading_days(sorted(STOCK), "20260825") is None


def test_positive_label_when_excess_return_exceeds_band():
    """종목 +3.0%, 지수 +1.0% → 초과 +2.0%p 이므로 positive."""
    r = compute_label(STOCK, INDEX, "20260821", band=0.5)
    assert r["label"] == "positive"
    assert r["stock_return"] == pytest.approx(3.0)
    assert r["index_return"] == pytest.approx(1.0)
    assert r["excess_return"] == pytest.approx(2.0)


def test_neutral_label_when_excess_return_inside_band():
    """종목과 지수가 같이 움직이면 초과수익률이 0 이라 neutral."""
    index_same = {"20260820": 1000.0, "20260821": 1000.0, "20260824": 1030.0}
    r = compute_label(STOCK, index_same, "20260821", band=0.5)
    assert r["label"] == "neutral"
    assert r["excess_return"] == pytest.approx(0.0)


def test_negative_label_when_stock_underperforms_index():
    """종목이 지수보다 크게 못 오르면 negative."""
    index_up = {"20260820": 1000.0, "20260821": 1000.0, "20260824": 1100.0}
    r = compute_label(STOCK, index_up, "20260821", band=0.5)
    assert r["label"] == "negative"
    assert r["excess_return"] == pytest.approx(-7.0)


def test_returns_none_when_price_data_missing():
    """가격이 없으면 라벨을 만들지 않는다(조용히 빠뜨리지 않고 None 을 돌려준다)."""
    assert compute_label({}, INDEX, "20260821") is None


def test_returns_none_when_index_is_missing_the_next_trading_day():
    """지수에 다음 거래일이 비어 있으면 라벨을 만들지 않는다.

    교집합만 쓰면 하루 수익률 대신 여러 날 수익률을 조용히 계산해 라벨이 오염된다.
    그럴 바엔 해당 케이스를 버린다.
    """
    index_gap = {"20260820": 1000.0, "20260821": 1000.0, "20260825": 1010.0}  # 8/24 없음
    assert compute_label(STOCK, index_gap, "20260821") is None


def test_returns_none_when_index_is_missing_the_base_day():
    """기준일이 지수에 없어도 마찬가지로 버린다."""
    index_gap = {"20260820": 1000.0, "20260824": 1010.0}  # 8/21 없음
    assert compute_label(STOCK, index_gap, "20260821") is None
