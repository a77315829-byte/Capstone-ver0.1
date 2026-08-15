"""GPT-4o 클라이언트. 로컬 테스트용 대안은 ollama_client.py, 전환은 provider.py에서 한다.
"""
from functools import lru_cache

from openai import OpenAI
from app.config import settings


@lru_cache
def _client() -> OpenAI:
    # llm_provider="ollama"일 때는 이 함수가 호출되지 않으므로 OPENAI_API_KEY가 없어도 된다.
    return OpenAI(api_key=settings.openai_api_key)


def call_gpt4o_json(system_prompt: str, user_prompt: str) -> str:
    response = _client().chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        temperature=0.3,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content


def call_gpt4o_text(system_prompt: str, user_prompt: str) -> str:
    response = _client().chat.completions.create(
        model=settings.openai_model,
        temperature=0.4,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content
