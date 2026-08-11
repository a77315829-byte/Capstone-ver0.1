"""서비스 설정.

pydantic-settings 기반. `.env` 가 있으면 읽고, 없어도 기본값으로 동작한다.
환경변수 이름은 대문자(API_HOST 등)와 매핑된다(대소문자 무시).
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # 서버
    api_host: str = "0.0.0.0"
    api_port: int = 8002

    # Ollama (LLM client 단계에서 사용 예정)
    ollama_host: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_timeout_seconds: int = 120
    ollama_max_retries: int = 1
    ollama_temperature: float = 0.3

    # RAG (문서 검색) — dart_api_key 는 scripts/build_rag_index.py 전용, 런타임 서비스는 사용 안 함
    dart_api_key: str = ""
    rag_index_dir: str = "data/rag_index"
    ollama_embedding_model: str = "nomic-embed-text"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
