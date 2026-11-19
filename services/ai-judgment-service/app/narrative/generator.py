"""Describe computed scores; unavailable LLMs must not discard a scored judgment."""
import asyncio
import os
from app.narrative.router import route_narrative_request
from app.narrative.prompts.reasoning import build_reasoning_prompt
from app.narrative.prompts.comparison import build_comparison_prompt

def _rule_summary(judge: str, weighted_factors: list[dict]) -> str:
    names = [str(item.get("factor", "")) for item in weighted_factors[:4] if item.get("factor")]
    evidence = ", ".join(names) if names else "확인 가능한 판단 요인 없음"
    return f"규칙 기반 해설: 계산된 판단은 {judge}입니다. 근거: {evidence}. 학습용 규칙 점수이며 수익 확률이 아닙니다."

async def _narrate(system, user, fallback, *, is_compare):
    if os.getenv("AI_MODE") == "rules":
        return fallback
    try:
        call = route_narrative_request(changed=False, is_compare=is_compare)
        text = await asyncio.wait_for(asyncio.to_thread(call, system, user), timeout=15)
        return text.strip() if isinstance(text, str) and text.strip() else fallback
    except Exception:
        return fallback

async def generate_reasoning_summary(judge: str, weighted_factors: list[dict]) -> str:
    system, user = build_reasoning_prompt(judge, weighted_factors)
    return await _narrate(system, user, _rule_summary(judge, weighted_factors), is_compare=False)

async def generate_comparison(user_judge: str, ai_judge: str, weighted_factors: list[dict]) -> str:
    system, user = build_comparison_prompt(user_judge, ai_judge, weighted_factors)
    fallback = _rule_summary(ai_judge, weighted_factors) + f" 사용자의 {user_judge} 판단과 근거를 비교해보세요."
    return await _narrate(system, user, fallback, is_compare=True)
