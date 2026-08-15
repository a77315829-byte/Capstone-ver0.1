"""모델 라우팅. LLM_PROVIDER 설정(openai/ollama)은 provider.py가 처리하고,
여기서는 추후 판단 중요도에 따라 로컬/클라우드로 분기할 수 있도록 인터페이스만 고정해둔다.
"""
from typing import Callable
from app.narrative.clients.provider import call_text


def route_narrative_request(*, changed: bool, is_compare: bool) -> Callable[[str, str], str]:
    # TODO: changed=False이고 is_compare=False인 저중요도 케이스는
    #       추후 로컬 모델로 강제 분기 (지금은 LLM_PROVIDER 설정을 그대로 따름)
    return call_text
