"""실시간 모의투자 맥락 분석(rule-based).

stock_data stub(CurrentStockContext)과 external_context(ExternalContext)를 받아
RealtimeContext 를 생성한다. 현재 단계는 LLM 을 호출하지 않으며,
가격 반영 수준/단기 모멘텀/변동성은 순수 함수로 계산하고 agent_focus 는
fallback_agent_focus 를 사용한다.

주의: 사용자 보유 상태/평균 매입가/손익 상태는 사용하지 않는다.
"""

from __future__ import annotations

from typing import List, Optional

from ..schemas.analysis import (
    CurrentStockContext,
    ExternalContext,
    ImpactDirection,
    RealtimeContext,
)
from .fallback import fallback_agent_focus


def determine_price_reflection(
    daily_change_rate: Optional[float],
    volume_trend: str,
    impact_direction: ImpactDirection,
) -> str:
    """최근 가격이 해당 정보를 이미 반영했을 가능성. low/medium/high."""
    rate = daily_change_rate or 0.0
    if impact_direction == ImpactDirection.POSITIVE:
        if rate > 3.0:
            return "high"
        if rate > 1.0:
            return "medium"
        return "low"
    if impact_direction == ImpactDirection.NEGATIVE:
        if rate < -3.0:
            return "high"
        if rate < -1.0:
            return "medium"
        return "low"
    return "low"


def determine_momentum(daily_change_rate: Optional[float], volume_trend: str) -> str:
    """단기 모멘텀. weak/moderate/strong."""
    abs_change = abs(daily_change_rate or 0.0)
    if abs_change > 3.0 and volume_trend == "increasing":
        return "strong"
    if abs_change > 1.0:
        return "moderate"
    return "weak"


def determine_volatility(daily_change_rate: Optional[float]) -> str:
    """변동성 수준. low/medium/high."""
    abs_change = abs(daily_change_rate or 0.0)
    if abs_change > 5.0:
        return "high"
    if abs_change > 2.0:
        return "medium"
    return "low"


def _internal_risk_factors(
    price_reflection_level: str, short_term_momentum: str, volatility_level: str
) -> List[str]:
    risks: List[str] = []
    if volatility_level == "high":
        risks.append("최근 시장 변동성 확대")
    if price_reflection_level == "high":
        risks.append("현재 주가 선반영 가능성")
    if short_term_momentum == "strong":
        risks.append("단기 모멘텀 과열 가능성")
    if not risks:
        risks.append("뚜렷한 내부 리스크 신호 없음")
    return risks


def build_realtime_context(
    current_stock: CurrentStockContext,
    external: ExternalContext,
) -> RealtimeContext:
    """현재 종목 상태 + 외부 맥락 → RealtimeContext."""
    price_reflection_level = determine_price_reflection(
        current_stock.daily_change_rate,
        current_stock.volume_trend,
        external.impact_direction,
    )
    short_term_momentum = determine_momentum(
        current_stock.daily_change_rate, current_stock.volume_trend
    )
    volatility_level = determine_volatility(current_stock.daily_change_rate)

    # fallback_agent_focus 는 dict[str, list[str]] 을 돌려주므로,
    # RealtimeContext.agent_focus(dict[str, str]) 에 맞게 문자열로 합친다.
    focus_lists = fallback_agent_focus(external.impact_direction, price_reflection_level)
    agent_focus = {key: ", ".join(items) for key, items in focus_lists.items()}

    return RealtimeContext(
        current_stock_context=current_stock,
        price_reflection_level=price_reflection_level,
        short_term_momentum=short_term_momentum,
        volatility_level=volatility_level,
        agent_focus=agent_focus,
        internal_risk_factors=_internal_risk_factors(
            price_reflection_level, short_term_momentum, volatility_level
        ),
    )
