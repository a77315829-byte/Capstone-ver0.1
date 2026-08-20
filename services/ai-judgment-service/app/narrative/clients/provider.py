"""LLM_PROVIDER 설정에 따라 gpt_client/ollama_client 중 하나로 분기한다.
router.py는 이 모듈만 통해 LLM을 호출해야 provider 전환이 한 곳에서 관리된다.
"""
from app.config import settings
from app.narrative.clients.gpt_client import call_gpt4o_json, call_gpt4o_text
from app.narrative.clients.ollama_client import call_ollama_json, call_ollama_text


def call_text(system_prompt: str, user_prompt: str) -> str:
    if settings.llm_provider == "ollama":
        return call_ollama_text(system_prompt, user_prompt)
    return call_gpt4o_text(system_prompt, user_prompt)


def call_json(system_prompt: str, user_prompt: str) -> str:
    if settings.llm_provider == "ollama":
        return call_ollama_json(system_prompt, user_prompt)
    return call_gpt4o_json(system_prompt, user_prompt)
