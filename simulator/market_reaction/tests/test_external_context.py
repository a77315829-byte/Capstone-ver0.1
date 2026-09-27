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

    async def _empty(_stock_code, _query_text, _published_before=None):
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

    async def _fake(_stock_code, _query_text, _published_before=None):
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


@pytest.mark.asyncio
async def test_published_before_is_applied_to_retrieval(monkeypatch, offline):
    """analyze_external_context 에 넘긴 기준일이 검색까지 전달돼, 이후 공시가 근거에서 빠진다."""
    catalog = [
        {"title": "미래공시", "source_type": "dart_periodic", "published_at": "2026-09-01",
         "content": "가" * 50},
        {"title": "과거공시", "source_type": "dart_periodic", "published_at": "2026-01-01",
         "content": "나" * 50},
    ]

    async def _dated_retrieve(_stock_code, _query_text, published_before=None):
        if published_before is None:
            return catalog
        return [d for d in catalog if d["published_at"] < published_before]

    monkeypatch.setattr(external_context, "retrieve_relevant_documents", _dated_retrieve)

    _ext, _fb, rag_sources = await analyze_external_context(
        _request(), published_before="2026-06-01"
    )

    assert [s.title for s in rag_sources] == ["과거공시"]


# ---------------------------------------------------------------------------
# impact_direction 은 LLM 의 자유 선택이 아니라 factor 에서 유도한다.
# 베이스라인 측정에서 모델이 159건 중 138건을 neutral 로 회피했고, 프롬프트로
# 막으려 하자 오히려 늘었다(docs/RAG_EVAL_BASELINE.md). 그래서 구조를 바꾼다.
# ---------------------------------------------------------------------------


def test_derive_direction_positive_when_positive_factors_outnumber():
    assert external_context.derive_impact_direction(["a", "b"], ["c"]) is ImpactDirection.POSITIVE


def test_derive_direction_negative_when_negative_factors_outnumber():
    assert external_context.derive_impact_direction(["a"], ["b", "c"]) is ImpactDirection.NEGATIVE


def test_derive_direction_neutral_when_balanced():
    assert external_context.derive_impact_direction(["a"], ["b"]) is ImpactDirection.NEUTRAL


def test_derive_direction_neutral_when_no_factors():
    assert external_context.derive_impact_direction([], []) is ImpactDirection.NEUTRAL


@pytest.mark.asyncio
async def test_direction_is_derived_not_taken_from_llm(monkeypatch):
    """LLM 응답에 방향이 없어도 factor 구성으로 방향이 정해진다."""

    async def _fake_chat_json(**kwargs):
        return {
            "event_summary": "요약",
            "event_type": "earnings",
            "impact_strength": "medium",
            "related_industries": ["반도체"],
            "positive_factors": [],
            "negative_factors": ["원가 부담 증가", "수요 둔화"],
            "uncertainty_factors": ["환율"],
            "time_horizon": "short_term",
        }

    monkeypatch.setattr(external_context, "chat_json", _fake_chat_json)

    ext, fallback_modules, _ = await analyze_external_context(_request())

    assert fallback_modules == []
    assert ext.impact_direction is ImpactDirection.NEGATIVE


@pytest.mark.asyncio
async def test_llm_path_does_not_fall_back_when_schema_omits_direction(monkeypatch):
    """출력 스키마가 요구하는 필드만 담은 LLM 응답으로 fallback 없이 파싱돼야 한다.

    chat_json 을 통째로 mock 하면 그 안의 response_model 검증을 건너뛴다. 실제로
    출력 스키마에서 impact_direction 을 빼자 ExternalContext 검증이 실패해 전 요청이
    fallback 으로 빠졌는데, mock 기반 테스트는 이를 통과시켰다. 그래서 여기서는
    HTTP 계층만 가짜로 두고 chat_json 은 실제 코드를 돌린다.
    """
    import json as _json

    import app.services.llm_client as llmc

    payload = {
        "event_summary": "요약",
        "event_type": "earnings",
        "impact_strength": "medium",
        "related_industries": ["반도체"],
        "positive_factors": [],
        "negative_factors": ["원가 부담 증가", "수요 둔화"],
        "uncertainty_factors": ["환율"],
        "time_horizon": "short_term",
    }

    class _Resp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"message": {"content": _json.dumps(payload, ensure_ascii=False)}}

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, *a, **k):
            return _Resp()

    monkeypatch.setattr(llmc.httpx, "AsyncClient", _Client)

    ext, fallback_modules, _ = await analyze_external_context(_request())

    assert fallback_modules == [], "LLM 응답이 정상인데 fallback 으로 빠졌다"
    assert ext.impact_direction is ImpactDirection.NEGATIVE
