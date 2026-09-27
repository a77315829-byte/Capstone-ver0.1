"""시장 분위기 순수 함수 테스트.

기준: docs/test_fixtures.json (sentiment_tests), docs/market_reaction_backend_spec.md 섹션 12.
"""

import pytest

from app.core.sentiment import determine_market_sentiment
from app.schemas.analysis import MarketPressure, ReactionDirection, SentimentCode


def make_pressure(buy: int, sell: int, hold: int) -> MarketPressure:
    """sentiment 분기는 buy/sell/hold 만 사용. dominant/headline 은 placeholder."""
    return MarketPressure(
        buy=buy,
        sell=sell,
        hold=hold,
        dominant=ReactionDirection.HOLD,
        headline="-",
    )


# 추천 문구로 오해될 수 있는 표현(있으면 안 됨)
_FORBIDDEN_PHRASES = [
    "매수하세요",
    "매도하세요",
    "사세요",
    "파세요",
    "추천",
    "지금 사",
    "지금 팔",
]


@pytest.mark.parametrize(
    "buy,sell,hold,expected",
    [
        (85, 5, 10, SentimentCode.VERY_POSITIVE),
        (55, 15, 30, SentimentCode.POSITIVE),
        (35, 32, 33, SentimentCode.NEUTRAL),
        (15, 55, 30, SentimentCode.NEGATIVE),
        (5, 85, 10, SentimentCode.VERY_NEGATIVE),
        (20, 15, 65, SentimentCode.UNCERTAIN),
        # 추가 edge case (docs fixtures)
        (38, 25, 37, SentimentCode.POSITIVE),
        (37, 25, 38, SentimentCode.UNCERTAIN),
        (45, 45, 10, SentimentCode.NEUTRAL),
    ],
)
def test_sentiment_classification(buy, sell, hold, expected):
    result = determine_market_sentiment(make_pressure(buy, sell, hold))
    assert result.code == expected


@pytest.mark.parametrize(
    "buy,sell,hold",
    [
        (85, 5, 10),
        (55, 15, 30),
        (35, 32, 33),
        (15, 55, 30),
        (5, 85, 10),
        (20, 15, 65),
    ],
)
def test_labels_and_one_liner_present(buy, sell, hold):
    result = determine_market_sentiment(make_pressure(buy, sell, hold))
    assert result.label_ko.strip()
    assert result.one_liner.strip()


@pytest.mark.parametrize(
    "buy,sell,hold",
    [
        (85, 5, 10),
        (55, 15, 30),
        (35, 32, 33),
        (15, 55, 30),
        (5, 85, 10),
        (20, 15, 65),
    ],
)
def test_one_liner_has_no_direct_advice(buy, sell, hold):
    result = determine_market_sentiment(make_pressure(buy, sell, hold))
    for phrase in _FORBIDDEN_PHRASES:
        assert phrase not in result.one_liner


def test_all_six_codes_are_covered():
    """6개 분위기 코드가 모두 산출 가능한지 확인."""
    cases = [
        (85, 5, 10),
        (55, 15, 30),
        (35, 32, 33),
        (15, 55, 30),
        (5, 85, 10),
        (20, 15, 65),
    ]
    produced = {determine_market_sentiment(make_pressure(*c)).code for c in cases}
    assert produced == set(SentimentCode)
