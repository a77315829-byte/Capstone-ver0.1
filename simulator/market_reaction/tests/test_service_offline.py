"""service 파이프라인 offline 테스트."""

import pytest

from app.schemas.analysis import DbSaveStatus, DataSource
from app.schemas.request import SelectedStock, SimulationRequest
from app.service import SimulationRejectedError, run_market_reaction_simulation


def _request(text="AI 반도체 수요 증가로 삼성전자의 HBM 관련 실적 개선 가능성이 높아질 것으로 예상된다."):
    return SimulationRequest(
        user_id="test_user_001",
        selected_stock=SelectedStock(code="005930", name="삼성전자"),
        input_text=text,
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
