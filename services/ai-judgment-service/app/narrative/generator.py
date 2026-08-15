"""판단/요인 숫자를 문장으로 바꾸는 유일한 진입점.
scoring 모듈의 출력을 입력으로만 받고, 숫자는 절대 재계산하지 않는다.
"""
import asyncio
from app.narrative.router import route_narrative_request
from app.narrative.prompts.reasoning import build_reasoning_prompt
from app.narrative.prompts.comparison import build_comparison_prompt


async def generate_reasoning_summary(judge: str, weighted_factors: list[dict]) -> str:
    system, user = build_reasoning_prompt(judge, weighted_factors)
    call = route_narrative_request(changed=False, is_compare=False)
    return await asyncio.to_thread(call, system, user)


async def generate_comparison(user_judge: str, ai_judge: str, weighted_factors: list[dict]) -> str:
    system, user = build_comparison_prompt(user_judge, ai_judge, weighted_factors)
    call = route_narrative_request(changed=False, is_compare=True)
    return await asyncio.to_thread(call, system, user)
