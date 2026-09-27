"""chunking.py 테스트."""

from app.core.chunking import split_into_chunks, split_into_sections

EDGAR_PATTERN = r"(?im)^\s*item\s+\d+[a-z]?\.?\s+\S"
DART_PATTERN = r"(?m)^\s*(?:[IVX]+\.|[0-9]+\.)\s+\S"


def test_split_into_sections_edgar_style():
    text = (
        "Item 1. Business\n"
        "Some business description text.\n\n"
        "Item 1A. Risk Factors\n"
        "Some risk factor text.\n"
    )
    sections = split_into_sections(text, EDGAR_PATTERN)
    assert len(sections) == 2
    assert sections[0][0].startswith("Item 1.")
    assert "business description" in sections[0][1]
    assert sections[1][0].startswith("Item 1A.")


def test_split_into_sections_no_heading_returns_single_section():
    text = "그냥 평범한 본문입니다. 섹션 구분이 없습니다."
    sections = split_into_sections(text, DART_PATTERN)
    assert len(sections) == 1
    assert sections[0][0] == ""
    assert sections[0][1] == text


def test_split_into_chunks_keeps_paragraphs_together():
    text = "첫 문단입니다.\n\n둘째 문단입니다."
    chunks = split_into_chunks(text, max_chars=1000)
    assert chunks == ["첫 문단입니다.\n\n둘째 문단입니다."]


def test_split_into_chunks_splits_when_exceeding_max_chars():
    para_a = "가" * 800
    para_b = "나" * 800
    text = f"{para_a}\n\n{para_b}"
    chunks = split_into_chunks(text, max_chars=1000)
    assert len(chunks) == 2
    assert chunks[0] == para_a
    assert chunks[1] == para_b


def test_split_into_chunks_force_splits_oversized_paragraph():
    huge = "다" * 2500
    chunks = split_into_chunks(huge, max_chars=1000)
    assert len(chunks) == 3
    assert all(len(c) <= 1000 for c in chunks)
    assert "".join(chunks) == huge
