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


@pytest.mark.asyncio
async def test_rebuild_stock_keeps_existing_data_when_new_run_yields_zero_chunks():
    """업스트림 형식이 바뀌어 이번 실행에서 청크가 0개가 되더라도, 이전에 정상 빌드된
    데이터(rag_version=1)를 지우면 안 된다."""
    repo = FakeRagRepository()
    good_chunk = Chunk(
        chunk_id="005930:1:0", stock_code="005930", title="t", source_type="dart_periodic",
        published_at="2026-07-01", url="http://x", text="정상청크", embedding=[1.0, 0.0],
        rag_version=1,
    )
    repo.chunks[good_chunk.chunk_id] = good_chunk
    repo.manifests["005930"] = {
        "stock_code": "005930", "rag_version": 1, "embedding_model": "bge-m3",
        "embedding_dimension": 2, "chunk_count": 1, "built_at": "2026-08-01T00:00:00+00:00",
    }

    count = await build_rag_index._rebuild_stock(repo, "005930", [], [], [], "bge-m3")

    assert count == 0
    assert repo.manifests["005930"]["rag_version"] == 1
    remaining = [c for c in repo.chunks.values() if c.stock_code == "005930"]
    assert len(remaining) == 1
    assert remaining[0].text == "정상청크"


# ---------------------------------------------------------------------------
# 섹션 선별: 사업보고서의 92% 는 판단에 쓸모없는 내용이다(상세표 37%, 재무제표 28%,
# 임원 명단 12% 등). 사업 구조를 담은 섹션만 인덱싱한다.
# ---------------------------------------------------------------------------


def test_keeps_company_overview_and_business_sections():
    assert build_rag_index.is_relevant_section("I. 회사의 개요")
    assert build_rag_index.is_relevant_section("II. 사업의 내용")


def test_keeps_management_discussion_section():
    assert build_rag_index.is_relevant_section("IV. 이사의 경영진단 및 분석의견")


def test_drops_boilerplate_sections():
    for heading in [
        "III. 재무에 관한 사항",
        "VIII. 임원 및 직원 등에 관한 사항",
        "XII. 상세표",
        "VII. 주주에 관한 사항",
        "IX. 계열회사 등에 관한 사항",
    ]:
        assert not build_rag_index.is_relevant_section(heading), heading


def test_keeps_edgar_business_and_mda_items():
    assert build_rag_index.is_relevant_section("Item 1. Business")
    assert build_rag_index.is_relevant_section("Item 1A. Risk Factors")
    assert build_rag_index.is_relevant_section(
        "Item 7. Management's Discussion and Analysis of Financial Condition"
    )


def test_drops_other_edgar_items():
    assert not build_rag_index.is_relevant_section("Item 3. Legal Proceedings")
    assert not build_rag_index.is_relevant_section("Item 10. Directors and Executive Officers")


def test_keeps_document_when_no_heading_was_detected():
    """제목을 못 찾으면 문서 전체가 제목 '' 인 섹션 하나로 온다.

    이때 걸러내면 문서가 통째로 사라진다(8-K 등 항목 구조가 없는 문서). 판단할 근거가
    없으므로 보존한다.
    """
    assert build_rag_index.is_relevant_section("")


def test_document_to_chunks_only_indexes_relevant_sections():
    """실제 청킹 경로에서 불필요한 섹션이 빠지는지 확인한다."""
    content = (
        "II. 사업의 내용\n\n" + "반도체 부문 매출 비중은 전체의 절반을 넘는다. " * 12 + "\n\n"
        "VIII. 임원 및 직원 등에 관한 사항\n\n" + "홍길동 남 1970.01 부사장 상근 담당임원 " * 12
    )
    document = {"content": content}

    chunks = build_rag_index._document_to_chunks(document, DART_HEADING_PATTERN)

    assert chunks, "관련 섹션이 있는데 청크가 하나도 안 나왔다"
    joined = " ".join(chunks)
    assert "반도체 부문 매출" in joined
    assert "부사장 상근 담당임원" not in joined
