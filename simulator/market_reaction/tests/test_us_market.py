import pytest
from app.schemas.request import SelectedStock, ExternalStockData, SimulationRequest
from app.schemas.analysis import DataSource
from app.services.stock_data import get_stock_context
from app.service import run_market_reaction_simulation
from app.core.external_context import _build_user_prompt


def request(stock_data=None):
    return SimulationRequest(user_id="us_test", selected_stock=SelectedStock(code="NVDA", name="엔비디아", market="US", exchange="NAS"), input_text="엔비디아의 AI 반도체 수요 증가와 실적 개선이 예상된다.", stock_data=stock_data)


def test_us_quote_keeps_cents_and_uses_dollar_market_cap():
    data = ExternalStockData(current_price=155.12, daily_change_rate=-1.5, market_cap_usd=3.76e12)
    context = get_stock_context(request().selected_stock, data)
    assert context.current_price == 155.12
    assert context.currency == "USD" and context.market == "US"
    assert context.market_cap_usd == 3.76e12
    assert context.market_cap_trillion is None
    assert context.volume_trend == "unknown"
    assert context.data_source == DataSource.EXTERNAL_API


def test_us_unavailable_quote_never_uses_korean_fixture():
    context = get_stock_context(request().selected_stock, None)
    assert context.current_price is None
    assert context.currency == "USD"
    assert context.data_source == DataSource.UNKNOWN
    assert context.market_cap_trillion is None


def test_us_market_is_explicit_in_ai_prompt():
    prompt = _build_user_prompt(request(), "반도체", "industry_information", [])
    assert "Market: US; currency: USD" in prompt


@pytest.mark.asyncio
async def test_us_pipeline_keeps_algorithm_fallback_when_ai_unavailable(offline):
    result = await run_market_reaction_simulation(request(ExternalStockData(current_price=155.12, daily_change_rate=-1.5)))
    assert result.status.value == "ok"
    assert result.current_stock_context.current_price == 155.12
    assert result.current_stock_context.currency == "USD"
    assert len(result.agent_reactions) == 5
    assert result.meta.fallback_used
    assert result.market_pressure.buy + result.market_pressure.sell + result.market_pressure.hold == 100


@pytest.mark.asyncio
async def test_us_no_quote_reports_uncertainty_without_a_fabricated_price(offline):
    result = await run_market_reaction_simulation(request())
    assert result.current_stock_context.current_price is None
    assert result.current_stock_context.currency == "USD"
    assert any("현재 시세를 확보하지 못해" in risk for risk in result.uncertainty_factors)
