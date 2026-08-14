"""RagRepository 테스트. 실제 Mongo 대신 컬렉션 메서드를 흉내내는 fake 객체를 주입한다."""

import pytest
from pymongo.errors import PyMongoError

from app.services.rag_index import Chunk
from app.services.rag_repository import RagRepository, RagRepositoryError


class _FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    async def to_list(self, length=None):
        return self._docs


class _FakeChunksCollection:
    def __init__(self, docs=None, fail=False):
        self.docs = docs or []
        self.fail = fail

    def find(self, query):
        if self.fail:
            raise PyMongoError("boom")
        matched = [d for d in self.docs if self._matches(d, query)]
        return _FakeCursor(matched)

    @staticmethod
    def _matches(doc, query):
        for key, value in query.items():
            if isinstance(value, dict) and "$lt" in value:
                if not doc[key] < value["$lt"]:
                    return False
            elif doc.get(key) != value:
                return False
        return True


class _FakeManifestCollection:
    def __init__(self, doc=None, fail=False):
        self.doc = doc
        self.fail = fail

    async def find_one(self, query):
        if self.fail:
            raise PyMongoError("boom")
        return self.doc


class _FakeDatabase:
    def __init__(self, chunks_collection, manifest_collection):
        self._collections = {"rag_chunks": chunks_collection, "rag_manifest": manifest_collection}

    def __getitem__(self, name):
        return self._collections[name]


@pytest.mark.asyncio
async def test_get_manifest_returns_none_when_missing():
    db = _FakeDatabase(_FakeChunksCollection(), _FakeManifestCollection(doc=None))
    repo = RagRepository(db)
    assert await repo.get_manifest("005930") is None


@pytest.mark.asyncio
async def test_get_manifest_raises_repository_error_on_query_failure():
    db = _FakeDatabase(_FakeChunksCollection(), _FakeManifestCollection(fail=True))
    repo = RagRepository(db)
    with pytest.raises(RagRepositoryError):
        await repo.get_manifest("005930")


@pytest.mark.asyncio
async def test_get_chunks_returns_matching_chunks_as_dataclass():
    doc = {
        "_id": "005930:1:0", "stock_code": "005930", "rag_version": 1, "title": "t",
        "source_type": "dart_periodic", "published_at": "2026-07-01", "url": "http://x",
        "text": "본문", "embedding": [0.1, 0.2],
    }
    db = _FakeDatabase(_FakeChunksCollection(docs=[doc]), _FakeManifestCollection())
    repo = RagRepository(db)
    chunks = await repo.get_chunks("005930", 1)
    assert len(chunks) == 1
    assert isinstance(chunks[0], Chunk)
    assert chunks[0].chunk_id == "005930:1:0"
    assert chunks[0].text == "본문"
    assert chunks[0].embedding == [0.1, 0.2]
    assert chunks[0].rag_version == 1


@pytest.mark.asyncio
async def test_get_chunks_filters_by_stock_code_and_version():
    docs = [
        {"_id": "005930:1:0", "stock_code": "005930", "rag_version": 1, "title": "t",
         "source_type": "dart_periodic", "published_at": "2026-07-01", "url": "http://x",
         "text": "본문1", "embedding": [0.1]},
        {"_id": "005930:2:0", "stock_code": "005930", "rag_version": 2, "title": "t",
         "source_type": "dart_periodic", "published_at": "2026-07-01", "url": "http://x",
         "text": "본문2", "embedding": [0.2]},
    ]
    db = _FakeDatabase(_FakeChunksCollection(docs=docs), _FakeManifestCollection())
    repo = RagRepository(db)
    chunks = await repo.get_chunks("005930", 2)
    assert len(chunks) == 1
    assert chunks[0].text == "본문2"


@pytest.mark.asyncio
async def test_get_chunks_raises_repository_error_on_query_failure():
    db = _FakeDatabase(_FakeChunksCollection(fail=True), _FakeManifestCollection())
    repo = RagRepository(db)
    with pytest.raises(RagRepositoryError):
        await repo.get_chunks("005930", 1)
