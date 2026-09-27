"""edgar_source.py 순수 함수 테스트.

fetch_ticker_cik_map/fetch_edgar_documents 는 실제 SEC EDGAR API 호출이라 네트워크가
필요하므로 pytest 대상이 아니다. scripts/build_rag_index.py 를 수동 실행해 확인한다.
"""

from app.services.edgar_source import _form_source_type, _html_to_text, normalize_edgar_document


def test_form_source_type():
    assert _form_source_type("10-K") == "edgar_10k"
    assert _form_source_type("10-Q") == "edgar_10q"
    assert _form_source_type("8-K") == "edgar_8k"
    assert _form_source_type("DEF 14A") == "edgar_other"


def test_html_to_text_strips_tags_and_scripts():
    html = "<html><body><script>ignored()</script><p>Item 1. Business</p></body></html>"
    text = _html_to_text(html)
    assert "Item 1. Business" in text
    assert "ignored()" not in text


def test_normalize_edgar_document():
    doc = normalize_edgar_document(
        ticker="AAPL",
        form="10-K",
        filing_date="2026-01-15",
        url="https://www.sec.gov/x",
        html="<p>Item 1. Business</p>",
    )
    assert doc["title"] == "AAPL 10-K (2026-01-15)"
    assert doc["source_type"] == "edgar_10k"
    assert doc["published_at"] == "2026-01-15"
    assert doc["stock_code"] == "AAPL"
    assert doc["market"] == "US"
    assert doc["url"] == "https://www.sec.gov/x"
    assert "Item 1. Business" in doc["content"]
