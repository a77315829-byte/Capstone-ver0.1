"""시장 분위기 산출 — 순수 함수.

docs/market_reaction_backend_spec.md 섹션 12, docs/test_fixtures.json 의
sentiment_tests 계약을 따른다. 직접 매수/매도 추천 문구는 사용하지 않는다.
"""

from __future__ import annotations

from ..schemas.analysis import MarketPressure, MarketSentiment, SentimentCode

_LABEL_KO = {
    SentimentCode.VERY_POSITIVE: "매우 긍정적",
    SentimentCode.POSITIVE: "긍정적",
    SentimentCode.NEUTRAL: "중립적",
    SentimentCode.NEGATIVE: "부정적",
    SentimentCode.VERY_NEGATIVE: "매우 부정적",
    SentimentCode.UNCERTAIN: "불확실성 확대",
}

# 교육용 한 줄 설명(투자 추천이 아닌 시장 반응 묘사)
_ONE_LINER = {
    SentimentCode.VERY_POSITIVE: "시장참여자 다수가 강한 긍정적 반응을 보이는 흐름입니다.",
    SentimentCode.POSITIVE: "긍정적 반응이 우세하지만 일부 관망·신중 심리도 함께 존재합니다.",
    SentimentCode.NEUTRAL: "매수와 매도 심리가 균형을 이루며 뚜렷한 방향성이 약한 상태입니다.",
    SentimentCode.NEGATIVE: "부정적 반응이 우세한 흐름입니다.",
    SentimentCode.VERY_NEGATIVE: "시장참여자 다수가 강한 부정적 반응을 보이는 흐름입니다.",
    SentimentCode.UNCERTAIN: "관망 심리가 우세하여 방향성에 대한 불확실성이 큰 상태입니다.",
}


def _classify(buy: int, sell: int, hold: int) -> SentimentCode:
    """위에서부터 순서대로 평가(uncertain/neutral 충돌 방지를 위해 순서 고정)."""
    highest = max(buy, sell, hold)
    lowest = min(buy, sell, hold)

    # 1) 매우 긍정적 / 매우 부정적
    if buy >= 75 and sell <= 10:
        return SentimentCode.VERY_POSITIVE
    if sell >= 75 and buy <= 10:
        return SentimentCode.VERY_NEGATIVE

    # 2) 관망 압력이 최댓값이고 충분히 높으면(>=40) 불확실성 확대
    if hold == highest and hold >= 40:
        return SentimentCode.UNCERTAIN

    # 3) 세 값이 근접하거나 매수·매도가 공동 최댓값이면 중립
    if (highest - lowest) <= 10 or (buy == sell and buy == highest):
        return SentimentCode.NEUTRAL

    # 4) 방향성 우세
    if buy == highest:
        return SentimentCode.POSITIVE
    if sell == highest:
        return SentimentCode.NEGATIVE

    # 5) 나머지(주로 hold가 최댓값이지만 40 미만) → 불확실성 확대
    return SentimentCode.UNCERTAIN


def determine_market_sentiment(pressure: MarketPressure) -> MarketSentiment:
    """시장 압력 → 시장 분위기."""
    code = _classify(pressure.buy, pressure.sell, pressure.hold)
    return MarketSentiment(
        code=code,
        label_ko=_LABEL_KO[code],
        one_liner=_ONE_LINER[code],
    )
