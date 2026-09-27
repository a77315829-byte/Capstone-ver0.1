"""로컬 Ollama 호출 경계.

상용 모델 공급자 선택지를 두지 않아 환경 설정 실수로 외부 LLM을 호출할 수 없다.
"""
from app.narrative.clients.ollama_client import call_ollama_json, call_ollama_text


def call_text(system_prompt: str, user_prompt: str) -> str:
    return call_ollama_text(system_prompt, user_prompt)


def call_json(system_prompt: str, user_prompt: str) -> str:
    return call_ollama_json(system_prompt, user_prompt)
