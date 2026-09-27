"""service 파이프라인 offline 테스트."""

import pytest

from app.core.fallback import BASE_WEIGHTS, EVENT_BASE_WEIGHTS
from app.schemas.analysis import AgentType, DbSaveStatus, DataSource
from app.schemas.request import ExternalStockData, SelectedStock, SimulationRequest
from app.service import SimulationRejectedError, run_market_reaction_simulation


def _request(text="AI 반도체 수요 증가로 삼성전자의 HBM 관련 실적 개선 가능성이 높아질 것으로 예상된다.", stock_data=None):
    return SimulationRequest(
        user_id="test_user_001",
        selected_stock=SelectedStock(code="005930", name="삼성전자"),
        input_text=text,
        stock_data=stock_data,
    )


@pytest.mark.asyncio
async def test_offline_simulation_completes(offline):
    resp = await run_market_reaction_simulation(_request())

    assert resp.status.value == "ok"
    assert len(resp.agent_reactions) == 5
    assert resp.market_pressure.buy + resp.market_pressure.sell + resp.market_pressure.hold == 100
    assert resp.meta.fallback_used is True
    assert resp.meta.db_save_status == DbSaveStatus.NOT_USED
    assert resp.meta.stock_data_source == DataSource.STUB
    assert resp.current_stock_context.data_source == DataSource.STUB
    assert resp.current_stock_context.is_realtime is False
    assert resp.simulation_id
    assert 0.0 <= resp.analysis_confidence.score <= 1.0
    assert len(resp.uncertainty_factors) >= 1


@pytest.mark.asyncio
async def test_offline_llm_status_is_fallback(offline):
    resp = await run_market_reaction_simulation(_request())
    # 전체 LLM 단계가 fallback → llm_status == fallback
    assert resp.meta.llm_status.value == "fallback"


@pytest.mark.asyncio
async def test_direct_advice_raises_rejected(offline):
    with pytest.raises(SimulationRejectedError) as exc:
        await run_market_reaction_simulation(_request("삼성전자 지금 사야 하나요?"))
    assert exc.value.reason_code == "DIRECT_ADVICE_REQUEST"


@pytest.mark.asyncio
async def test_unknown_stock_uses_default_stub(offline):
    request = SimulationRequest(
        user_id="u2",
        selected_stock=SelectedStock(code="999999", name="테스트종목"),
        input_text="신규 산업 수요 증가로 실적 개선 기대가 형성되고 있다.",
    )
    resp = await run_market_reaction_simulation(request)
    assert resp.current_stock_context.data_source == DataSource.STUB
    assert len(resp.agent_reactions) == 5


@pytest.mark.asyncio
async def test_realtime_stock_data_overrides_stub_price(offline):
    stock_data = ExternalStockData(current_price=81500, daily_change_rate=3.7)
    resp = await run_market_reaction_simulation(_request(stock_data=stock_data))

    assert resp.current_stock_context.data_source == DataSource.EXTERNAL_API
    assert resp.current_stock_context.is_realtime is True
    assert resp.current_stock_context.current_price == 81500
    assert resp.meta.stock_data_source == DataSource.EXTERNAL_API
    # stub(-0.10) 감점이 빠지므로 stub 케이스보다 신뢰도가 낮지 않아야 한다.
    stub_resp = await run_market_reaction_simulation(_request())
    assert resp.analysis_confidence.score >= stub_resp.analysis_confidence.score


@pytest.mark.asyncio
async def test_event_type_changes_agent_base_weight(offline):
    """금리 관련 입력은 interest_rate_change 로 분류되어 외국인 투자자 base_weight 가 오른다."""
    resp = await run_market_reaction_simulation(
        _request("기준금리 인상 우려로 시장 전반의 투자심리가 위축되고 있다는 소식")
    )
    assert resp.impact_analysis is not None  # 분류/파이프라인 정상 완주 확인

    foreign = next(
        a for a in resp.agent_reactions if a.agent_type == AgentType.FOREIGN_INVESTOR
    )
    assert foreign.base_weight == EVENT_BASE_WEIGHTS["interest_rate_change"][AgentType.FOREIGN_INVESTOR]
    assert foreign.base_weight != BASE_WEIGHTS[AgentType.FOREIGN_INVESTOR]
    # 5개 base_weight 합은 이벤트 유형과 무관하게 항상 1.0
    assert sum(a.base_weight for a in resp.agent_reactions) == pytest.approx(1.0)


@pytest.mark.asyncio
async def test_fully_realtime_stock_data_scores_higher_than_partial(offline):
    partial = ExternalStockData(current_price=81500, daily_change_rate=3.7)
    full = ExternalStockData(
        current_price=81500,
        daily_change_rate=3.7,
        volume_trend="decreasing",
        market_cap_trillion=490.5,
    )
    partial_resp = await run_market_reaction_simulation(_request(stock_data=partial))
    full_resp = await run_market_reaction_simulation(_request(stock_data=full))

    assert full_resp.current_stock_context.volume_trend == "decreasing"
    assert full_resp.current_stock_context.market_cap_trillion == 490.5
    assert full_resp.analysis_confidence.score >= partial_resp.analysis_confidence.score
