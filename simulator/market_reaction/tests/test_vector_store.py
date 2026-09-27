"""FaissVectorStore 테스트 (cache hit/miss, invalidate, LRU eviction, 저장소 오류 처리)."""

import pytest

from app.services.rag_index import Chunk
from app.services.vector_store import FaissVectorStore
from tests.fakes import FakeRagRepository


def _make_chunk(stock_code, rag_version, seq, embedding, published_at="2026-07-01"):
    return Chunk(
        chunk_id=f"{stock_code}:{rag_version}:{seq}", stock_code=stock_code, title=f"t{seq}",
        source_type="dart_periodic", published_at=published_at, url="http://x",
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
async def test_max_cached_stocks_zero_does_not_raise():
    """max_cached_stocks=0 이면 load 직후 바로 evict 돼서 캐시가 비는데, 그 뒤 move_to_end
    호출이 KeyError 를 던지면 안 된다(never-raises 설계 의도 유지)."""
    repo = FakeRagRepository()
    _seed(repo, "005930", 1, [[1.0, 0.0]])
    store = FaissVectorStore(repo, max_cached_stocks=0)

    hits = await store.search("005930", [1.0, 0.0], top_k=1)

    assert hits[0].chunk_id == "005930:1:0"


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


def _seed_dated(repo, stock_code, specs):
    """specs: [(vector, published_at), ...]"""
    for i, (vector, published_at) in enumerate(specs):
        chunk = _make_chunk(stock_code, 1, i, vector, published_at=published_at)
        repo.chunks[chunk.chunk_id] = chunk
    repo.manifests[stock_code] = {
        "stock_code": stock_code, "rag_version": 1, "embedding_model": "bge-m3",
        "embedding_dimension": len(specs[0][0]), "chunk_count": len(specs),
        "built_at": "2026-08-14T00:00:00+00:00",
    }


@pytest.mark.asyncio
async def test_published_before_excludes_later_filings():
    """published_before 이후에 공시된 청크는 검색 결과에서 빠진다(미래 정보 누출 방지)."""
    repo = FakeRagRepository()
    _seed_dated(repo, "005930", [
        ([1.0, 0.0], "2026-09-01"),   # 질의와 가장 유사하지만 기준일 이후
        ([0.0, 1.0], "2026-01-01"),   # 과거
    ])
    store = FaissVectorStore(repo)

    hits = await store.search("005930", [1.0, 0.0], top_k=2, published_before="2026-06-01")

    assert [h.chunk_id for h in hits] == ["005930:1:1"]


@pytest.mark.asyncio
async def test_published_before_falls_back_to_lower_ranked_past_chunk():
    """상위 유사도 청크가 전부 기준일 이후여도, 더 낮은 순위의 과거 청크로 top_k 를 채운다.

    사후 필터링(top_k 만 뽑고 나서 거르기)으로 구현하면 빈 결과가 나와 이 테스트가 깨진다.
    """
    repo = FakeRagRepository()
    _seed_dated(repo, "005930", [
        ([1.0, 0.0], "2026-09-01"),   # 1순위, 기준일 이후 → 제외돼야 함
        ([0.9, 0.1], "2026-01-01"),   # 2순위, 과거 → 이게 반환돼야 함
    ])
    store = FaissVectorStore(repo)

    hits = await store.search("005930", [1.0, 0.0], top_k=1, published_before="2026-06-01")

    assert [h.chunk_id for h in hits] == ["005930:1:1"]


@pytest.mark.asyncio
async def test_published_before_none_keeps_existing_behavior():
    """published_before 를 주지 않으면 날짜와 무관하게 기존대로 유사도 순으로 반환한다."""
    repo = FakeRagRepository()
    _seed_dated(repo, "005930", [
        ([1.0, 0.0], "2026-09-01"),
        ([0.0, 1.0], "2026-01-01"),
    ])
    store = FaissVectorStore(repo)

    hits = await store.search("005930", [1.0, 0.0], top_k=1)

    assert [h.chunk_id for h in hits] == ["005930:1:0"]
