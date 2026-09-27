"""realtime_context 테스트."""

import pytest

from app.core.realtime_context import (
    build_realtime_context,
    determine_momentum,
    determine_price_reflection,
    determine_volatility,
)
from app.core.fallback import fallback_external_context
from app.schemas.analysis import (
    AgentType,
    CurrentStockContext,
    DataSource,
    ExternalContext,
    ImpactDirection,
    ImpactStrength,
    RealtimeContext,
    TimeHorizon,
)
from app.schemas.request import SelectedStock
from app.services.stock_data import get_stock_context_stub


# ---------------------------------------------------------------------------
# 순수 판단 함수
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "rate,direction,expected",
    [
        (4.0, ImpactDirection.POSITIVE, "high"),
        (2.0, ImpactDirection.POSITIVE, "medium"),
        (0.5, ImpactDirection.POSITIVE, "low"),
        (-4.0, ImpactDirection.NEGATIVE, "high"),
        (-2.0, ImpactDirection.NEGATIVE, "medium"),
        (-0.5, ImpactDirection.NEGATIVE, "low"),
        (10.0, ImpactDirection.NEUTRAL, "low"),
    ],
)
def test_determine_price_reflection(rate, direction, expected):
    assert determine_price_reflection(rate, "increasing", direction) == expected


@pytest.mark.parametrize(
    "rate,volume,expected",
    [
        (4.0, "increasing", "strong"),
        (4.0, "stable", "moderate"),
        (2.0, "increasing", "moderate"),
        (0.5, "increasing", "weak"),
    ],
)
def test_determine_momentum(rate, volume, expected):
    assert determine_momentum(rate, volume) == expected


@pytest.mark.parametrize(
    "rate,expected",
    [(6.0, "high"), (-6.0, "high"), (3.0, "medium"), (1.0, "low")],
)
def test_determine_volatility(rate, expected):
    assert determine_volatility(rate) == expected


def test_determine_handles_none_rate():
    assert determine_price_reflection(None, "stable", ImpactDirection.POSITIVE) == "low"
    assert determine_momentum(None, "increasing") == "weak"
    assert determine_volatility(None) == "low"


# ---------------------------------------------------------------------------
# build_realtime_context
# ---------------------------------------------------------------------------
def _external(direction: ImpactDirection) -> ExternalContext:
    return ExternalContext(
        event_summary="요약",
        event_type="other",
        impact_direction=direction,
        impact_strength=ImpactStrength.MEDIUM,
        related_industries=["반도체"],
        positive_factors=["긍정"],
        negative_factors=["부정"],
        uncertainty_factors=["불확실"],
        time_horizon=TimeHorizon.MID_TERM,
    )


def test_build_realtime_context_schema_and_values():
    stock = get_stock_context_stub(SelectedStock(code="005930", name="삼성전자"))
    # 삼성전자 stub: daily_change_rate=-1.5, volume_trend=increasing
    ctx = build_realtime_context(stock, _external(ImpactDirection.NEGATIVE))

    assert isinstance(ctx, RealtimeContext)
    assert ctx.current_stock_context.data_source == DataSource.STUB
    assert ctx.price_reflection_level == "medium"   # negative, -1.5 < -1.0
    assert ctx.short_term_momentum == "moderate"    # |1.5| > 1.0
    assert ctx.volatility_level == "low"            # |1.5| <= 2.0
    assert len(ctx.internal_risk_factors) >= 1


def test_build_realtime_context_agent_focus_keys():
    stock = get_stock_context_stub(SelectedStock(code="005930", name="삼성전자"))
    ctx = build_realtime_context(stock, _external(ImpactDirection.POSITIVE))

    expected_keys = {a.value for a in AgentType}
    assert set(ctx.agent_focus.keys()) == expected_keys
    # RealtimeContext.agent_focus 는 dict[str, str]
    for value in ctx.agent_focus.values():
        assert isinstance(value, str)
        assert value.strip()


def test_high_volatility_adds_internal_risk():
    stock = CurrentStockContext(
        code="000660",
        name="SK하이닉스",
        industry="반도체",
        current_price=178000,
        daily_change_rate=6.0,   # |6.0| > 5.0 → 변동성 high
        volume_trend="increasing",
        market_cap_trillion=130.0,
        data_source=DataSource.STUB,
        is_realtime=False,
        observed_at=None,
    )
    ctx = build_realtime_context(stock, _external(ImpactDirection.POSITIVE))

    assert ctx.volatility_level == "high"
    assert ctx.short_term_momentum == "strong"      # |6.0|>3.0 & increasing
    assert ctx.price_reflection_level == "high"     # positive & 6.0>3.0
    assert "최근 시장 변동성 확대" in ctx.internal_risk_factors
    assert "현재 주가 선반영 가능성" in ctx.internal_risk_factors


def test_build_realtime_context_with_fallback_external():
    stock = get_stock_context_stub(SelectedStock(code="005930", name="삼성전자"))
    external = fallback_external_context(
        "삼성전자", "AI 반도체 수요 증가로 HBM 실적 개선 기대", "industry_information"
    )
    ctx = build_realtime_context(stock, external)
    assert isinstance(ctx, RealtimeContext)
    assert set(ctx.agent_focus.keys()) == {a.value for a in AgentType}
