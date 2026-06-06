"""분석 결과 통합.

ExternalContext + RealtimeContext → StandardInput.
불확실성 요인은 두 맥락에서 병합하고 중복을 제거한다.
사용자 보유 상태/평균 매입가/손익 상태는 포함하지 않는다.
"""

from __future__ import annotations

from typing import List, Optional

from ..schemas.analysis import (
    ExternalContext,
    InputType,
    RealtimeContext,
    StandardInput,
)
from ..schemas.request import SimulationRequest


def _merge_unique(*lists: List[str]) -> List[str]:
    """여러 리스트를 순서를 유지하며 병합하고 중복을 제거한다."""
    merged: List[str] = []
    for items in lists:
        for item in items:
            if item not in merged:
                merged.append(item)
    return merged


def build_standard_input(
    request: SimulationRequest,
    external_context: ExternalContext,
    realtime_context: RealtimeContext,
    analysis_confidence: Optional[float] = None,
) -> StandardInput:
    """에이전트 공통 표준 입력(StandardInput)을 생성한다."""
    input_type = (
        request.input_type_hint
        if isinstance(request.input_type_hint, InputType)
        else InputType.UNKNOWN
    )

    uncertainty_factors = _merge_unique(
        external_context.uncertainty_factors,
        realtime_context.internal_risk_factors,
    )

    return StandardInput(
        selected_stock=request.selected_stock.name,
        input_type=input_type,
        event_summary=external_context.event_summary,
        event_type=external_context.event_type,
        impact_direction=external_context.impact_direction,
        impact_strength=external_context.impact_strength,
        related_industries=external_context.related_industries,
        time_horizon=external_context.time_horizon,
        positive_factors=external_context.positive_factors,
        negative_factors=external_context.negative_factors,
        uncertainty_factors=uncertainty_factors,
        current_stock_context=realtime_context.current_stock_context,
        price_reflection_level=realtime_context.price_reflection_level,
        short_term_momentum=realtime_context.short_term_momentum,
        volatility_level=realtime_context.volatility_level,
        agent_focus=realtime_context.agent_focus,
        analysis_confidence=analysis_confidence,
    )
