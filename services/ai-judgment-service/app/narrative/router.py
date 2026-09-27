"""로컬 문장 생성 라우팅 인터페이스."""
from typing import Callable
from app.narrative.clients.provider import call_text


def route_narrative_request(*, changed: bool, is_compare: bool) -> Callable[[str, str], str]:
    return call_text
