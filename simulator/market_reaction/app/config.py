"""서비스 설정.

pydantic-settings 기반. `.env` 가 있으면 읽고, 없어도 기본값으로 동작한다.
환경변수 이름은 대문자(API_HOST 등)와 매핑된다(대소문자 무시).
"""

from __future__ import annotations

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # 서버
    api_host: str = "0.0.0.0"
    api_port: int = 8002

    # Ollama (LLM client 단계에서 사용 예정)
    ollama_host: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_timeout_seconds: int = 120
    ollama_max_retries: int = 0
    ollama_num_predict: int = Field(default=450, ge=64, le=2048)
    ollama_temperature: float = 0.3
    # Finish before the Node gateway's 120-second deadline.
    market_pipeline_timeout_seconds: float = Field(default=110.0, ge=1, le=180)

    # RAG (문서 검색) — dart_api_key 는 scripts/build_rag_index.py 전용, 런타임 서비스는 사용 안 함
    dart_api_key: str = ""
    ollama_embedding_model: str = "bge-m3"

    # MongoDB (RAG 저장소). server/.env 의 STOTRA_MONGODB_* 와 같은 값을 쓰면 같은 Atlas
    # 클러스터/DB 를 공유한다 — 새 컬렉션(rag_chunks/rag_manifest)만 추가된다.
    stotra_mongodb_username: str = ""
    mongodb_uri: str = ""
    stotra_mongodb_password: str = ""
    stotra_mongodb_cluster: str = ""
    mongo_db_name: str = ""
    # Keep school/exhibition sessions bounded when many different stocks are opened.
    rag_max_cached_stocks: int = Field(default=16, ge=0, le=128)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("rag_max_cached_stocks", mode="before")
    @classmethod
    def parse_optional_int(cls, v: str | int | None) -> int:
        """빈 설정도 무제한 캐시가 아닌 전시용 기본 상한을 사용한다."""
        if v == "" or v is None:
            return 16
        return int(v)


settings = Settings()
