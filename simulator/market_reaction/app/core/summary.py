"""종합 해설 생성.

가능하면 LLM 으로 2~4문장 한국어 해설을 생성하고, 실패 시 fallback_summary 로 대체한다.
직접 매수/매도 추천과 구체적 가격 예측은 하지 않는다.
"""

from __future__ import annotations

from typing import List, Tuple

from ..schemas.agent import AgentOutput
from ..schemas.analysis import MarketPressure, MarketSentiment, StandardInput
from ..services.llm_client import (
    PROMPT_INJECTION_GUARD,
    chat_json,
    wrap_user_content,
)
from .fallback import AGENT_NAME_KO, fallback_summary

_SYSTEM = f"""You are a market analysis summarizer for a Korean stock simulation platform.

Write a comprehensive summary in Korean (2-4 sentences) that:
1. Describes the overall market reaction to the input information.
2. Highlights the difference between aggressive investors (individual, short-term) and cautious investors (institutional, long-term).
3. Mentions key uncertainty factors.
4. Ends with a note that the user should consider uncertainty factors when making decisions.

Rules:
- Write ONLY in Korean.
- Do NOT recommend buy or sell.
- Do NOT predict specific prices.
- Keep it under 200 characters. Use formal polite style.
{PROMPT_INJECTION_GUARD}"""

_SCHEMA = {
    "type": "object",
    "properties": {"summary": {"type": "string"}},
    "required": ["summary"],
}


def _build_user_prompt(
    stock_name: str,
    standard_input: StandardInput,
    market_pressure: MarketPressure,
    market_sentiment: MarketSentiment,
    agent_outputs: List[AgentOutput],
    uncertainty_factors: List[str],
) -> str:
    reactions = "\n".join(
        f"- {AGENT_NAME_KO[a.agent_type]}: {a.reaction_direction.value} / {a.reaction_strength.value}"
        for a in agent_outputs
    )
    return (
        f"Stock: {stock_name}\n"
        f"Event:\n{wrap_user_content(standard_input.event_summary)}\n\n"
        f"Agent reactions:\n{reactions}\n\n"
        f"Market pressure: Buy {market_pressure.buy}% / Sell {market_pressure.sell}% / Hold {market_pressure.hold}%\n"
        f"Sentiment: {market_sentiment.label_ko}\n"
        f"Key uncertainties: {', '.join(uncertainty_factors)}\n\n"
        "Write a 2-4 sentence summary in Korean."
    )


async def generate_summary(
    stock_name: str,
    standard_input: StandardInput,
    market_pressure: MarketPressure,
    market_sentiment: MarketSentiment,
    agent_outputs: List[AgentOutput],
    uncertainty_factors: List[str],
) -> Tuple[str, List[str]]:
    """종합 해설 문자열과 fallback_modules 목록을 반환한다."""
    try:
        parsed = await chat_json(
            system=_SYSTEM,
            user=_build_user_prompt(
                stock_name, standard_input, market_pressure,
                market_sentiment, agent_outputs, uncertainty_factors,
            ),
            schema=_SCHEMA,
        )
        summary = str(parsed.get("summary") or "").strip()
        if not summary:
            raise ValueError("empty summary")
        return summary, []
    except Exception:
        summary = fallback_summary(
            stock_name,
            standard_input.impact_direction,
            market_pressure,
            market_sentiment,
            agent_outputs,
            uncertainty_factors,
        )
        return summary, ["summary"]
