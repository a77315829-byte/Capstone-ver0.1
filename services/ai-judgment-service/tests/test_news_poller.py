from app.news.newsapi_client import extract_text
from app.news.poller import filter_unseen


def test_extract_text_combines_title_and_description():
    article = {"title": "삼성전자 실적 발표", "description": "영업이익이 예상치를 상회했다."}
    assert extract_text(article) == "삼성전자 실적 발표. 영업이익이 예상치를 상회했다."


def test_extract_text_falls_back_to_title_only():
    article = {"title": "삼성전자 실적 발표", "description": None}
    assert extract_text(article) == "삼성전자 실적 발표"


def test_extract_text_handles_missing_fields():
    assert extract_text({}) == ""


def test_filter_unseen_excludes_already_seen_urls():
    articles = [
        {"url": "https://a.com/1", "title": "a"},
        {"url": "https://a.com/2", "title": "b"},
    ]
    seen = {"https://a.com/1"}
    result = filter_unseen(articles, seen)
    assert [a["url"] for a in result] == ["https://a.com/2"]


def test_filter_unseen_excludes_articles_without_url():
    articles = [{"title": "no url"}, {"url": "https://a.com/1", "title": "has url"}]
    result = filter_unseen(articles, set())
    assert [a["url"] for a in result] == ["https://a.com/1"]
