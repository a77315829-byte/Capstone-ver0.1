"""시장 압력 순수 함수 테스트.

기준: docs/test_fixtures.json (pressure_calculation_tests), docs/FINAL_REVIEW.md.
대표 예시는 institutional_investor.input_relevance = normal 기준으로 buy=69/sell=0/hold=31.
"""

from app.core.pressure import calculate_market_pressure
from app.schemas.agent import AgentOutput
from app.schemas.analysis import (
    AgentType,
    InputRelevance,
    ReactionDirection,
    ReactionStrength,
)


def make_agent(
    agent_type: AgentType,
    direction: ReactionDirection,
    strength: ReactionStrength,
    base_weight: float,
    relevance: InputRelevance,
) -> AgentOutput:
    """테스트용 AgentOutput 생성. 계산에 쓰이지 않는 필드는 placeholder."""
    return AgentOutput(
        agent_type=agent_type,
        agent_name_ko="테스트",
        reaction_direction=direction,
        reaction_direction_ko="-",
        reaction_strength=strength,
        reaction_strength_ko="-",
        base_weight=base_weight,
        input_relevance=relevance,
        key_reasons=["근거"],
        comment="코멘트",
        risk_factors=["리스크"],
    )


# ---------------------------------------------------------------------------
# 1.1 대표 예시 (buy=69 / sell=0 / hold=31)
# ---------------------------------------------------------------------------
def test_representative_example():
    agents = [
        make_agent(AgentType.INDIVIDUAL_INVESTOR, ReactionDirection.BUY,
                   ReactionStrength.HIGH, 0.20, InputRelevance.HIGH),
        make_agent(AgentType.INSTITUTIONAL_INVESTOR, ReactionDirection.HOLD,
                   ReactionStrength.MEDIUM, 0.25, InputRelevance.NORMAL),
        make_agent(AgentType.FOREIGN_INVESTOR, ReactionDirection.BUY,
                   ReactionStrength.MEDIUM, 0.25, InputRelevance.NORMAL),
        make_agent(AgentType.SHORT_TERM_INVESTOR, ReactionDirection.BUY,
                   ReactionStrength.HIGH, 0.15, InputRelevance.HIGH),
        make_agent(AgentType.LONG_TERM_INVESTOR, ReactionDirection.HOLD,
                   ReactionStrength.MEDIUM, 0.15, InputRelevance.NORMAL),
    ]

    result = calculate_market_pressure(agents)

    assert result.buy == 69
    assert result.sell == 0
    assert result.hold == 31
    assert result.dominant == ReactionDirection.BUY
    assert result.buy + result.sell + result.hold == 100
    assert result.headline  # 비어 있지 않음


# ---------------------------------------------------------------------------
# 1.2 매도 우세
# ---------------------------------------------------------------------------
def test_sell_dominant():
    agents = [
        make_agent(AgentType.INDIVIDUAL_INVESTOR, ReactionDirection.SELL,
                   ReactionStrength.HIGH, 0.20, InputRelevance.HIGH),
        make_agent(AgentType.INSTITUTIONAL_INVESTOR, ReactionDirection.SELL,
                   ReactionStrength.MEDIUM, 0.25, InputRelevance.HIGH),
        make_agent(AgentType.FOREIGN_INVESTOR, ReactionDirection.SELL,
                   ReactionStrength.MEDIUM, 0.25, InputRelevance.NORMAL),
        make_agent(AgentType.SHORT_TERM_INVESTOR, ReactionDirection.SELL,
                   ReactionStrength.HIGH, 0.15, InputRelevance.HIGH),
        make_agent(AgentType.LONG_TERM_INVESTOR, ReactionDirection.HOLD,
                   ReactionStrength.LOW, 0.15, InputRelevance.LOW),
    ]

    result = calculate_market_pressure(agents)

    assert result.dominant == ReactionDirection.SELL
    assert result.buy == 0
    assert result.sell > result.hold
    assert result.buy + result.sell + result.hold == 100


# ---------------------------------------------------------------------------
# 1.3 전부 관망
# ---------------------------------------------------------------------------
def test_all_hold():
    agents = [
        make_agent(AgentType.INDIVIDUAL_INVESTOR, ReactionDirection.HOLD,
                   ReactionStrength.MEDIUM, 0.20, InputRelevance.NORMAL),
        make_agent(AgentType.INSTITUTIONAL_INVESTOR, ReactionDirection.HOLD,
                   ReactionStrength.MEDIUM, 0.25, InputRelevance.NORMAL),
        make_agent(AgentType.FOREIGN_INVESTOR, ReactionDirection.HOLD,
                   ReactionStrength.MEDIUM, 0.25, InputRelevance.NORMAL),
        make_agent(AgentType.SHORT_TERM_INVESTOR, ReactionDirection.HOLD,
                   ReactionStrength.MEDIUM, 0.15, InputRelevance.NORMAL),
        make_agent(AgentType.LONG_TERM_INVESTOR, ReactionDirection.HOLD,
                   ReactionStrength.MEDIUM, 0.15, InputRelevance.NORMAL),
    ]

    result = calculate_market_pressure(agents)

    assert result.buy == 0
    assert result.sell == 0
    assert result.hold == 100
    assert result.dominant == ReactionDirection.HOLD


# ---------------------------------------------------------------------------
# 1.4 혼합 반응 (3방향 모두 존재)
# ---------------------------------------------------------------------------
def test_mixed_reactions():
    agents = [
        make_agent(AgentType.INDIVIDUAL_INVESTOR, ReactionDirection.BUY,
                   ReactionStrength.HIGH, 0.20, InputRelevance.NORMAL),
        make_agent(AgentType.INSTITUTIONAL_INVESTOR, ReactionDirection.HOLD,
                   ReactionStrength.MEDIUM, 0.25, InputRelevance.NORMAL),
        make_agent(AgentType.FOREIGN_INVESTOR, ReactionDirection.SELL,
                   ReactionStrength.MEDIUM, 0.25, InputRelevance.NORMAL),
        make_agent(AgentType.SHORT_TERM_INVESTOR, ReactionDirection.BUY,
                   ReactionStrength.LOW, 0.15, InputRelevance.NORMAL),
        make_agent(AgentType.LONG_TERM_INVESTOR, ReactionDirection.HOLD,
                   ReactionStrength.HIGH, 0.15, InputRelevance.NORMAL),
    ]

    result = calculate_market_pressure(agents)

    assert result.buy > 0
    assert result.sell > 0
    assert result.hold > 0
    assert result.buy + result.sell + result.hold == 100


# ---------------------------------------------------------------------------
# 1.5 total_score == 0 방어
# ---------------------------------------------------------------------------
def test_total_zero_empty_list():
    result = calculate_market_pressure([])

    assert result.buy == 0
    assert result.sell == 0
    assert result.hold == 100
    assert result.dominant == ReactionDirection.HOLD


def test_total_zero_all_zero_weight():
    agents = [
        make_agent(AgentType.INDIVIDUAL_INVESTOR, ReactionDirection.BUY,
                   ReactionStrength.HIGH, 0.0, InputRelevance.HIGH),
        make_agent(AgentType.INSTITUTIONAL_INVESTOR, ReactionDirection.SELL,
                   ReactionStrength.HIGH, 0.0, InputRelevance.HIGH),
    ]

    result = calculate_market_pressure(agents)

    assert result.buy == 0
    assert result.sell == 0
    assert result.hold == 100
    assert result.dominant == ReactionDirection.HOLD


# ---------------------------------------------------------------------------
# 1.6 반올림 보정 (원 반올림 합계 99 → buy 보정 → 100)
# ---------------------------------------------------------------------------
def test_rounding_correction():
    agents = [
        make_agent(AgentType.INDIVIDUAL_INVESTOR, ReactionDirection.HOLD,
                   ReactionStrength.LOW, 0.20, InputRelevance.NORMAL),
        make_agent(AgentType.INSTITUTIONAL_INVESTOR, ReactionDirection.SELL,
                   ReactionStrength.LOW, 0.25, InputRelevance.NORMAL),
        make_agent(AgentType.FOREIGN_INVESTOR, ReactionDirection.BUY,
                   ReactionStrength.LOW, 0.25, InputRelevance.LOW),
        make_agent(AgentType.SHORT_TERM_INVESTOR, ReactionDirection.BUY,
                   ReactionStrength.LOW, 0.15, InputRelevance.LOW),
        make_agent(AgentType.LONG_TERM_INVESTOR, ReactionDirection.BUY,
                   ReactionStrength.LOW, 0.15, InputRelevance.LOW),
    ]

    result = calculate_market_pressure(agents)

    assert result.buy == 50
    assert result.sell == 28
    assert result.hold == 22
    assert result.dominant == ReactionDirection.BUY
    assert result.buy + result.sell + result.hold == 100


# ---------------------------------------------------------------------------
# 1.7 dominant 동률 처리 (buy=hold=50 → hold 우선)
# ---------------------------------------------------------------------------
def test_dominant_tie_priority():
    agents = [
        make_agent(AgentType.INDIVIDUAL_INVESTOR, ReactionDirection.BUY,
                   ReactionStrength.LOW, 0.50, InputRelevance.NORMAL),
        make_agent(AgentType.INSTITUTIONAL_INVESTOR, ReactionDirection.HOLD,
                   ReactionStrength.LOW, 0.50, InputRelevance.NORMAL),
    ]

    result = calculate_market_pressure(agents)

    assert result.buy == 50
    assert result.hold == 50
    assert result.sell == 0
    # 동률이면 hold → buy → sell 우선순위
    assert result.dominant == ReactionDirection.HOLD
