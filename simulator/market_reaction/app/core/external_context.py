"""외부 시장 맥락 분석.

가능하면 LLM(llm_client.chat_json)으로 ExternalContext 를 생성하고,
실패하면 fallback_external_context 로 대체한다. 실제 뉴스 API 는 호출하지 않으며
사용자 입력/선택 종목/input_type_hint 와, 지원 종목에 한해 검색된 IR/실적발표 자료
(document_retrieval.py, RAG MVP)를 사용한다. 검색은 실패해도 예외를 던지지 않으며
결과가 없으면 기존과 동일하게 동작한다.
"""

from __future__ import annotations

from typing import List, Tuple

from ..schemas.analysis import ExternalContext, InputType, RagSource
from ..schemas.request import SimulationRequest
from ..services.document_retrieval import retrieve_relevant_documents
from ..services.llm_client import (
    PROMPT_INJECTION_GUARD,
    chat_json,
    wrap_user_content,
)
from ..services.stock_data import get_stock_context_stub
from .fallback import fallback_external_context

_SYSTEM = f"""You are a market analyst. Analyze the given news/event/information about a stock from a general market perspective.

Rules:
- Use only the user-provided text, selected stock information, and general market interpretation.
- Do NOT present pretrained knowledge as current real-time market information.
- Do NOT predict specific stock prices.
- Do NOT recommend buy or sell.
- Analyze the structural impact on the market and industry.
- All string fields with Korean content must be written in Korean.
- Be concise. Each factor should be one short sentence in Korean.
{PROMPT_INJECTION_GUARD}

Output the analysis in the required JSON format."""

_SCHEMA = {
    "type": "object",
    "properties": {
        "event_summary": {"type": "string"},
        "event_type": {
            "type": "string",
            "enum": [
                "earnings", "new_product", "regulation",
                "industry_demand_increase", "industry_demand_decrease",
                "interest_rate_change", "exchange_rate_change", "supply_chain",
                "competition", "management_change", "partnership", "other",
            ],
        },
        "impact_direction": {"type": "string", "enum": ["positive", "negative", "neutral"]},
        "impact_strength": {"type": "string", "enum": ["low", "medium", "high"]},
        "related_industries": {"type": "array", "items": {"type": "string"}},
        "positive_factors": {"type": "array", "items": {"type": "string"}},
        "negative_factors": {"type": "array", "items": {"type": "string"}},
        "uncertainty_factors": {"type": "array", "items": {"type": "string"}},
        "time_horizon": {"type": "string", "enum": ["short_term", "mid_term", "long_term"]},
    },
    "required": [
        "event_summary", "event_type", "impact_direction", "impact_strength",
        "related_industries", "positive_factors", "negative_factors",
        "uncertainty_factors", "time_horizon",
    ],
}


def _retrieve_documents_safe(stock_code: str, query_text: str) -> List[dict]:
    """검색 실패는 삼키고 빈 리스트를 반환한다(RAG 는 항상 optional)."""
    try:
        return retrieve_relevant_documents(stock_code, query_text)
    except Exception:
        return []


def _format_reference_docs(documents: List[dict]) -> str:
    if not documents:
        return ""
    lines = [
        f"- [{doc['published_at']}] {doc['title']}: {doc['content']}" for doc in documents
    ]
    return (
        "\n\nReference IR/earnings materials for this stock (background context, "
        "not user input):\n" + "\n".join(lines)
    )


def _build_user_prompt(
    request: SimulationRequest, industry: str, input_type: str, documents: List[dict]
) -> str:
    return (
        f"Stock: {request.selected_stock.name}\n"
        f"Industry: {industry}\n"
        f"Input type: {input_type}\n"
        f"Content:\n{wrap_user_content(request.input_text)}"
        f"{_format_reference_docs(documents)}\n\n"
        "Analyze the market impact of this information."
    )


def _ensure_uncertainty(ext: ExternalContext) -> ExternalContext:
    """uncertainty_factors 는 최소 1개 이상이어야 한다."""
    if not ext.uncertainty_factors:
        ext.uncertainty_factors = ["LLM 분석 기준 상세 불확실성 미평가"]
    return ext


async def analyze_external_context(
    request: SimulationRequest,
) -> Tuple[ExternalContext, List[str], List[RagSource]]:
    """ExternalContext, fallback_modules, rag_sources(검색된 근거 자료) 를 반환한다."""
    industry = get_stock_context_stub(request.selected_stock).industry
    input_type = (
        request.input_type_hint.value
        if isinstance(request.input_type_hint, InputType)
        else "unknown"
    )
    documents = _retrieve_documents_safe(request.selected_stock.code, request.input_text)
    rag_sources = [
        RagSource(
            title=doc["title"],
            source_type=doc["source_type"],
            published_at=doc["published_at"],
        )
        for doc in documents
    ]

    try:
        parsed = await chat_json(
            system=_SYSTEM,
            user=_build_user_prompt(request, industry, input_type, documents),
            schema=_SCHEMA,
            response_model=ExternalContext,
        )
        ext = ExternalContext(**parsed)
        return _ensure_uncertainty(ext), [], rag_sources
    except Exception:
        ext = fallback_external_context(
            request.selected_stock.name, request.input_text, input_type
        )
        return _ensure_uncertainty(ext), ["external_context"], rag_sources
