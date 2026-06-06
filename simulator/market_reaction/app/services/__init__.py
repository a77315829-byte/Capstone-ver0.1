"""외부 의존 서비스 계층.

- stock_data: 시세 stub (외부 API 미연동)
- llm_client: Ollama /api/chat 비동기 JSON client
"""

from .llm_client import (
    PROMPT_INJECTION_GUARD,
    LLMError,
    chat_json,
    wrap_user_content,
)
from .stock_data import get_stock_context_stub

__all__ = [
    "get_stock_context_stub",
    "chat_json",
    "wrap_user_content",
    "PROMPT_INJECTION_GUARD",
    "LLMError",
]
