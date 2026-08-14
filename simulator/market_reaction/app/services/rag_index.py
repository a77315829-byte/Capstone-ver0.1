"""FAISS 인덱스 빌드용 자료구조/유틸.

scripts/build_rag_index.py(빌드 — 임베딩 결과를 Chunk 로 다뤄 MongoDB 에 저장)와
app/services/vector_store.py(런타임 — MongoDB 에서 읽어온 청크로 FAISS 인덱스를 메모리에
만듦)가 공용으로 사용한다. 임베딩 벡터는 코사인 유사도 검색을 위해 항상 L2 정규화해서
인덱스에 넣고, 검색 쿼리 벡터도 동일하게 정규화한다.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

import faiss
import numpy as np


@dataclass
class Chunk:
    """청크 하나의 메타데이터. MongoDB `rag_chunks` 컬렉션 문서 1건과 대응한다."""

    chunk_id: str
    stock_code: str
    title: str
    source_type: str
    published_at: str
    url: str
    text: str
    embedding: List[float]
    rag_version: int


def _normalize(vectors: np.ndarray) -> np.ndarray:
    """각 행 벡터를 L2 정규화한다(코사인 유사도를 내적으로 계산하기 위함)."""
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return vectors / norms


def build_index(vectors: List[List[float]]) -> faiss.Index:
    """벡터 목록으로 FAISS IndexFlatIP 를 만든다. 삽입 순서가 곧 검색 결과의 행 번호가 된다."""
    if not vectors:
        return faiss.IndexFlatIP(1)
    arr = _normalize(np.array(vectors, dtype="float32"))
    index = faiss.IndexFlatIP(arr.shape[1])
    index.add(arr)
    return index


def search(index: faiss.Index, query_vector: List[float], top_k: int) -> List[Tuple[int, float]]:
    """(row, score) 목록을 유사도 높은 순으로 반환한다. 인덱스가 비어 있으면 빈 리스트."""
    if index.ntotal == 0:
        return []
    q = _normalize(np.array([query_vector], dtype="float32"))
    k = min(top_k, index.ntotal)
    scores, ids = index.search(q, k)
    return [(int(i), float(s)) for i, s in zip(ids[0], scores[0]) if i != -1]
