"""시장참여자 에이전트.

5개 에이전트를 asyncio.gather 로 병렬 실행한다. 각 에이전트는 LLM 으로 반응을
생성하고, 실패 시 해당 에이전트만 build_fallback_agent_output 으로 대체한다.
전체 Ollama 실패 시에도 항상 5개 AgentOutput 을 반환한다.

base_weight 는 LLM 이 결정하지 않고 코드 상수로 주입한다.
사용자 보유 상태/평균 매입가/손익 상태는 프롬프트에 포함하지 않는다.
"""

from __future__ import annotations

import asyncio
from typing import List, Tuple

from ..schemas.agent import AgentOutput
from ..schemas.analysis import (
    AgentType,
    InputRelevance,
    ReactionDirection,
    ReactionStrength,
    StandardInput,
)
from ..services.llm_client import (
    PROMPT_INJECTION_GUARD,
    chat_json,
    wrap_user_content,
)
from .fallback import (
    AGENT_NAME_KO,
    AGENT_ORDER,
    BASE_WEIGHTS,
    build_fallback_agent_output,
)

_DIRECTION_KO = {
    ReactionDirection.BUY: "매수",
    ReactionDirection.SELL: "매도",
    ReactionDirection.HOLD: "관망",
}
_STRENGTH_KO = {
    ReactionStrength.LOW: "낮음",
    ReactionStrength.MEDIUM: "중간",
    ReactionStrength.HIGH: "높음",
}

_COMMON_RULES = f"""Rules:
- Choose exactly one reaction_direction: buy, sell, or hold.
- Do NOT give direct investment advice to the user.
- Do NOT predict specific stock prices.
- Write "comment", "key_reasons", and "risk_factors" in Korean.
- Keep comment under 40 Korean characters. 1-3 key_reasons and 1-2 risk_factors.
{PROMPT_INJECTION_GUARD}
Output JSON only."""

_AGENT_SYSTEM = {
    AgentType.INDIVIDUAL_INVESTOR: f"""You are a Korean individual retail investor agent.
You react to trending themes, news buzz, and short-term expectations (FOMO).
"input_relevance" is "high" for trending/buzzy topics, "low" for technical/institutional topics.
{_COMMON_RULES}""",
    AgentType.INSTITUTIONAL_INVESTOR: f"""You are a Korean institutional investor agent (asset management, pension fund).
You focus on earnings fundamentals, valuation, and risk-adjusted returns. You tend to hold when info is already priced in.
"input_relevance" is "high" for earnings/valuation topics, "low" for retail buzz.
{_COMMON_RULES}""",
    AgentType.FOREIGN_INVESTOR: f"""You are a foreign institutional investor agent in the Korean market.
You evaluate global capital flows, currency risk, and global industry trends.
"input_relevance" is "high" for global trends/FX/rates, "low" for purely domestic retail sentiment.
{_COMMON_RULES}""",
    AgentType.SHORT_TERM_INVESTOR: f"""You are a short-term trader agent (swing/day trading).
You focus on momentum, volume, volatility, and news reaction speed over hours to days.
"input_relevance" is "high" for breaking news/volume/momentum, "low" for long-term structural topics.
{_COMMON_RULES}""",
    AgentType.LONG_TERM_INVESTOR: f"""You are a long-term value investor agent (3-5 year horizon).
You focus on sustainable growth, competitive advantage, and long-term earnings. Short-term noise is irrelevant.
"input_relevance" is "high" for structural/long-term drivers, "low" for short-term news.
{_COMMON_RULES}""",
}

_SCHEMA = {
    "type": "object",
    "properties": {
        "reaction_direction": {"type": "string", "enum": ["buy", "sell", "hold"]},
        "reaction_strength": {"type": "string", "enum": ["low", "medium", "high"]},
        "input_relevance": {"type": "string", "enum": ["low", "normal", "high"]},
        "key_reasons": {"type": "array", "items": {"type": "string"}},
        "comment": {"type": "string"},
        "risk_factors": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "reaction_direction", "reaction_strength", "input_relevance",
        "key_reasons", "comment", "risk_factors",
    ],
}


def _build_user_prompt(si: StandardInput) -> str:
    csc = si.current_stock_context
    return (
        "=== Market Analysis ===\n"
        f"Stock: {si.selected_stock}\n"
        f"Event:\n{wrap_user_content(si.event_summary)}\n"
        f"Event type: {si.event_type}\n"
        f"Impact: {si.impact_direction.value} / Strength: {si.impact_strength.value}\n"
        f"Related industries: {', '.join(si.related_industries)}\n"
        f"Time horizon: {si.time_horizon.value}\n\n"
        f"Positive factors:\n{wrap_user_content(', '.join(si.positive_factors))}\n"
        f"Negative factors:\n{wrap_user_content(', '.join(si.negative_factors))}\n"
        f"Uncertainty:\n{wrap_user_content(', '.join(si.uncertainty_factors))}\n\n"
        "=== Current Stock State ===\n"
        f"Price: {csc.current_price}\n"
        f"Daily change: {csc.daily_change_rate}%\n"
        f"Volume: {csc.volume_trend}\n"
        f"Price reflection: {si.price_reflection_level}\n"
        f"Momentum: {si.short_term_momentum}\n"
        f"Volatility: {si.volatility_level}\n\n"
        "Based on your investor perspective, provide your reaction.\n"
        "All Korean text fields (comment, key_reasons, risk_factors) must be in Korean."
    )


def _to_agent_output(agent_type: AgentType, parsed: dict) -> AgentOutput:
    direction = ReactionDirection(parsed["reaction_direction"])
    strength = ReactionStrength(parsed["reaction_strength"])
    relevance = InputRelevance(parsed["input_relevance"])
    key_reasons = [str(x) for x in (parsed.get("key_reasons") or [])]
    comment = str(parsed.get("comment") or "")
    risk_factors = [str(x) for x in (parsed.get("risk_factors") or [])]

    # 의미 있는 출력 보장: 비어 있으면 실패로 간주(fallback 으로 대체)
    if not comment or not key_reasons or not risk_factors:
        raise ValueError("agent output missing required Korean fields")

    return AgentOutput(
        agent_type=agent_type,
        agent_name_ko=AGENT_NAME_KO[agent_type],
        reaction_direction=direction,
        reaction_direction_ko=_DIRECTION_KO[direction],
        reaction_strength=strength,
        reaction_strength_ko=_STRENGTH_KO[strength],
        base_weight=BASE_WEIGHTS[agent_type],
        input_relevance=relevance,
        key_reasons=key_reasons,
        comment=comment,
        risk_factors=risk_factors,
    )


async def run_agent(
    agent_type: AgentType,
    standard_input: StandardInput,
) -> Tuple[AgentOutput, List[str]]:
    """단일 에이전트 실행. 실패 시 해당 에이전트만 fallback 으로 대체."""
    try:
        parsed = await chat_json(
            system=_AGENT_SYSTEM[agent_type],
            user=_build_user_prompt(standard_input),
            schema=_SCHEMA,
        )
        return _to_agent_output(agent_type, parsed), []
    except Exception:
        fallback = build_fallback_agent_output(
            agent_type,
            standard_input.impact_direction,
            standard_input.price_reflection_level,
        )
        return fallback, [f"agent:{agent_type.value}"]


async def run_all_agents(
    standard_input: StandardInput,
) -> Tuple[List[AgentOutput], List[str]]:
    """5개 에이전트를 병렬 실행. 항상 5개 AgentOutput 을 고정 순서로 반환."""
    results = await asyncio.gather(
        *(run_agent(agent_type, standard_input) for agent_type in AGENT_ORDER)
    )
    outputs: List[AgentOutput] = []
    fallback_modules: List[str] = []
    for output, modules in results:
        outputs.append(output)
        fallback_modules.extend(modules)
    return outputs, fallback_modules
