"""외부 시장 맥락 분석.

가능하면 LLM(llm_client.chat_json)으로 ExternalContext 를 생성하고,
실패하면 fallback_external_context 로 대체한다. 실제 뉴스 API 는 호출하지 않으며
사용자 입력/선택 종목/input_type_hint 와, DART/SEC EDGAR 공시를 기반으로 검색된
참고 자료(document_retrieval.py, RAG)를 사용한다. 검색은 실패해도 예외를 던지지 않으며
결과가 없으면 기존과 동일하게 동작한다.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from ..schemas.analysis import ExternalContext, ImpactDirection, InputType, RagSource
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
        "impact_strength": {"type": "string", "enum": ["low", "medium", "high"]},
        "related_industries": {"type": "array", "items": {"type": "string"}},
        "positive_factors": {"type": "array", "items": {"type": "string"}},
        "negative_factors": {"type": "array", "items": {"type": "string"}},
        "uncertainty_factors": {"type": "array", "items": {"type": "string"}},
        "time_horizon": {"type": "string", "enum": ["short_term", "mid_term", "long_term"]},
    },
    "required": [
        "event_summary", "event_type", "impact_strength",
        "related_industries", "positive_factors", "negative_factors",
        "uncertainty_factors", "time_horizon",
    ],
}


async def _retrieve_documents_safe(
    stock_code: str, query_text: str, published_before: Optional[str] = None
) -> List[dict]:
    """검색 실패는 삼키고 빈 리스트를 반환한다(RAG 는 항상 optional)."""
    try:
        return await retrieve_relevant_documents(stock_code, query_text, published_before)
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


def derive_impact_direction(
    positive_factors: List[str], negative_factors: List[str]
) -> ImpactDirection:
    """방향을 factor 구성에서 결정한다(LLM 이 직접 고르지 않는다).

    LLM 에게 방향을 맡기면 근거를 대지 못하는 상황에서 neutral 로 회피한다 — 정답 기반
    측정에서 159건 중 138건이 neutral 이었고, 프롬프트로 막으려 하자 오히려 늘었다
    (docs/RAG_EVAL_BASELINE.md). 방향을 factor 의 함수로 두면 회피 경로가 사라지고,
    출력된 방향에는 항상 그것을 뒷받침하는 factor 가 존재하게 된다.
    """
    if len(positive_factors) > len(negative_factors):
        return ImpactDirection.POSITIVE
    if len(negative_factors) > len(positive_factors):
        return ImpactDirection.NEGATIVE
    return ImpactDirection.NEUTRAL


def _ensure_uncertainty(ext: ExternalContext) -> ExternalContext:
    """uncertainty_factors 는 최소 1개 이상이어야 한다."""
    if not ext.uncertainty_factors:
        ext.uncertainty_factors = ["LLM 분석 기준 상세 불확실성 미평가"]
    return ext


async def analyze_external_context(
    request: SimulationRequest,
    published_before: Optional[str] = None,
) -> Tuple[ExternalContext, List[str], List[RagSource]]:
    """ExternalContext, fallback_modules, rag_sources(검색된 근거 자료) 를 반환한다.

    published_before(ISO 날짜 문자열)를 주면 그 날짜 이전 공시만 근거로 검색한다.
    과거 시점 평가에서 미래 정보가 섞이는 것을 막기 위한 인자이며, 실서비스 경로는
    주지 않으므로 기존 동작 그대로다.
    """
    industry = get_stock_context_stub(request.selected_stock).industry
    input_type = (
        request.input_type_hint.value
        if isinstance(request.input_type_hint, InputType)
        else "unknown"
    )
    documents = await _retrieve_documents_safe(
        request.selected_stock.code, request.input_text, published_before
    )
    rag_sources = [
        RagSource(
            title=doc["title"],
            source_type=doc["source_type"],
            published_at=doc["published_at"],
        )
        for doc in documents
    ]

    try:
        # response_model 을 넘기지 않는다 — _SCHEMA 에는 impact_direction 이 없고
        # ExternalContext 는 그 필드를 요구하므로, chat_json 안에서 검증하면 반드시
        # 실패한다. 유도값을 채운 뒤 아래에서 ExternalContext 가 직접 검증한다.
        parsed = await chat_json(
            system=_SYSTEM,
            user=_build_user_prompt(request, industry, input_type, documents),
            schema=_SCHEMA,
        )
        parsed["impact_direction"] = derive_impact_direction(
            parsed.get("positive_factors") or [], parsed.get("negative_factors") or []
        )
        ext = ExternalContext(**parsed)
        return _ensure_uncertainty(ext), [], rag_sources
    except Exception:
        ext = fallback_external_context(
            request.selected_stock.name, request.input_text, input_type
        )
        return _ensure_uncertainty(ext), ["external_context"], rag_sources
