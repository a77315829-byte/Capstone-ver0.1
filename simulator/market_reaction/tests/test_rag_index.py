"""rag_index.py 테스트 (FAISS 인덱스/메타데이터/매니페스트 저장·로드)."""

from app.services.rag_index import (
    Chunk,
    build_index,
    load_index,
    load_manifest,
    load_metadata,
    save_index,
    save_manifest,
    save_metadata,
    search,
)


def test_build_and_search_returns_nearest_first():
    vectors = [[1.0, 0.0], [0.0, 1.0], [0.9, 0.1]]
    index = build_index(vectors)
    hits = search(index, [1.0, 0.0], top_k=2)
    assert hits[0][0] == 0  # 가장 가까운 벡터의 vector_id


def test_search_on_empty_index_returns_empty():
    index = build_index([])
    assert search(index, [1.0, 0.0], top_k=2) == []


def test_save_and_load_index_roundtrip(tmp_path):
    vectors = [[1.0, 0.0], [0.0, 1.0]]
    index = build_index(vectors)
    path = tmp_path / "TEST.faiss"
    save_index(index, path)
    loaded = load_index(path)
    hits = search(loaded, [1.0, 0.0], top_k=1)
    assert hits[0][0] == 0


def test_save_and_load_metadata_roundtrip(tmp_path):
    chunks = {
        "005930": [
            Chunk(
                chunk_id="005930:0", vector_id=0, stock_code="005930", title="t",
                source_type="dart_periodic", published_at="2026-07-01", url="http://x",
                text="본문",
            )
        ]
    }
    path = tmp_path / "rag_metadata.json"
    save_metadata(chunks, path)
    loaded = load_metadata(path)
    assert loaded["005930"][0]["text"] == "본문"
    assert loaded["005930"][0]["vector_id"] == 0


def test_save_and_load_manifest_roundtrip(tmp_path):
    path = tmp_path / "rag_manifest.json"
    save_manifest(
        path,
        embedding_model="nomic-embed-text",
        embedding_dim=2,
        created_at="2026-08-11T00:00:00+00:00",
        counts={"stocks": 1},
    )
    manifest = load_manifest(path)
    assert manifest["embedding_model"] == "nomic-embed-text"
    assert manifest["embedding_dim"] == 2
    assert manifest["counts"]["stocks"] == 1
