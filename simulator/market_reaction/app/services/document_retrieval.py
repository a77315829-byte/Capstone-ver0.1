"""종목별 참고문서 검색 (RAG, 런타임).

scripts/build_rag_index.py(오프라인 배치)가 만든 종목별 FAISS 인덱스 + 공용 메타데이터/
매니페스트를, 최초 호출 시 1회 읽어 메모리에 캐시한다. 요청마다 해당 stock_code 의
인덱스에서만 검색하고, 유사도 높은 순으로 순회하며 누적 글자수가 예산을 넘기기 전까지만
청크를 골라 반환한다.

인덱스/매니페스트 파일이 없거나, 매니페스트의 임베딩 모델명·차원이 현재 설정과 다르거나,
임베딩 호출이 실패하면 예외를 던지지 않고 빈 리스트를 반환한다(호출부가 항상 정상
동작하도록 — 기존 계약 유지).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional

from ..config import settings
from . import rag_index
from .embeddings import EmbeddingError, embed_text

logger = logging.getLogger(__name__)

_TOP_K = 5
_CHAR_BUDGET = 4000

_manifest_cache: Optional[dict] = None
_metadata_cache: Optional[Dict[str, List[dict]]] = None
_index_cache: Dict[str, object] = {}


def _reset_cache() -> None:
    """테스트 전용: 모듈 캐시를 초기화한다."""
    global _manifest_cache, _metadata_cache, _index_cache
    _manifest_cache = None
    _metadata_cache = None
    _index_cache = {}


def _index_dir() -> Path:
    return Path(settings.rag_index_dir)


def _load_manifest() -> Optional[dict]:
    global _manifest_cache
    if _manifest_cache is None:
        path = _index_dir() / "rag_manifest.json"
        if not path.exists():
            return None
        _manifest_cache = rag_index.load_manifest(path)
    return _manifest_cache


def _load_metadata() -> Optional[Dict[str, List[dict]]]:
    global _metadata_cache
    if _metadata_cache is None:
        path = _index_dir() / "rag_metadata.json"
        if not path.exists():
            return None
        _metadata_cache = rag_index.load_metadata(path)
    return _metadata_cache


def _load_stock_index(stock_code: str):
    if stock_code not in _index_cache:
        path = _index_dir() / f"{stock_code}.faiss"
        if not path.exists():
            return None
        _index_cache[stock_code] = rag_index.load_index(path)
    return _index_cache[stock_code]


def _find_chunk(chunks: List[dict], vector_id: int) -> Optional[dict]:
    for chunk in chunks:
        if chunk["vector_id"] == vector_id:
            return chunk
    return None


async def retrieve_relevant_documents(stock_code: str, query_text: str) -> List[dict]:
    """query_text 와 유사한 stock_code 청크를 예산 내에서 반환한다.

    반환 형식은 기존 계약과 동일한 dict 목록: {title, source_type, published_at, content}
    (content 는 청크 텍스트). 실패 시 예외를 던지지 않고 빈 리스트를 반환한다.
    """
    manifest = _load_manifest()
    metadata = _load_metadata()
    if manifest is None or metadata is None:
        logger.warning("RAG index/manifest not found under %s", _index_dir())
        return []

    if manifest.get("embedding_model") != settings.ollama_embedding_model:
        logger.warning(
            "RAG manifest embedding_model mismatch: manifest=%s, settings=%s",
            manifest.get("embedding_model"), settings.ollama_embedding_model,
        )
        return []

    chunks = metadata.get(stock_code)
    if not chunks:
        return []

    index = _load_stock_index(stock_code)
    if index is None:
        return []

    try:
        query_vector = await embed_text(query_text)
    except EmbeddingError as exc:
        logger.warning("RAG query embedding failed: %s", exc)
        return []

    if len(query_vector) != manifest.get("embedding_dim"):
        logger.warning(
            "RAG query embedding dim mismatch: got=%d, manifest=%d",
            len(query_vector), manifest.get("embedding_dim"),
        )
        return []

    hits = rag_index.search(index, query_vector, _TOP_K)

    selected: List[dict] = []
    used_chars = 0
    for vector_id, _score in hits:
        chunk = _find_chunk(chunks, vector_id)
        if chunk is None:
            continue
        text = chunk["text"]
        if used_chars + len(text) > _CHAR_BUDGET:
            break
        selected.append(
            {
                "title": chunk["title"],
                "source_type": chunk["source_type"],
                "published_at": chunk["published_at"],
                "content": text,
            }
        )
        used_chars += len(text)

    return selected
