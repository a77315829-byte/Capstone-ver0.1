"""external_context 테스트 (offline → fallback 경로)."""

import pytest

from app.core.external_context import analyze_external_context
from app.schemas.analysis import ExternalContext, ImpactDirection
from app.schemas.request import SelectedStock, SimulationRequest


def _request(text="AI 반도체 수요 증가로 삼성전자 HBM 실적 개선이 기대된다."):
    return SimulationRequest(
        user_id="u1",
        selected_stock=SelectedStock(code="005930", name="삼성전자"),
        input_text=text,
    )


@pytest.mark.asyncio
async def test_offline_uses_fallback(offline):
    ext, fallback_modules = await analyze_external_context(_request())
    assert isinstance(ext, ExternalContext)
    assert "external_context" in fallback_modules


@pytest.mark.asyncio
async def test_external_context_schema_and_uncertainty(offline):
    ext, _ = await analyze_external_context(_request())
    assert ext.impact_direction in set(ImpactDirection)
    assert len(ext.related_industries) >= 1
    assert len(ext.uncertainty_factors) >= 1


@pytest.mark.asyncio
async def test_offline_direction_inference(offline):
    pos, _ = await analyze_external_context(
        _request("수요 증가와 실적 개선, 공급 계약 확대로 호조")
    )
    assert pos.impact_direction == ImpactDirection.POSITIVE
