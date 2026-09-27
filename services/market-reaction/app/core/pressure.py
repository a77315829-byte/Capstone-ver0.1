"""시장 압력 계산 — 순수 함수.

docs/market_reaction_backend_spec.md 섹션 11, docs/test_fixtures.json 의
pressure_calculation_tests 계약을 따른다. LLM/외부 호출 없음.
"""

from __future__ import annotations

import math
from typing import List

from ..schemas.agent import AgentOutput
from ..schemas.analysis import (
    InputRelevance,
    MarketPressure,
    ReactionDirection,
    ReactionStrength,
)

# 반응 강도 점수
_STRENGTH_SCORE = {
    ReactionStrength.LOW: 1,
    ReactionStrength.MEDIUM: 2,
    ReactionStrength.HIGH: 3,
}

# 입력 관련도 → 숫자 값
_RELEVANCE_VALUE = {
    InputRelevance.LOW: 0.8,
    InputRelevance.NORMAL: 1.0,
    InputRelevance.HIGH: 1.2,
}

# dominant / 잔여값 보정 시 동률 우선순위: hold → buy → sell
_TIE_PRIORITY = (ReactionDirection.HOLD, ReactionDirection.BUY, ReactionDirection.SELL)


def _agent_score(agent: AgentOutput) -> float:
    """agent_score = reaction_strength_score × base_weight × input_relevance_value."""
    strength = _STRENGTH_SCORE[agent.reaction_strength]
    relevance = _RELEVANCE_VALUE[agent.input_relevance]
    return strength * agent.base_weight * relevance


def _round_half_up(value: float) -> int:
    """0 이상 백분율 기준 반올림(.5는 올림)."""
    return math.floor(value + 0.5)


def _headline(dominant: ReactionDirection) -> str:
    if dominant == ReactionDirection.BUY:
        return "현재 시장은 매수 우세 흐름입니다."
    if dominant == ReactionDirection.SELL:
        return "현재 시장은 매도 우세 흐름입니다."
    return "현재 시장은 관망 우세 흐름입니다."


def _resolve_dominant(buy: int, sell: int, hold: int) -> ReactionDirection:
    """가장 큰 압력 항목. 동률이면 hold → buy → sell 우선순위."""
    values = {
        ReactionDirection.BUY: buy,
        ReactionDirection.SELL: sell,
        ReactionDirection.HOLD: hold,
    }
    highest = max(values.values())
    for direction in _TIE_PRIORITY:
        if values[direction] == highest:
            return direction
    return ReactionDirection.HOLD  # 도달하지 않음(방어용)


def calculate_market_pressure(agent_outputs: List[AgentOutput]) -> MarketPressure:
    """에이전트 반응 목록 → 매수/매도/관망 압력(정수 %, 합계 100)."""
    total = sum(_agent_score(a) for a in agent_outputs)

    # total_score == 0(에이전트 없음/전부 0점) → 관망 100으로 방어
    if total <= 0:
        return MarketPressure(
            buy=0,
            sell=0,
            hold=100,
            dominant=ReactionDirection.HOLD,
            headline=_headline(ReactionDirection.HOLD),
        )

    buy_score = sum(
        _agent_score(a)
        for a in agent_outputs
        if a.reaction_direction == ReactionDirection.BUY
    )
    sell_score = sum(
        _agent_score(a)
        for a in agent_outputs
        if a.reaction_direction == ReactionDirection.SELL
    )
    hold_score = sum(
        _agent_score(a)
        for a in agent_outputs
        if a.reaction_direction == ReactionDirection.HOLD
    )

    buy = _round_half_up(buy_score / total * 100)
    sell = _round_half_up(sell_score / total * 100)
    hold = _round_half_up(hold_score / total * 100)

    # 합계가 100이 되도록 보정. 잔여값은 가장 큰 항목에 가산하고,
    # 동률이면 hold → buy → sell 우선순위로 보정한다.
    residual = 100 - (buy + sell + hold)
    if residual != 0:
        values = {
            ReactionDirection.BUY: buy,
            ReactionDirection.SELL: sell,
            ReactionDirection.HOLD: hold,
        }
        highest = max(values.values())
        for direction in _TIE_PRIORITY:
            if values[direction] == highest:
                values[direction] += residual
                break
        buy = values[ReactionDirection.BUY]
        sell = values[ReactionDirection.SELL]
        hold = values[ReactionDirection.HOLD]

    dominant = _resolve_dominant(buy, sell, hold)

    return MarketPressure(
        buy=buy,
        sell=sell,
        hold=hold,
        dominant=dominant,
        headline=_headline(dominant),
    )
