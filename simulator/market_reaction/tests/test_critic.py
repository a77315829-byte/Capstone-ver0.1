"""critic 테스트(offline → fallback 경로).

LLM 성공 경로(정합성 판단)는 오프라인 테스트로 결정적으로 검증할 수 없으므로 실제
Ollama 로 수동 확인한다. 여기서는 fallback 경로(_fallback_consistency)가 기존
service.py:_analysis_consistency 규칙과 동일하게 동작하는지 검증한다.
"""

import pytest

from app.core.critic import review_agent_consistency
from app.core.fallback import build_all_fallback_agent_outputs, fallback_external_context
from app.core.integrator import build_standard_input
from app.core.realtime_context import build_realtime_context
from app.schemas.analysis import ImpactDirection
from app.schemas.request import SelectedStock, SimulationRequest
from app.services.stock_data import get_stock_context_stub


def _standard_input(price_reflection_level=None):
    request = SimulationRequest(
        user_id="u1",
        selected_stock=SelectedStock(code="005930", name="삼성전자"),
        input_text="AI 반도체 수요 증가로 삼성전자 HBM 실적 개선 기대",
    )
    external = fallback_external_context("삼성전자", request.input_text, "industry_information")
    stock = get_stock_context_stub(request.selected_stock)
    realtime = build_realtime_context(stock, external)
    standard_input = build_standard_input(request, external, realtime)
    if price_reflection_level is not None:
        standard_input.price_reflection_level = price_reflection_level
    return standard_input


@pytest.mark.asyncio
async def test_offline_uses_fallback(offline):
    si = _standard_input()
    agent_outputs = build_all_fallback_agent_outputs(si.impact_direction, si.price_reflection_level)
    review, fallback_modules = await review_agent_consistency(si, agent_outputs)
    assert fallback_modules == ["critic"]
    assert review.conflicts == []
    assert review.uncertainty_factors == []


@pytest.mark.asyncio
async def test_offline_fallback_matches_legacy_rule_full_consistency(offline):
    """positive + high 가 아니면 fallback 규칙은 1.0(완전 일치)."""
    si = _standard_input(price_reflection_level="medium")
    si.impact_direction = ImpactDirection.POSITIVE
    agent_outputs = build_all_fallback_agent_outputs(si.impact_direction, si.price_reflection_level)
    review, _ = await review_agent_consistency(si, agent_outputs)
    assert review.consistency_score == 1.0


@pytest.mark.asyncio
async def test_offline_fallback_matches_legacy_rule_weak_conflict(offline):
    """positive + high 선반영이면 fallback 규칙은 0.6(약한 충돌)."""
    si = _standard_input(price_reflection_level="high")
    si.impact_direction = ImpactDirection.POSITIVE
    agent_outputs = build_all_fallback_agent_outputs(si.impact_direction, si.price_reflection_level)
    review, _ = await review_agent_consistency(si, agent_outputs)
    assert review.consistency_score == 0.6


@pytest.mark.asyncio
async def test_review_score_always_clamped(offline):
    si = _standard_input()
    agent_outputs = build_all_fallback_agent_outputs(si.impact_direction, si.price_reflection_level)
    review, _ = await review_agent_consistency(si, agent_outputs)
    assert 0.0 <= review.consistency_score <= 1.0
