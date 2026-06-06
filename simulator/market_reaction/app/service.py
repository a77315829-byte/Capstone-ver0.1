"""시장 반응 시뮬레이션 파이프라인 오케스트레이션.

stateless 분석 API. DB 저장 없음(db_save_status 는 항상 "not_used").
Ollama 가 꺼져 있어도 fallback 으로 정상 SimulationResponse 를 반환한다.
입력 자체가 부적합하면 SimulationRejectedError 를 발생시킨다.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List

from .config import settings
from .core.agents import run_all_agents
from .core.confidence import (
    calculate_analysis_confidence,
    score_input_specificity,
    score_uncertainty,
)
from .core.external_context import analyze_external_context
from .core.integrator import build_standard_input
from .core.pressure import calculate_market_pressure
from .core.realtime_context import build_realtime_context
from .core.sentiment import determine_market_sentiment
from .core.summary import generate_summary
from .core.validator import is_valid, validate_simulation_input
from .schemas.analysis import (
    DbSaveStatus,
    ExternalContext,
    ImpactDirection,
    ImpactStrength,
    LlmStatus,
    RealtimeContext,
    SimulationMeta,
    StandardInput,
    TimeHorizon,
)
from .schemas.request import SimulationRequest
from .schemas.response import ImpactAnalysis, SimulationResponse
from .services.stock_data import get_stock_context_stub

# LLM 호출 단계 총 개수: external_context(1) + agents(5) + summary(1) = 7
_TOTAL_LLM_MODULES = 7

_IMPACT_DIRECTION_KO = {
    ImpactDirection.POSITIVE: "긍정",
    ImpactDirection.NEGATIVE: "부정",
    ImpactDirection.NEUTRAL: "중립",
}
_IMPACT_STRENGTH_KO = {
    ImpactStrength.LOW: "낮음",
    ImpactStrength.MEDIUM: "중간",
    ImpactStrength.HIGH: "높음",
}
_TIME_HORIZON_KO = {
    TimeHorizon.SHORT_TERM: "단기",
    TimeHorizon.MID_TERM: "중기",
    TimeHorizon.LONG_TERM: "장기",
}


class SimulationRejectedError(Exception):
    """입력값 부적합으로 분석을 거절. API 에서 422 로 변환한다."""

    def __init__(self, reason_code: str, message: str):
        self.reason_code = reason_code
        self.message = message
        super().__init__(f"{reason_code}: {message}")


def _llm_status(fallback_modules: List[str]) -> LlmStatus:
    count = len(fallback_modules)
    if count == 0:
        return LlmStatus.OK
    if count >= _TOTAL_LLM_MODULES:
        return LlmStatus.FALLBACK
    return LlmStatus.PARTIAL_FAILURE


def _stock_relevance(request: SimulationRequest) -> float:
    return 1.0 if request.selected_stock.name in request.input_text else 0.7


def _analysis_consistency(
    external: ExternalContext, realtime: RealtimeContext
) -> float:
    # 긍정 영향인데 가격이 이미 크게 반영됐으면 약한 충돌로 본다.
    if (
        external.impact_direction == ImpactDirection.POSITIVE
        and realtime.price_reflection_level == "high"
    ):
        return 0.6
    return 1.0


def _key_keywords(external: ExternalContext) -> List[str]:
    keywords = external.positive_factors[:3] or external.related_industries[:3]
    return keywords or ["분석 키워드"]


def _build_impact_analysis(standard_input: StandardInput, external: ExternalContext) -> ImpactAnalysis:
    return ImpactAnalysis(
        impact_direction=standard_input.impact_direction,
        impact_direction_ko=_IMPACT_DIRECTION_KO[standard_input.impact_direction],
        impact_strength=standard_input.impact_strength,
        impact_strength_ko=_IMPACT_STRENGTH_KO[standard_input.impact_strength],
        related_industries=standard_input.related_industries,
        time_horizon=standard_input.time_horizon,
        time_horizon_ko=_TIME_HORIZON_KO[standard_input.time_horizon],
        key_keywords=_key_keywords(external),
    )


async def run_market_reaction_simulation(
    request: SimulationRequest,
) -> SimulationResponse:
    # 1) 입력 검증
    classification = validate_simulation_input(request)
    if not is_valid(classification):
        raise SimulationRejectedError(
            reason_code=classification.reason_code or "UNANALYZABLE",
            message=classification.message or "분석할 수 없는 입력입니다.",
        )

    fallback_modules: List[str] = []

    # 2) 외부 시장 맥락 분석
    external_context, fb_external = await analyze_external_context(request)
    fallback_modules.extend(fb_external)

    # 3) 실시간 모의투자 맥락 분석(시세 stub)
    current_stock = get_stock_context_stub(request.selected_stock)
    realtime_context = build_realtime_context(current_stock, external_context)

    # 4) 분석 결과 통합(불확실성 병합)
    standard_input = build_standard_input(request, external_context, realtime_context)
    uncertainty_factors = standard_input.uncertainty_factors

    # 5) 5개 에이전트 실행
    agent_outputs, fb_agents = await run_all_agents(standard_input)
    fallback_modules.extend(fb_agents)

    # 6) 시장 압력 / 분위기
    market_pressure = calculate_market_pressure(agent_outputs)
    market_sentiment = determine_market_sentiment(market_pressure)

    # 7) 종합 해설
    overall_explanation, fb_summary = await generate_summary(
        request.selected_stock.name, standard_input, market_pressure,
        market_sentiment, agent_outputs, uncertainty_factors,
    )
    fallback_modules.extend(fb_summary)

    # 8) 분석 신뢰도(전체 fallback 개수 + stub 감점 반영)
    analysis_confidence = calculate_analysis_confidence(
        input_specificity=score_input_specificity(request.input_text),
        stock_relevance=_stock_relevance(request),
        data_completeness=0.3,  # stub 사용
        analysis_consistency=_analysis_consistency(external_context, realtime_context),
        uncertainty_score=score_uncertainty(len(uncertainty_factors)),
        fallback_modules_count=len(fallback_modules),
        uses_stub_stock_data=True,
    )
    standard_input.analysis_confidence = analysis_confidence.score

    # 9) meta
    meta = SimulationMeta(
        llm_model=settings.ollama_model,
        llm_status=_llm_status(fallback_modules),
        fallback_used=bool(fallback_modules),
        fallback_modules=fallback_modules,
        stock_data_source=current_stock.data_source,
        db_save_status=DbSaveStatus.NOT_USED,
    )

    return SimulationResponse(
        simulation_id=f"sim_{uuid.uuid4().hex[:12]}",
        selected_stock=request.selected_stock,
        input_text=request.input_text,
        input_type=classification.input_type,
        impact_analysis=_build_impact_analysis(standard_input, external_context),
        current_stock_context=current_stock,
        market_pressure=market_pressure,
        market_sentiment=market_sentiment,
        analysis_confidence=analysis_confidence,
        uncertainty_factors=uncertainty_factors,
        agent_reactions=agent_outputs,
        overall_explanation=overall_explanation,
        meta=meta,
        created_at=datetime.now(timezone.utc),
    )
