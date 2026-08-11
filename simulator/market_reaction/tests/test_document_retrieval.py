"""document_retrieval(RAG MVP) 테스트."""

from app.services.document_retrieval import retrieve_relevant_documents


def test_unsupported_stock_returns_empty():
    assert retrieve_relevant_documents("999999", "HBM 실적 개선 소식") == []


def test_no_keyword_overlap_returns_empty():
    assert retrieve_relevant_documents("005930", "완전히 무관한 날씨와 여행 이야기") == []


def test_supported_stock_with_matching_keywords_returns_documents():
    docs = retrieve_relevant_documents("005930", "삼성전자 HBM 실적 개선 소식")
    assert len(docs) >= 1
    assert all("title" in d and "source_type" in d and "published_at" in d for d in docs)


def test_returns_at_most_top_k():
    docs = retrieve_relevant_documents("005930", "삼성전자 HBM 반도체 실적 파운드리 메모리")
    assert len(docs) <= 2


def test_empty_query_returns_empty():
    assert retrieve_relevant_documents("005930", "") == []


def test_skhynix_supported():
    docs = retrieve_relevant_documents("000660", "SK하이닉스 HBM3E 실적 개선")
    assert len(docs) >= 1
    assert docs[0]["title"].startswith("SK하이닉스")
