"""여러 테스트 파일에서 공용으로 쓰는 인메모리 테스트 더블."""

from __future__ import annotations

from typing import Dict, List, Optional

from app.services.rag_index import Chunk
from app.services.rag_repository import RagRepositoryError


class FakeRagRepository:
    """RagRepository 와 동일한 인터페이스를 갖는 인메모리 구현. 실제 Mongo 대신 쓴다."""

    def __init__(self) -> None:
        self.manifests: Dict[str, dict] = {}
        self.chunks: Dict[str, Chunk] = {}
        self.fail_reads = False
        self.get_manifest_calls = 0
        self.get_chunks_calls = 0

    async def get_manifest(self, stock_code: str) -> Optional[dict]:
        self.get_manifest_calls += 1
        if self.fail_reads:
            raise RagRepositoryError("fake read failure")
        return self.manifests.get(stock_code)

    async def get_chunks(self, stock_code: str, rag_version: int) -> List[Chunk]:
        self.get_chunks_calls += 1
        if self.fail_reads:
            raise RagRepositoryError("fake read failure")
        return [
            c for c in self.chunks.values()
            if c.stock_code == stock_code and c.rag_version == rag_version
        ]

    async def insert_chunks(self, chunks: List[Chunk]) -> None:
        for c in chunks:
            if c.chunk_id in self.chunks:
                raise ValueError(f"duplicate chunk_id: {c.chunk_id}")
        for c in chunks:
            self.chunks[c.chunk_id] = c

    async def upsert_manifest(
        self,
        *,
        stock_code: str,
        rag_version: int,
        embedding_model: str,
        embedding_dimension: int,
        chunk_count: int,
        built_at: str,
    ) -> None:
        self.manifests[stock_code] = {
            "stock_code": stock_code,
            "rag_version": rag_version,
            "embedding_model": embedding_model,
            "embedding_dimension": embedding_dimension,
            "chunk_count": chunk_count,
            "built_at": built_at,
        }

    async def delete_chunks_at_version(self, stock_code: str, rag_version: int) -> None:
        for chunk_id in [
            cid for cid, c in self.chunks.items()
            if c.stock_code == stock_code and c.rag_version == rag_version
        ]:
            del self.chunks[chunk_id]

    async def delete_old_chunks(self, stock_code: str, new_version: int) -> None:
        for chunk_id in [
            cid for cid, c in self.chunks.items()
            if c.stock_code == stock_code and c.rag_version < new_version
        ]:
            del self.chunks[chunk_id]
