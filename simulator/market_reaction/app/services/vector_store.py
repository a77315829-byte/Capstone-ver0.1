"""종목별 FAISS 인덱스를 lazy-loading 하는 런타임 검색 캐시.

FAISS 는 영속 저장소가 아니라 검색 캐시일 뿐이다 — 실제 데이터는 MongoDB(rag_repository.py)에
있고, 이 모듈은 cache miss(해당 종목을 아직 캐시에 올린 적 없음) 시에만 MongoDB 를 읽어 메모리에
FAISS 인덱스를 만든다. 이후 같은 종목에 대한 요청은 캐시된 인덱스만 쓴다.

버전 변경 감지는 자동이 아니다 — 서비스 재시작 또는 invalidate() 수동 호출로만 새
rag_version 을 반영한다(요청마다 MongoDB 를 확인하지 않기 위한 의도적 트레이드오프).
"""

from __future__ import annotations

import logging
from collections import OrderedDict
from dataclasses import replace
from typing import List, Optional, Protocol

from ..config import settings
from . import rag_index
from .rag_index import Chunk
from .rag_repository import RagRepository, RagRepositoryError

logger = logging.getLogger(__name__)


class VectorStore(Protocol):
    async def search(
        self, stock_code: str, query_embedding: List[float], top_k: int
    ) -> List[Chunk]: ...


class _CacheEntry:
    def __init__(self, index, chunks: List[Chunk], rag_version: int, embedding_dim: int):
        self.index = index
        self.chunks = chunks
        self.rag_version = rag_version
        self.embedding_dim = embedding_dim


class FaissVectorStore:
    def __init__(self, repository: RagRepository, max_cached_stocks: Optional[int] = None):
        self._repo = repository
        self._max_cached_stocks = max_cached_stocks
        self._cache: "OrderedDict[str, _CacheEntry]" = OrderedDict()

    def invalidate(self, stock_code: Optional[str] = None) -> None:
        """수동 캐시 무효화. stock_code 를 안 주면 전체를 비운다."""
        if stock_code is None:
            self._cache.clear()
        else:
            self._cache.pop(stock_code, None)

    async def search(
        self, stock_code: str, query_embedding: List[float], top_k: int
    ) -> List[Chunk]:
        entry = self._cache.get(stock_code)
        if entry is None:
            entry = await self._load(stock_code)
            if entry is None:
                return []
        if stock_code in self._cache:
            self._cache.move_to_end(stock_code)

        if len(query_embedding) != entry.embedding_dim:
            logger.warning(
                "RAG query embedding dim mismatch for %s: got=%d, expected=%d",
                stock_code, len(query_embedding), entry.embedding_dim,
            )
            return []

        hits = rag_index.search(entry.index, query_embedding, top_k)
        return [entry.chunks[row] for row, _score in hits]

    async def _load(self, stock_code: str) -> Optional[_CacheEntry]:
        try:
            manifest = await self._repo.get_manifest(stock_code)
        except RagRepositoryError as exc:
            logger.warning("RAG manifest fetch failed for %s: %s", stock_code, exc)
            return None
        if manifest is None:
            return None
        if manifest["embedding_model"] != settings.ollama_embedding_model:
            logger.warning(
                "RAG manifest embedding_model mismatch for %s: manifest=%s, settings=%s",
                stock_code, manifest["embedding_model"], settings.ollama_embedding_model,
            )
            return None

        try:
            chunks = await self._repo.get_chunks(stock_code, manifest["rag_version"])
        except RagRepositoryError as exc:
            logger.warning("RAG chunks fetch failed for %s: %s", stock_code, exc)
            return None
        if not chunks:
            return None

        vectors = [c.embedding for c in chunks]
        index = rag_index.build_index(vectors)
        # FAISS 인덱스가 이미 float32 사본을 들고 있으므로, 캐시에 올리는 Chunk 에서는
        # embedding 을 비워 중복 보관하지 않는다(원본 리스트는 건드리지 않고 새로 만든다 —
        # 이 리스트를 넘긴 호출부가 같은 Chunk 객체를 다른 용도로 들고 있을 수 있음).
        chunks = [replace(c, embedding=[]) for c in chunks]
        entry = _CacheEntry(
            index=index, chunks=chunks, rag_version=manifest["rag_version"],
            embedding_dim=manifest["embedding_dimension"],
        )
        self._cache[stock_code] = entry
        self._evict_if_needed()
        return entry

    def _evict_if_needed(self) -> None:
        if self._max_cached_stocks is None:
            return
        while len(self._cache) > self._max_cached_stocks:
            self._cache.popitem(last=False)
