"""external_context 테스트 (offline → fallback 경로, retrieve_relevant_documents 는 mock)."""

import pytest

from app.core import external_context
from app.core.external_context import analyze_external_context
from app.schemas.analysis import ExternalContext, ImpactDirection
from app.schemas.request import SelectedStock, SimulationRequest


def _request(text="AI 반도체 수요 증가로 삼성전자 HBM 실적 개선이 기대된다.", code="005930", name="삼성전자"):
    return SimulationRequest(
        user_id="u1",
        selected_stock=SelectedStock(code=code, name=name),
        input_text=text,
    )


@pytest.fixture(autouse=True)
def _no_rag(monkeypatch):
    """기본적으로 RAG 검색은 빈 리스트를 반환하게 한다(테스트별로 필요하면 재정의)."""

    async def _empty(_stock_code, _query_text):
        return []

    monkeypatch.setattr(external_context, "retrieve_relevant_documents", _empty)


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
async def test_rag_sources_populated_from_retrieved_documents(offline, monkeypatch):
    """retrieve_relevant_documents 가 반환한 문서가 rag_sources 에 그대로 반영된다."""

    async def _fake(_stock_code, _query_text):
        return [
            {
                "title": "삼성전자 2026년 2분기 실적발표",
                "source_type": "dart_periodic",
                "published_at": "2026-07-24",
                "content": "HBM 매출 증가...",
            }
        ]

    monkeypatch.setattr(external_context, "retrieve_relevant_documents", _fake)
    _, _, rag_sources = await analyze_external_context(_request())
    assert len(rag_sources) == 1
    assert rag_sources[0].title == "삼성전자 2026년 2분기 실적발표"
    assert rag_sources[0].source_type == "dart_periodic"


@pytest.mark.asyncio
async def test_rag_sources_empty_when_retrieval_returns_nothing(offline):
    """retrieve_relevant_documents 가 빈 리스트를 반환하면 rag_sources 도 빈 리스트."""
    _, _, rag_sources = await analyze_external_context(_request(code="999999", name="테스트종목"))
    assert rag_sources == []


@pytest.mark.asyncio
async def test_rag_retrieval_exception_is_swallowed(offline, monkeypatch):
    """retrieve_relevant_documents 가 예상치 못한 예외를 던져도 전체 흐름은 정상 동작한다."""

    async def _raise(_stock_code, _query_text):
        raise RuntimeError("unexpected")

    monkeypatch.setattr(external_context, "retrieve_relevant_documents", _raise)
    ext, _, rag_sources = await analyze_external_context(_request())
    assert isinstance(ext, ExternalContext)
    assert rag_sources == []
