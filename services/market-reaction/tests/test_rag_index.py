"""rag_index.py 테스트 (FAISS 인덱스 빌드/검색 유틸)."""

from app.services.rag_index import Chunk, build_index, search


def test_build_and_search_returns_nearest_first():
    vectors = [[1.0, 0.0], [0.0, 1.0], [0.9, 0.1]]
    index = build_index(vectors)
    hits = search(index, [1.0, 0.0], top_k=2)
    assert hits[0][0] == 0  # 가장 가까운 벡터의 행 번호


def test_search_on_empty_index_returns_empty():
    index = build_index([])
    assert search(index, [1.0, 0.0], top_k=2) == []


def test_chunk_holds_embedding_and_rag_version():
    chunk = Chunk(
        chunk_id="005930:1:0", stock_code="005930", title="t", source_type="dart_periodic",
        published_at="2026-07-01", url="http://x", text="본문", embedding=[0.1, 0.2],
        rag_version=1,
    )
    assert chunk.embedding == [0.1, 0.2]
    assert chunk.rag_version == 1
