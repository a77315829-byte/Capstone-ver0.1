"""MongoDB(rag_chunks/rag_manifest 컬렉션) 접근.

읽기 실패는 RagRepositoryError 로 감싸 던진다 — "데이터 없음"(정상, None/[] 반환)과
"조회 자체가 실패함"(Mongo 연결/쿼리 오류)을 호출부가 구분할 수 있게 하기 위함이다. 이
예외를 catch 해서 warning 로그로 남기고 기존 계약(빈 리스트 반환)을 지키는 책임은 상위
계층(vector_store.py)에 있다. 쓰기 실패는 절대 감싸지 않고 그대로 전파한다(빌드 스크립트는
실패하면 조용히 넘기지 않고 그냥 실패해야 한다).
"""

from __future__ import annotations

from typing import List, Optional

from pymongo.errors import PyMongoError

from .rag_index import Chunk


class RagRepositoryError(Exception):
    """rag_chunks/rag_manifest 읽기 실패(Mongo 연결/쿼리 오류)."""


class RagRepository:
    def __init__(self, database):
        self._chunks = database["rag_chunks"]
        self._manifest = database["rag_manifest"]

    async def get_manifest(self, stock_code: str) -> Optional[dict]:
        try:
            return await self._manifest.find_one({"_id": stock_code})
        except PyMongoError as exc:
            raise RagRepositoryError(
                f"rag_manifest 조회 실패 (stock_code={stock_code}): {exc}"
            ) from exc

    async def get_chunks(self, stock_code: str, rag_version: int) -> List[Chunk]:
        try:
            cursor = self._chunks.find({"stock_code": stock_code, "rag_version": rag_version})
            docs = await cursor.to_list(length=None)
        except PyMongoError as exc:
            raise RagRepositoryError(
                f"rag_chunks 조회 실패 (stock_code={stock_code}): {exc}"
            ) from exc
        return [
            Chunk(
                chunk_id=d["_id"],
                stock_code=d["stock_code"],
                title=d["title"],
                source_type=d["source_type"],
                published_at=d["published_at"],
                url=d["url"],
                text=d["text"],
                embedding=d["embedding"],
                rag_version=d["rag_version"],
            )
            for d in docs
        ]
