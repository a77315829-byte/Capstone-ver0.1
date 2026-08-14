"""종목별 참고문서 검색 (RAG, 런타임).

MongoDB(rag_repository.py)에 저장된 청크+임베딩을 FaissVectorStore(vector_store.py)로
종목별 lazy-load 해 메모리에 캐시하고, 요청마다 그 캐시에서만 검색한다(cache miss 일 때만
MongoDB 를 읽음). 유사도 높은 순으로 순회하며 누적 글자수가 예산을 넘기기 전까지만 청크를
골라 반환한다.

지원하지 않는 종목이거나, 임베딩 모델·차원이 안 맞거나, MongoDB/임베딩 호출이 실패하면
예외를 던지지 않고 빈 리스트를 반환한다(호출부가 항상 정상 동작하도록 — 기존 계약 유지).
"""

from __future__ import annotations

import logging
from typing import List, Optional

from ..config import settings
from .embeddings import EmbeddingError, embed_text
from .mongo_client import get_database
from .rag_repository import RagRepository
from .vector_store import FaissVectorStore

logger = logging.getLogger(__name__)

_TOP_K = 5
_CHAR_BUDGET = 4000

_store: Optional[FaissVectorStore] = None


def _get_store() -> FaissVectorStore:
    global _store
    if _store is None:
        repository = RagRepository(get_database())
        _store = FaissVectorStore(repository, max_cached_stocks=settings.rag_max_cached_stocks)
    return _store


def _reset_cache() -> None:
    """테스트 전용: 저장소/캐시 싱글턴을 초기화한다."""
    global _store
    _store = None


async def retrieve_relevant_documents(stock_code: str, query_text: str) -> List[dict]:
    """query_text 와 유사한 stock_code 청크를 예산 내에서 반환한다.

    반환 형식은 기존 계약과 동일한 dict 목록: {title, source_type, published_at, content}
    (content 는 청크 텍스트). 실패 시 예외를 던지지 않고 빈 리스트를 반환한다.
    """
    try:
        query_vector = await embed_text(query_text)
    except EmbeddingError as exc:
        logger.warning("RAG query embedding failed: %s", exc)
        return []

    chunks = await _get_store().search(stock_code, query_vector, _TOP_K)

    selected: List[dict] = []
    used_chars = 0
    for chunk in chunks:
        if used_chars + len(chunk.text) > _CHAR_BUDGET:
            break
        selected.append(
            {
                "title": chunk.title,
                "source_type": chunk.source_type,
                "published_at": chunk.published_at,
                "content": chunk.text,
            }
        )
        used_chars += len(chunk.text)

    return selected
