"""에이전트 간 정합성 검토(critic).

5개 에이전트가 모두 실행된 뒤(agents.py 의 병렬 구조는 그대로 유지) 그 결과 전체를
한 번에 보고 단순 의견 불일치(투자자 관점 차이로 자연스러운 것)와 실제 논리적/인과적
모순을 구분하는 별도 LLM 호출 1회를 수행한다. 실패하면 기존 규칙 기반
_fallback_consistency() 로 대체한다.
"""

from __future__ import annotations

from typing import List, Tuple

from ..schemas.agent import AgentOutput
from ..schemas.analysis import ConsistencyReview, ImpactDirection, StandardInput
from ..services.llm_client import PROMPT_INJECTION_GUARD, chat_json, wrap_user_content

_SYSTEM = f"""You review 5 independent investor-agent reactions to the same market event
for internal consistency.

Each agent has its own legitimate perspective (individual/institutional/foreign/short-term/
long-term investor), so disagreement in reaction_direction between agents is NORMAL and
expected — do not flag that alone as a conflict.

Only flag a real conflict when the STATED REASONING is logically inconsistent, for example:
- two agents cite the exact same fact but draw contradictory conclusions from it without
  any perspective-based explanation
- an agent's key_reasons/comment contradicts the overall event impact_direction in a way
  that doesn't fit that agent's own stated judgment criteria
- an agent's reasoning is internally self-contradictory

Score consistency_score from 0.0 (strong, clear contradictions) to 1.0 (fully consistent
given each agent's distinct perspective). List each real conflict in `conflicts` as one
short Korean sentence. If there are no real conflicts, `conflicts` must be an empty list.
Optionally add 0-2 short Korean uncertainty_factors this review surfaces.

{PROMPT_INJECTION_GUARD}
Output JSON only."""

_SCHEMA = {
    "type": "object",
    "properties": {
        "consistency_score": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "conflicts": {"type": "array", "items": {"type": "string"}},
        "uncertainty_factors": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["consistency_score", "conflicts", "uncertainty_factors"],
}


def _agent_summary_line(agent: AgentOutput) -> str:
    reasons = ", ".join(agent.key_reasons) or "(no reasons)"
    return (
        f"- {agent.agent_type.value} ({agent.reaction_direction.value}, "
        f"{agent.reaction_strength.value}): reasons=[{reasons}] comment=\"{agent.comment}\""
    )


def _build_user_prompt(standard_input: StandardInput, agent_outputs: List[AgentOutput]) -> str:
    agents_text = "\n".join(_agent_summary_line(a) for a in agent_outputs)
    return (
        f"Event: {wrap_user_content(standard_input.event_summary)}\n"
        f"Overall impact_direction: {standard_input.impact_direction.value}\n\n"
        f"Agent reactions:\n{agents_text}\n\n"
        "Review these 5 reactions for internal consistency."
    )


def _fallback_consistency(
    standard_input: StandardInput,
) -> ConsistencyReview:
    """LLM 실패 시 대체하는 단순 규칙(기존 service.py:_analysis_consistency 와 동일 기준).

    긍정 영향인데 가격이 이미 크게 반영됐으면 약한 충돌(0.6)로 본다.
    """
    if (
        standard_input.impact_direction == ImpactDirection.POSITIVE
        and standard_input.price_reflection_level == "high"
    ):
        return ConsistencyReview(consistency_score=0.6, conflicts=[], uncertainty_factors=[])
    return ConsistencyReview(consistency_score=1.0, conflicts=[], uncertainty_factors=[])


async def review_agent_consistency(
    standard_input: StandardInput,
    agent_outputs: List[AgentOutput],
) -> Tuple[ConsistencyReview, List[str]]:
    """(ConsistencyReview, fallback_modules) 를 반환한다."""
    try:
        parsed = await chat_json(
            system=_SYSTEM,
            user=_build_user_prompt(standard_input, agent_outputs),
            schema=_SCHEMA,
            response_model=ConsistencyReview,
        )
        review = ConsistencyReview(**parsed)
        review.consistency_score = min(1.0, max(0.0, review.consistency_score))
        return review, []
    except Exception:
        return _fallback_consistency(standard_input), ["critic"]
