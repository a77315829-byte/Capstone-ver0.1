"""build_rag_index.py 의 순수 로직 테스트 (네트워크 호출 제외)."""

from app.services.dart_source import DART_HEADING_PATTERN
from scripts.build_rag_index import _document_to_chunks


def test_document_to_chunks_splits_by_section():
    document = {
        "content": (
            "1. 회사의 개요\n회사 개요 본문입니다.\n\n"
            "2. 사업의 내용\n사업 내용 본문입니다."
        )
    }
    chunks = _document_to_chunks(document, DART_HEADING_PATTERN)
    assert len(chunks) == 2
    assert "회사 개요" in chunks[0]
    assert "사업 내용" in chunks[1]


def test_document_to_chunks_no_heading_returns_single_chunk():
    document = {"content": "짧은 본문 하나."}
    chunks = _document_to_chunks(document, DART_HEADING_PATTERN)
    assert chunks == ["짧은 본문 하나."]
