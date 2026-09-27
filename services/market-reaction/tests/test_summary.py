"""summary 테스트 (offline → fallback_summary)."""

import pytest

from app.core.agents import run_all_agents
from app.core.fallback import fallback_external_context
from app.core.integrator import build_standard_input
from app.core.pressure import calculate_market_pressure
from app.core.realtime_context import build_realtime_context
from app.core.sentiment import determine_market_sentiment
from app.core.summary import generate_summary
from app.schemas.request import SelectedStock, SimulationRequest
from app.services.stock_data import get_stock_context_stub

_FORBIDDEN = ["매수하세요", "매도하세요", "사세요", "파세요", "추천", "지금 사야 합니다", "팔아야 합니다", "목표가"]


def _standard_input():
    request = SimulationRequest(
        user_id="u1",
        selected_stock=SelectedStock(code="005930", name="삼성전자"),
        input_text="AI 반도체 수요 증가로 삼성전자 HBM 실적 개선 기대",
    )
    external = fallback_external_context("삼성전자", request.input_text, "industry_information")
    stock = get_stock_context_stub(request.selected_stock)
    realtime = build_realtime_context(stock, external)
    return build_standard_input(request, external, realtime)


@pytest.mark.asyncio
async def test_offline_summary_uses_fallback(offline):
    si = _standard_input()
    agents, _ = await run_all_agents(si)
    pressure = calculate_market_pressure(agents)
    sentiment = determine_market_sentiment(pressure)
    uncertainty = ["실제 공급 계약 여부", "현재 주가 선반영 가능성"]

    summary, fallback_modules = await generate_summary(
        "삼성전자", si, pressure, sentiment, agents, uncertainty
    )

    assert isinstance(summary, str)
    assert len(summary) >= 20
    assert "summary" in fallback_modules
    assert "불확실성" in summary
    for phrase in _FORBIDDEN:
        assert phrase not in summary
