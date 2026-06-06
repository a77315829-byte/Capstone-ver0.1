"""agents 테스트 (offline → 전부 fallback)."""

import pytest

from app.core.agents import run_all_agents
from app.core.fallback import AGENT_ORDER, fallback_external_context
from app.core.integrator import build_standard_input
from app.core.realtime_context import build_realtime_context
from app.schemas.agent import AgentOutput
from app.schemas.analysis import ReactionDirection
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
async def test_offline_returns_five_outputs(offline):
    outputs, fallback_modules = await run_all_agents(_standard_input())
    assert len(outputs) == 5
    assert all(isinstance(o, AgentOutput) for o in outputs)
    # 전체 offline → 5개 에이전트 모두 fallback 기록
    for agent_type in AGENT_ORDER:
        assert f"agent:{agent_type.value}" in fallback_modules


@pytest.mark.asyncio
async def test_agent_order_fixed_and_base_weight_sum(offline):
    outputs, _ = await run_all_agents(_standard_input())
    assert [o.agent_type for o in outputs] == AGENT_ORDER
    assert sum(o.base_weight for o in outputs) == pytest.approx(1.0)


@pytest.mark.asyncio
async def test_agent_output_schema(offline):
    outputs, _ = await run_all_agents(_standard_input())
    for o in outputs:
        assert o.reaction_direction in {
            ReactionDirection.BUY, ReactionDirection.SELL, ReactionDirection.HOLD
        }
        assert o.agent_name_ko
        assert o.reaction_direction_ko
        assert o.reaction_strength_ko
        assert len(o.key_reasons) >= 1
        assert o.comment
        assert len(o.risk_factors) >= 1


@pytest.mark.asyncio
async def test_no_direct_advice_in_comments(offline):
    outputs, _ = await run_all_agents(_standard_input())
    for o in outputs:
        text = o.comment + " ".join(o.key_reasons) + " ".join(o.risk_factors)
        for phrase in _FORBIDDEN:
            assert phrase not in text
