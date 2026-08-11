"""Ollama /api/embeddings 비동기 client.

llm_client.py 의 chat_json 과 동일한 재시도/타임아웃 정책을 따른다. 실패 시 EmbeddingError 를
던지며, fallback(빈 리스트 반환)은 호출부(document_retrieval.py)의 책임이다.
"""

from __future__ import annotations

from typing import List, Optional

import httpx

from ..config import settings


class EmbeddingError(Exception):
    """임베딩 호출 실패(재시도 후에도 실패)."""


async def embed_text(text: str) -> List[float]:
    """Ollama /api/embeddings 를 호출해 text 의 임베딩 벡터를 반환한다."""
    payload = {"model": settings.ollama_embedding_model, "prompt": text}
    url = f"{settings.ollama_host}/api/embeddings"
    timeout = httpx.Timeout(settings.ollama_timeout_seconds)
    last_error: Optional[Exception] = None

    for _attempt in range(settings.ollama_max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(url, json=payload)
            resp.raise_for_status()
            embedding = resp.json()["embedding"]
            if not isinstance(embedding, list) or not embedding:
                raise ValueError("empty or invalid embedding in response")
            return embedding
        except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
            last_error = exc
            continue

    raise EmbeddingError(f"Embedding call failed after retries: {last_error}")
