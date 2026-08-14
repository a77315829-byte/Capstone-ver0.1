"""FaissVectorStore 테스트 (cache hit/miss, invalidate, LRU eviction, 저장소 오류 처리)."""

import pytest

from app.services.rag_index import Chunk
from app.services.vector_store import FaissVectorStore
from tests.fakes import FakeRagRepository


def _make_chunk(stock_code, rag_version, seq, embedding):
    return Chunk(
        chunk_id=f"{stock_code}:{rag_version}:{seq}", stock_code=stock_code, title=f"t{seq}",
        source_type="dart_periodic", published_at="2026-07-01", url="http://x",
        text="본문", embedding=embedding, rag_version=rag_version,
    )


def _seed(repo, stock_code, rag_version, vectors):
    for i, v in enumerate(vectors):
        chunk = _make_chunk(stock_code, rag_version, i, v)
        repo.chunks[chunk.chunk_id] = chunk
    repo.manifests[stock_code] = {
        "stock_code": stock_code, "rag_version": rag_version, "embedding_model": "bge-m3",
        "embedding_dimension": len(vectors[0]), "chunk_count": len(vectors),
        "built_at": "2026-08-14T00:00:00+00:00",
    }


@pytest.mark.asyncio
async def test_cache_miss_then_hit_calls_repository_once():
    repo = FakeRagRepository()
    _seed(repo, "005930", 1, [[1.0, 0.0], [0.0, 1.0]])
    store = FaissVectorStore(repo)

    hits1 = await store.search("005930", [1.0, 0.0], top_k=1)
    hits2 = await store.search("005930", [1.0, 0.0], top_k=1)

    assert hits1[0].chunk_id == "005930:1:0"
    assert hits2[0].chunk_id == "005930:1:0"
    assert repo.get_manifest_calls == 1
    assert repo.get_chunks_calls == 1


@pytest.mark.asyncio
async def test_cached_chunk_embedding_is_cleared_after_index_build():
    """FAISS 가 이미 벡터를 들고 있으므로, 캐시된 Chunk 는 embedding 을 들고 있지 않아야
    한다(메모리 절약). 원본 repo 에 저장된 Chunk 는 건드리지 않는다."""
    repo = FakeRagRepository()
    _seed(repo, "005930", 1, [[1.0, 0.0], [0.0, 1.0]])
    store = FaissVectorStore(repo)

    hits = await store.search("005930", [1.0, 0.0], top_k=1)

    assert hits[0].embedding == []
    assert repo.chunks["005930:1:0"].embedding == [1.0, 0.0]


@pytest.mark.asyncio
async def test_unknown_stock_returns_empty_without_error():
    repo = FakeRagRepository()
    store = FaissVectorStore(repo)
    assert await store.search("999999", [1.0, 0.0], top_k=1) == []


@pytest.mark.asyncio
async def test_invalidate_forces_reload_from_repository():
    repo = FakeRagRepository()
    _seed(repo, "005930", 1, [[1.0, 0.0]])
    store = FaissVectorStore(repo)
    await store.search("005930", [1.0, 0.0], top_k=1)

    store.invalidate("005930")
    await store.search("005930", [1.0, 0.0], top_k=1)

    assert repo.get_manifest_calls == 2


@pytest.mark.asyncio
async def test_repository_read_failure_returns_empty_list():
    repo = FakeRagRepository()
    repo.fail_reads = True
    store = FaissVectorStore(repo)
    assert await store.search("005930", [1.0, 0.0], top_k=1) == []


@pytest.mark.asyncio
async def test_query_embedding_dim_mismatch_returns_empty():
    repo = FakeRagRepository()
    _seed(repo, "005930", 1, [[1.0, 0.0]])
    store = FaissVectorStore(repo)
    assert await store.search("005930", [1.0, 0.0, 0.0], top_k=1) == []


@pytest.mark.asyncio
async def test_max_cached_stocks_evicts_least_recently_used():
    repo = FakeRagRepository()
    _seed(repo, "AAA", 1, [[1.0, 0.0]])
    _seed(repo, "BBB", 1, [[1.0, 0.0]])
    _seed(repo, "CCC", 1, [[1.0, 0.0]])
    store = FaissVectorStore(repo, max_cached_stocks=2)

    await store.search("AAA", [1.0, 0.0], top_k=1)
    await store.search("BBB", [1.0, 0.0], top_k=1)
    await store.search("CCC", [1.0, 0.0], top_k=1)  # AAA 가 evict 되어야 함
    await store.search("AAA", [1.0, 0.0], top_k=1)  # 재조회 발생

    assert repo.get_manifest_calls == 4
