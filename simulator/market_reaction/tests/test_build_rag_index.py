"""build_rag_index.py 의 순수 로직 테스트 (네트워크 호출 제외)."""

import pytest

from app.services.dart_source import DART_HEADING_PATTERN
from app.services.rag_index import Chunk
from scripts import build_rag_index
from scripts.build_rag_index import MIN_CHUNK_CHARS, _document_to_chunks, _is_degenerate
from tests.fakes import FakeRagRepository


def test_document_to_chunks_splits_by_section():
    document = {
        "content": (
            "I. 회사의 개요\n" + "회사 개요 본문입니다. " * 10 + "\n\n"
            "II. 사업의 내용\n" + "사업 내용 본문입니다. " * 10
        )
    }
    chunks = _document_to_chunks(document, DART_HEADING_PATTERN)
    assert len(chunks) == 2
    assert "회사 개요" in chunks[0]
    assert "사업 내용" in chunks[1]


def test_document_to_chunks_ignores_arabic_numbered_list_items():
    """본문 중 안건 목록 등 아라비아 숫자 나열은 섹션 경계로 오인식하지 않아야 한다."""
    document = {
        "content": (
            "I. 회사의 개요\n"
            "1. 사회공헌 기부금 출연의 건\n"
            "2. 삼성디스플레이와 차입계약 연장의 건\n"
            + "이사회는 위 안건들을 심의하여 원안대로 가결하였습니다. " * 3
        )
    }
    chunks = _document_to_chunks(document, DART_HEADING_PATTERN)
    assert len(chunks) == 1


def test_document_to_chunks_no_heading_returns_single_chunk():
    document = {"content": "짧은 본문입니다. " * 20}
    chunks = _document_to_chunks(document, DART_HEADING_PATTERN)
    assert chunks == [document["content"].strip()]


def test_document_to_chunks_drops_chunks_shorter_than_min_chars():
    """MIN_CHUNK_CHARS 미만인 청크는 (임베딩 유사도 편향을 피하기 위해) 버려진다."""
    document = {"content": "너무 짧은 본문."}
    assert len(document["content"]) < MIN_CHUNK_CHARS
    chunks = _document_to_chunks(document, DART_HEADING_PATTERN)
    assert chunks == []


def test_is_degenerate_detects_repeated_lines():
    text = "\n".join(["채무 등은 리스부채가 포함된 금액입니다."] * 10)
    assert _is_degenerate(text) is True


def test_is_degenerate_allows_mostly_unique_lines():
    text = "\n".join(
        [
            "회사의 명칭은 삼성전자주식회사입니다.",
            "본사는 경기도 수원시에 위치합니다.",
            "설립일은 1969년 1월 13일입니다.",
        ]
    )
    assert _is_degenerate(text) is False


def test_is_degenerate_ignores_short_texts():
    """줄이 적으면(3줄 미만) 반복 여부와 무관하게 퇴화 텍스트로 보지 않는다."""
    text = "같은 문장입니다.\n같은 문장입니다."
    assert _is_degenerate(text) is False


def test_document_to_chunks_drops_degenerate_repeated_lines():
    """표를 텍스트로 펼치면서 같은 각주가 줄마다 반복된 청크는 버려진다."""
    document = {
        "content": "I. 재무에 관한 사항\n"
        + "\n".join(["채무 등은 리스부채가 포함된 금액입니다."] * 10)
    }
    chunks = _document_to_chunks(document, DART_HEADING_PATTERN)
    assert chunks == []


def _doc(title="t1"):
    return {
        "title": title, "source_type": "dart_periodic", "published_at": "2026-07-01",
        "url": "http://x",
    }


@pytest.mark.asyncio
async def test_rebuild_stock_creates_first_version():
    repo = FakeRagRepository()
    count = await build_rag_index._rebuild_stock(
        repo, "005930", ["텍스트1", "텍스트2"], [[1.0, 0.0], [0.0, 1.0]],
        [_doc(), _doc()], "bge-m3",
    )
    assert count == 2
    assert repo.manifests["005930"]["rag_version"] == 1
    assert repo.manifests["005930"]["chunk_count"] == 2
    assert {c.rag_version for c in repo.chunks.values()} == {1}


@pytest.mark.asyncio
async def test_rebuild_stock_rerun_replaces_previous_version_without_duplicates():
    repo = FakeRagRepository()
    await build_rag_index._rebuild_stock(repo, "005930", ["가"], [[1.0, 0.0]], [_doc()], "bge-m3")
    await build_rag_index._rebuild_stock(repo, "005930", ["나"], [[0.0, 1.0]], [_doc()], "bge-m3")

    assert repo.manifests["005930"]["rag_version"] == 2
    remaining = [c for c in repo.chunks.values() if c.stock_code == "005930"]
    assert len(remaining) == 1
    assert remaining[0].text == "나"
    assert remaining[0].rag_version == 2


@pytest.mark.asyncio
async def test_rebuild_stock_cleans_up_orphaned_chunks_from_failed_attempt():
    """이전 실행이 new_version insert 도중 죽어서 남긴 고아 청크가 있어도, 재실행하면
    정리 후 중복 없이 새로 쌓인다(restart-safe)."""
    repo = FakeRagRepository()
    orphan = Chunk(
        chunk_id="005930:1:0", stock_code="005930", title="orphan", source_type="dart_periodic",
        published_at="2026-07-01", url="http://x", text="고아청크", embedding=[1.0, 0.0],
        rag_version=1,
    )
    repo.chunks[orphan.chunk_id] = orphan  # manifest 는 아직 없음(prev_version=0, new_version=1)

    count = await build_rag_index._rebuild_stock(
        repo, "005930", ["가"], [[1.0, 0.0]], [_doc()], "bge-m3"
    )

    assert count == 1
    remaining = [c for c in repo.chunks.values() if c.stock_code == "005930"]
    assert len(remaining) == 1
    assert remaining[0].text == "가"


@pytest.mark.asyncio
async def test_fake_repo_insert_chunks_raises_on_duplicate_chunk_id():
    """FakeRagRepository 는 실제 Mongo insert_many 의 _id 중복 시 DuplicateKeyError 동작을
    흉내낸다(조용한 덮어쓰기 금지) — delete_chunks_at_version 을 건너뛰면 이 fake 로도
    잡혀야 한다."""
    repo = FakeRagRepository()
    chunk = Chunk(
        chunk_id="005930:1:0", stock_code="005930", title="t", source_type="dart_periodic",
        published_at="2026-07-01", url="http://x", text="본문", embedding=[1.0, 0.0],
        rag_version=1,
    )
    await repo.insert_chunks([chunk])
    with pytest.raises(ValueError):
        await repo.insert_chunks([chunk])


@pytest.mark.asyncio
async def test_rebuild_stock_handles_no_chunks():
    repo = FakeRagRepository()
    count = await build_rag_index._rebuild_stock(repo, "005930", [], [], [], "bge-m3")
    assert count == 0
    assert repo.manifests["005930"]["rag_version"] == 1
    assert repo.manifests["005930"]["chunk_count"] == 0
