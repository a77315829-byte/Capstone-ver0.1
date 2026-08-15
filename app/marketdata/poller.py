"""KIS 시세를 주기적으로 조회해 event_listener.on_market_tick으로 흘려보내는 REST 폴링 루프.
RSI-14/외국인 순매수 추이는 일별 데이터라 하루 1회만 새로 조회하고, 현재가만 매 interval마다
조회한다. 종목 하나가 실패해도(네트워크 오류, 장중이 아닌 시간 등) 다른 종목/다음 주기에
영향이 가지 않도록 심볼 단위로 예외를 흡수한다.
"""
import asyncio
import logging
from datetime import date

from app.marketdata import kis_client
from app.marketdata.features import compute_rsi_14, detect_foreign_flow_flip
from app.triggers.event_listener import on_market_tick

logger = logging.getLogger(__name__)

# symbol -> (조회한 날짜, 그날의 RSI/외국인 순매수 피처). 하루 1회만 갱신한다.
_daily_cache: dict[str, tuple[date, dict]] = {}


async def _get_daily_features(symbol: str) -> dict:
    today = date.today()
    cached = _daily_cache.get(symbol)
    if cached and cached[0] == today:
        return cached[1]

    closes = await kis_client.get_daily_closes(symbol, days=30)
    foreign_flow = await kis_client.get_foreign_daily_net_buy(symbol, days=5)

    features = {
        "rsi_14": compute_rsi_14(closes),
        "foreign_net_flow": foreign_flow[-1] if foreign_flow else 0.0,
        **detect_foreign_flow_flip(foreign_flow),
    }
    _daily_cache[symbol] = (today, features)
    return features


async def build_tick(symbol: str) -> dict:
    """event_listener.on_market_tick이 기대하는 키(price, rsi_14, foreign_net_flow,
    foreign_net_flow_flipped_negative/positive)를 갖춘 tick dict를 조립한다."""
    price = await kis_client.get_current_price(symbol)
    daily = await _get_daily_features(symbol)
    return {"price": price, **daily}


async def poll_symbol(symbol: str) -> None:
    try:
        tick = await build_tick(symbol)
    except Exception:
        logger.exception("KIS 시세 조회 실패: %s", symbol)
        return

    try:
        await on_market_tick(symbol, tick)
    except Exception:
        logger.exception("판단 파이프라인 실행 실패: %s", symbol)


async def run_polling_loop(symbols: list[str], interval_sec: int) -> None:
    logger.info("KIS 실시간 폴링 시작: symbols=%s interval=%ss", symbols, interval_sec)
    while True:
        for symbol in symbols:
            await poll_symbol(symbol)
        await asyncio.sleep(interval_sec)
