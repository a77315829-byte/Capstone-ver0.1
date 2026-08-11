"""external_context 테스트 (offline → fallback 경로)."""

import pytest

from app.core.external_context import analyze_external_context
from app.schemas.analysis import ExternalContext, ImpactDirection
from app.schemas.request import SelectedStock, SimulationRequest


def _request(text="AI 반도체 수요 증가로 삼성전자 HBM 실적 개선이 기대된다.", code="005930", name="삼성전자"):
    return SimulationRequest(
        user_id="u1",
        selected_stock=SelectedStock(code=code, name=name),
        input_text=text,
    )


@pytest.mark.asyncio
async def test_offline_uses_fallback(offline):
    ext, fallback_modules, _ = await analyze_external_context(_request())
    assert isinstance(ext, ExternalContext)
    assert "external_context" in fallback_modules


@pytest.mark.asyncio
async def test_external_context_schema_and_uncertainty(offline):
    ext, _, _ = await analyze_external_context(_request())
    assert ext.impact_direction in set(ImpactDirection)
    assert len(ext.related_industries) >= 1
    assert len(ext.uncertainty_factors) >= 1


@pytest.mark.asyncio
async def test_offline_direction_inference(offline):
    pos, _, _ = await analyze_external_context(
        _request("수요 증가와 실적 개선, 공급 계약 확대로 호조")
    )
    assert pos.impact_direction == ImpactDirection.POSITIVE


@pytest.mark.asyncio
async def test_rag_sources_found_for_supported_stock_with_matching_query(offline):
    """지원 종목(005930) + 문서와 겹치는 키워드(HBM, 실적)가 있으면 근거 자료가 채워진다."""
    _, _, rag_sources = await analyze_external_context(
        _request("삼성전자 HBM 공급 확대와 실적 개선 소식")
    )
    assert len(rag_sources) >= 1
    assert all(s.title and s.source_type and s.published_at for s in rag_sources)


@pytest.mark.asyncio
async def test_rag_sources_empty_for_unsupported_stock(offline):
    """지원하지 않는 종목이면 검색 없이 빈 리스트(예외 없이 정상 동작)."""
    _, _, rag_sources = await analyze_external_context(
        _request("HBM 공급 확대와 실적 개선 소식", code="999999", name="테스트종목")
    )
    assert rag_sources == []


@pytest.mark.asyncio
async def test_rag_sources_empty_when_query_has_no_overlap(offline):
    """지원 종목이어도 문서와 겹치는 키워드가 없으면 빈 리스트."""
    _, _, rag_sources = await analyze_external_context(
        _request("완전히 무관한 날씨 이야기와 여행 계획에 대한 잡담")
    )
    assert rag_sources == []
