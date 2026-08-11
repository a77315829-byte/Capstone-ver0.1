"""document_retrieval.py 테스트 (FAISS 인덱스 기반 런타임 검색)."""

import pytest

from app.services import document_retrieval, rag_index


@pytest.fixture(autouse=True)
def _reset(monkeypatch, tmp_path):
    """각 테스트마다 모듈 캐시를 비우고 rag_index_dir 를 tmp_path 로 돌린다."""
    document_retrieval._reset_cache()
    monkeypatch.setattr(document_retrieval.settings, "rag_index_dir", str(tmp_path))
    monkeypatch.setattr(document_retrieval.settings, "ollama_embedding_model", "nomic-embed-text")
    yield tmp_path
    document_retrieval._reset_cache()


def _write_fixture_index(index_dir, stock_code="005930", embedding_dim=2):
    """005930 종목에 청크 2개짜리 인덱스를 만든다.

    벡터 [1,0] 은 chunk0(가까움), [0,1] 은 chunk1(멂) 에 대응한다.
    """
    chunks = {
        stock_code: [
            rag_index.Chunk(
                chunk_id=f"{stock_code}:0", vector_id=0, stock_code=stock_code,
                title="삼성전자 2026년 2분기 실적발표", source_type="dart_periodic",
                published_at="2026-07-24", url="http://x", text="가" * 100,
            ),
            rag_index.Chunk(
                chunk_id=f"{stock_code}:1", vector_id=1, stock_code=stock_code,
                title="삼성전자 IR 자료", source_type="dart_material",
                published_at="2026-06-10", url="http://y", text="나" * 100,
            ),
        ]
    }
    vectors = [[1.0, 0.0], [0.0, 1.0]]
    index = rag_index.build_index(vectors)
    rag_index.save_index(index, index_dir / f"{stock_code}.faiss")
    rag_index.save_metadata(chunks, index_dir / "rag_metadata.json")
    rag_index.save_manifest(
        index_dir / "rag_manifest.json",
        embedding_model="nomic-embed-text",
        embedding_dim=embedding_dim,
        created_at="2026-08-11T00:00:00+00:00",
        counts={"stocks": 1, "chunks": 2},
    )


@pytest.mark.asyncio
async def test_no_index_files_returns_empty(_reset, monkeypatch):
    async def _embed(_text):
        return [1.0, 0.0]

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "삼성전자 실적")
    assert docs == []


@pytest.mark.asyncio
async def test_unsupported_stock_returns_empty(_reset, monkeypatch):
    _write_fixture_index(_reset)

    async def _embed(_text):
        return [1.0, 0.0]

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("999999", "무관한 종목")
    assert docs == []


@pytest.mark.asyncio
async def test_returns_nearest_chunk_first(_reset, monkeypatch):
    _write_fixture_index(_reset)

    async def _embed(_text):
        return [1.0, 0.0]  # chunk0 과 정확히 같은 방향

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "삼성전자 실적")
    assert len(docs) == 2
    assert docs[0]["title"] == "삼성전자 2026년 2분기 실적발표"
    assert docs[0]["content"] == "가" * 100


@pytest.mark.asyncio
async def test_budget_cuts_off_before_exceeding(_reset, monkeypatch):
    index_dir = _reset
    chunks = {
        "005930": [
            rag_index.Chunk(
                chunk_id="005930:0", vector_id=0, stock_code="005930", title="문서1",
                source_type="dart_periodic", published_at="2026-07-24", url="http://x",
                text="가" * 3000,
            ),
            rag_index.Chunk(
                chunk_id="005930:1", vector_id=1, stock_code="005930", title="문서2",
                source_type="dart_periodic", published_at="2026-06-10", url="http://y",
                text="나" * 1500,
            ),
        ]
    }
    vectors = [[1.0, 0.0], [0.9, 0.1]]
    index = rag_index.build_index(vectors)
    rag_index.save_index(index, index_dir / "005930.faiss")
    rag_index.save_metadata(chunks, index_dir / "rag_metadata.json")
    rag_index.save_manifest(
        index_dir / "rag_manifest.json",
        embedding_model="nomic-embed-text",
        embedding_dim=2,
        created_at="2026-08-11T00:00:00+00:00",
        counts={"stocks": 1, "chunks": 2},
    )

    async def _embed(_text):
        return [1.0, 0.0]

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "질문")
    # 첫 청크(3000자)는 예산(4000자) 내라 포함, 둘째 청크(1500자)를 더하면
    # 4500자로 예산을 넘기므로 제외되어야 한다.
    assert len(docs) == 1
    assert docs[0]["title"] == "문서1"


@pytest.mark.asyncio
async def test_manifest_model_mismatch_returns_empty(_reset, monkeypatch):
    _write_fixture_index(_reset)
    monkeypatch.setattr(document_retrieval.settings, "ollama_embedding_model", "다른모델")

    async def _embed(_text):
        return [1.0, 0.0]

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "삼성전자 실적")
    assert docs == []


@pytest.mark.asyncio
async def test_manifest_dim_mismatch_returns_empty(_reset, monkeypatch):
    _write_fixture_index(_reset, embedding_dim=2)

    async def _embed(_text):
        return [1.0, 0.0, 0.0]  # 매니페스트(2차원)와 다른 3차원

    monkeypatch.setattr(document_retrieval, "embed_text", _embed)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "삼성전자 실적")
    assert docs == []


@pytest.mark.asyncio
async def test_embedding_failure_returns_empty(_reset, monkeypatch):
    _write_fixture_index(_reset)

    async def _raise(_text):
        raise document_retrieval.EmbeddingError("boom")

    monkeypatch.setattr(document_retrieval, "embed_text", _raise)
    docs = await document_retrieval.retrieve_relevant_documents("005930", "삼성전자 실적")
    assert docs == []
