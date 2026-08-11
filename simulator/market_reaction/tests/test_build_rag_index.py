"""build_rag_index.py 의 순수 로직 테스트 (네트워크 호출 제외)."""

from app.services.dart_source import DART_HEADING_PATTERN
from scripts.build_rag_index import MIN_CHUNK_CHARS, _document_to_chunks, _is_degenerate


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
