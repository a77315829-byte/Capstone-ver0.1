"""로컬 Ollama 모델 클라이언트. gpt_client.py와 동일한 인터페이스를 제공해
개발/테스트 단계에서 OpenAI 유료 호출 없이 파이프라인을 검증할 수 있게 한다.
사전에 `ollama pull <settings.ollama_model>`로 모델을 받아두고 `ollama serve`를 띄워야 한다.
"""
import httpx

from app.config import settings

_TIMEOUT = httpx.Timeout(120.0)


def _chat(system_prompt: str, user_prompt: str, *, json_mode: bool) -> str:
    payload = {
        "model": settings.ollama_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
    }
    if json_mode:
        payload["format"] = "json"

    response = httpx.post(
        f"{settings.ollama_base_url}/api/chat",
        json=payload,
        timeout=_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()["message"]["content"]


def call_ollama_json(system_prompt: str, user_prompt: str) -> str:
    return _chat(system_prompt, user_prompt, json_mode=True)


def call_ollama_text(system_prompt: str, user_prompt: str) -> str:
    return _chat(system_prompt, user_prompt, json_mode=False)
