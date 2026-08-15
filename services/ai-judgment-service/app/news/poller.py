"""newsapi.org를 주기적으로 조회해 새 기사가 있으면 event_listener.on_news_event로
흘려보낸다. 이미 처리한 기사는 url 기준으로 걸러내 같은 기사를 반복 처리하지 않는다.

뉴스 이벤트는 market_data도 함께 필요하므로(파이프라인이 시세+뉴스를 한 번에 판단),
새 기사가 발견된 시점에 app.marketdata.poller.build_tick으로 현재 시세 스냅샷을 다시 조회한다.
"""
import asyncio
import logging

from app.marketdata.poller import build_tick
from app.news.newsapi_client import extract_text, fetch_articles
from app.triggers.event_listener import on_news_event

logger = logging.getLogger(__name__)

# 지금은 종목 하나만 테스트 대상이라 종목코드 -> 검색어 매핑을 간단히 고정해둔다.
SYMBOL_TO_QUERY = {"011070": "LG이노텍"}

# symbol -> 이미 처리한 기사 url 집합. 재기동하면 초기화된다(중복 처리 위험보다
# 재시작 직후 최근 기사를 한 번 더 판단에 반영하는 쪽이 안전하다고 보고 감수한다).
_seen_urls: dict[str, set[str]] = {}


def filter_unseen(articles: list[dict], seen: set[str]) -> list[dict]:
    """url이 없거나 이미 처리한 기사는 제외한다. 순수 함수 - 네트워크 없음."""
    return [a for a in articles if a.get("url") and a["url"] not in seen]


async def poll_news(symbol: str) -> None:
    query = SYMBOL_TO_QUERY.get(symbol)
    if not query:
        logger.warning("뉴스 검색어 매핑이 없는 종목: %s", symbol)
        return

    try:
        articles = await fetch_articles(query)
    except Exception:
        logger.exception("NewsAPI 조회 실패: %s", symbol)
        return

    seen = _seen_urls.setdefault(symbol, set())
    new_articles = filter_unseen(articles, seen)
    if not new_articles:
        return
    seen.update(a["url"] for a in new_articles)

    texts = [extract_text(a) for a in new_articles]

    try:
        market_data = await build_tick(symbol)
    except Exception:
        logger.exception("시세 스냅샷 조회 실패(뉴스 판단용): %s", symbol)
        return

    try:
        await on_news_event(symbol, texts, market_data)
    except Exception:
        logger.exception("뉴스 기반 판단 파이프라인 실행 실패: %s", symbol)


async def run_news_polling_loop(symbols: list[str], interval_sec: int) -> None:
    logger.info("뉴스 폴링 시작: symbols=%s interval=%ss", symbols, interval_sec)
    while True:
        for symbol in symbols:
            await poll_news(symbol)
        await asyncio.sleep(interval_sec)
