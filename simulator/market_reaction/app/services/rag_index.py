"""FAISS 인덱스 / 청크 메타데이터 / 매니페스트 저장·로드 (RAG 인덱스 I/O).

scripts/build_rag_index.py(빌드)와 app/services/document_retrieval.py(런타임 검색)가
공용으로 사용한다. 임베딩 벡터는 코사인 유사도 검색을 위해 항상 L2 정규화해서 인덱스에
넣고, 검색 쿼리 벡터도 동일하게 정규화한다.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import faiss
import numpy as np


@dataclass
class Chunk:
    """청크 하나의 메타데이터. vector_id 는 해당 청크가 삽입된 FAISS 인덱스의 row 번호다."""

    chunk_id: str
    vector_id: int
    stock_code: str
    title: str
    source_type: str
    published_at: str
    url: str
    text: str


def _normalize(vectors: np.ndarray) -> np.ndarray:
    """각 행 벡터를 L2 정규화한다(코사인 유사도를 내적으로 계산하기 위함)."""
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return vectors / norms


def build_index(vectors: List[List[float]]) -> faiss.Index:
    """벡터 목록으로 FAISS IndexFlatIP 를 만든다. 삽입 순서가 그대로 vector_id 가 된다."""
    if not vectors:
        return faiss.IndexFlatIP(1)
    arr = _normalize(np.array(vectors, dtype="float32"))
    index = faiss.IndexFlatIP(arr.shape[1])
    index.add(arr)
    return index


def save_index(index: faiss.Index, path: Path) -> None:
    faiss.write_index(index, str(path))


def load_index(path: Path) -> faiss.Index:
    return faiss.read_index(str(path))


def search(index: faiss.Index, query_vector: List[float], top_k: int) -> List[Tuple[int, float]]:
    """(vector_id, score) 목록을 유사도 높은 순으로 반환한다. 인덱스가 비어 있으면 빈 리스트."""
    if index.ntotal == 0:
        return []
    q = _normalize(np.array([query_vector], dtype="float32"))
    k = min(top_k, index.ntotal)
    scores, ids = index.search(q, k)
    return [(int(i), float(s)) for i, s in zip(ids[0], scores[0]) if i != -1]


def save_metadata(chunks_by_stock: Dict[str, List[Chunk]], path: Path) -> None:
    """stock_code -> [chunk...] 형태로 저장한다."""
    data = {
        stock_code: [asdict(c) for c in chunks] for stock_code, chunks in chunks_by_stock.items()
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_metadata(path: Path) -> Dict[str, List[dict]]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_manifest(
    path: Path, *, embedding_model: str, embedding_dim: int, created_at: str, counts: dict
) -> None:
    manifest = {
        "created_at": created_at,
        "embedding_model": embedding_model,
        "embedding_dim": embedding_dim,
        "counts": counts,
    }
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def load_manifest(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))
