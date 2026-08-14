"""document_retrieval.py 테스트 (FaissVectorStore 기반 런타임 검색)."""

import pytest

from app.services import document_retrieval
from app.services.rag_index import Chunk
from app.services.vector_store import FaissVectorStore
from tests.fakes import FakeRagRepository


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    document_retrieval._reset_cache()
    monkeypatch.setattr(document_retrieval.settings, "ollama_embedding_model", "bge-m3")
    yield
    document_retrieval._reset_cache()


def _inject_store(repo):
    document_retrieval._store = FaissVectorStore(repo)


def _seed(repo, stock_code, chunk_specs, embedding_model="bge-m3"):
    """chunk_specs: [(chunk_kwargs, vector), ...]. chunk_kwargs 는 title/source_type/
    published_at/url/text."""
    for i, (chunk_kwargs, vector) in enumerate(chunk_specs):
        chunk = Chunk(
            chunk_id=f"{stock_code}:1:{i}", stock_code=stock_code, embedding=vector,
            rag_version=1, **chunk_kwargs,
        )
        repo.chunks[chunk.chunk_id] = chunk
    repo.manifests[stock_code] = {
        "stock_code": stock_code, "rag_version": 1, "embedding_model": embedding_model,
        "embedding_dimension": len(chunk_specs[0][1]), "chunk_count": len(chunk_specs),
        "built_at": "2026-08-14T00:00:00+00:00",
    }


@pytest.mark.asyncio
async def test_no_data_returns_empty(monkeypatch):
    repo = FakeRagRepository()
    _inject_store(repo)

    async def _embed(_text):
        return [1.0, 0.0]

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "삼성전자 실적")
    assert docs == []


@pytest.mark.asyncio
async def test_unsupported_stock_returns_empty(monkeypatch):
    repo = FakeRagRepository()
    _seed(repo, "005930", [
        ({"title": "t", "source_type": "dart_periodic", "published_at": "2026-07-24",
          "url": "http://x", "text": "가" * 100}, [1.0, 0.0]),
    ])
    _inject_store(repo)

    async def _embed(_text):
        return [1.0, 0.0]

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("999999", "무관한 종목")
    assert docs == []


@pytest.mark.asyncio
async def test_returns_nearest_chunk_first(monkeypatch):
    repo = FakeRagRepository()
    _seed(repo, "005930", [
        ({"title": "삼성전자 2026년 2분기 실적발표", "source_type": "dart_periodic",
          "published_at": "2026-07-24", "url": "http://x", "text": "가" * 100}, [1.0, 0.0]),
        ({"title": "삼성전자 IR 자료", "source_type": "dart_material",
          "published_at": "2026-06-10", "url": "http://y", "text": "나" * 100}, [0.0, 1.0]),
    ])
    _inject_store(repo)

    async def _embed(_text):
        return [1.0, 0.0]

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "삼성전자 실적")
    assert len(docs) == 2
    assert docs[0]["title"] == "삼성전자 2026년 2분기 실적발표"
    assert docs[0]["content"] == "가" * 100


@pytest.mark.asyncio
async def test_budget_cuts_off_before_exceeding(monkeypatch):
    repo = FakeRagRepository()
    _seed(repo, "005930", [
        ({"title": "문서1", "source_type": "dart_periodic", "published_at": "2026-07-24",
          "url": "http://x", "text": "가" * 3000}, [1.0, 0.0]),
        ({"title": "문서2", "source_type": "dart_periodic", "published_at": "2026-06-10",
          "url": "http://y", "text": "나" * 1500}, [0.9, 0.1]),
    ])
    _inject_store(repo)

    async def _embed(_text):
        return [1.0, 0.0]

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "질문")
    assert len(docs) == 1
    assert docs[0]["title"] == "문서1"


@pytest.mark.asyncio
async def test_manifest_model_mismatch_returns_empty(monkeypatch):
    repo = FakeRagRepository()
    _seed(repo, "005930", [
        ({"title": "t", "source_type": "dart_periodic", "published_at": "2026-07-24",
          "url": "http://x", "text": "가" * 100}, [1.0, 0.0]),
    ], embedding_model="다른모델")
    _inject_store(repo)

    async def _embed(_text):
        return [1.0, 0.0]

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "삼성전자 실적")
    assert docs == []


@pytest.mark.asyncio
async def test_query_embedding_dim_mismatch_returns_empty(monkeypatch):
    repo = FakeRagRepository()
    _seed(repo, "005930", [
        ({"title": "t", "source_type": "dart_periodic", "published_at": "2026-07-24",
          "url": "http://x", "text": "가" * 100}, [1.0, 0.0]),
    ])
    _inject_store(repo)

    async def _embed(_text):
        return [1.0, 0.0, 0.0]  # manifest(2차원)와 다른 3차원

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "삼성전자 실적")
    assert docs == []


@pytest.mark.asyncio
async def test_embedding_failure_returns_empty(monkeypatch):
    repo = FakeRagRepository()
    _seed(repo, "005930", [
        ({"title": "t", "source_type": "dart_periodic", "published_at": "2026-07-24",
          "url": "http://x", "text": "가" * 100}, [1.0, 0.0]),
    ])
    _inject_store(repo)

    async def _raise(_text):
        raise document_retrieval.EmbeddingError("boom")

    monkeypatch.setattr(document_retrieval, "embed_text", _raise)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "삼성전자 실적")
    assert docs == []


@pytest.mark.asyncio
async def test_repository_failure_returns_empty(monkeypatch):
    repo = FakeRagRepository()
    repo.fail_reads = True
    _inject_store(repo)

    async def _embed(_text):
        return [1.0, 0.0]

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "삼성전자 실적")
    assert docs == []
