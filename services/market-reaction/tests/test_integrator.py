"""integrator (build_standard_input) 테스트."""

from app.core.integrator import build_standard_input
from app.core.realtime_context import build_realtime_context
from app.schemas.analysis import (
    ExternalContext,
    ImpactDirection,
    ImpactStrength,
    StandardInput,
    TimeHorizon,
)
from app.schemas.request import SelectedStock, SimulationRequest
from app.services.stock_data import get_stock_context_stub

SAMSUNG = SelectedStock(code="005930", name="삼성전자")


def _request():
    return SimulationRequest(
        user_id="u1", selected_stock=SAMSUNG, input_text="AI 반도체 수요 증가로 HBM 실적 개선 기대"
    )


def _external(uncertainty):
    return ExternalContext(
        event_summary="요약",
        event_type="industry_demand_increase",
        impact_direction=ImpactDirection.POSITIVE,
        impact_strength=ImpactStrength.HIGH,
        related_industries=["반도체"],
        positive_factors=["수요 증가"],
        negative_factors=["경쟁 심화"],
        uncertainty_factors=uncertainty,
        time_horizon=TimeHorizon.MID_TERM,
    )


def test_build_standard_input_schema():
    external = _external(["실제 공급 계약 여부"])
    stock = get_stock_context_stub(SAMSUNG)
    realtime = build_realtime_context(stock, external)

    si = build_standard_input(_request(), external, realtime)

    assert isinstance(si, StandardInput)
    assert si.selected_stock == "삼성전자"
    assert si.impact_direction == ImpactDirection.POSITIVE
    assert si.current_stock_context.code == "005930"
    assert si.price_reflection_level in {"low", "medium", "high"}


def test_uncertainty_merged_and_deduped():
    # 외부 불확실성과 realtime 내부 리스크가 겹치도록 구성
    external = _external(["현재 주가 선반영 가능성", "실제 공급 계약 여부"])
    stock = get_stock_context_stub(SAMSUNG)
    realtime = build_realtime_context(stock, external)
    # realtime.internal_risk_factors 에 "현재 주가 선반영 가능성" 이 들어갈 수 있음

    si = build_standard_input(_request(), external, realtime)

    # 중복 없음
    assert len(si.uncertainty_factors) == len(set(si.uncertainty_factors))
    # 외부 불확실성이 포함됨
    assert "실제 공급 계약 여부" in si.uncertainty_factors


def test_no_user_holding_fields():
    external = _external(["x"])
    stock = get_stock_context_stub(SAMSUNG)
    realtime = build_realtime_context(stock, external)
    si = build_standard_input(_request(), external, realtime)

    dumped = si.model_dump()
    for forbidden in ("holding_status", "average_purchase_price", "profit_loss_status",
                      "user_investment_context"):
        assert forbidden not in dumped
