"""dart_source.py 순수 함수 테스트.

fetch_corp_code_map/fetch_dart_documents 는 실제 DART API 호출이라 네트워크·API 키가
필요하므로 pytest 대상이 아니다. DART_API_KEY 발급 후 scripts/build_rag_index.py 를
수동 실행해 확인한다.
"""

from app.services.dart_source import (
    _rcept_dt_to_iso,
    _report_source_type,
    _strip_xml_tags,
    normalize_dart_document,
)


def test_rcept_dt_to_iso():
    assert _rcept_dt_to_iso("20260311") == "2026-03-11"


def test_report_source_type_periodic():
    assert _report_source_type("사업보고서 (2025.12)") == "dart_periodic"
    assert _report_source_type("분기보고서 (2026.03)") == "dart_periodic"
    assert _report_source_type("반기보고서 (2026.06)") == "dart_periodic"


def test_report_source_type_material():
    assert _report_source_type("주요사항보고서(유상증자결정)") == "dart_material"


def test_strip_xml_tags_extracts_text():
    xml = "<DOCUMENT><TITLE>사업보고서</TITLE><BODY>회사의 개요</BODY></DOCUMENT>".encode("utf-8")
    text = _strip_xml_tags(xml)
    assert "사업보고서" in text
    assert "회사의 개요" in text


def test_normalize_dart_document():
    doc = normalize_dart_document(
        stock_code="005930",
        report_nm="사업보고서 (2025.12)",
        rcept_no="20260311000123",
        rcept_dt="20260311",
        raw_text="회사의 개요...",
    )
    assert doc["title"] == "사업보고서 (2025.12)"
    assert doc["source_type"] == "dart_periodic"
    assert doc["published_at"] == "2026-03-11"
    assert doc["stock_code"] == "005930"
    assert doc["market"] == "KR"
    assert doc["url"] == "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260311000123"
    assert doc["content"] == "회사의 개요..."
