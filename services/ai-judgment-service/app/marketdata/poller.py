"""KIS 시세를 주기적으로 조회해 event_listener.on_market_tick으로 흘려보내는 REST 폴링 루프.
RSI-14/이동평균/52주 신고가·신저가/외국인 순매수 추이는 일별 데이터라 하루 1회만 새로
조회하고, 현재가만 매 interval마다 조회한다. 종목 하나가 실패해도(네트워크 오류, 장중이
아닌 시간 등) 다른 종목/다음 주기에 영향이 가지 않도록 심볼 단위로 예외를 흡수한다.

폴링 대상은 고정 리스트가 아니라 tracking.registry.active_symbols() - 프론트가 지금 보고
있는 차트 종목만 매 주기 다시 조회해서 반영한다.
"""
import asyncio
import logging
from datetime import date

from app.marketdata import kis_client
from app.marketdata.features import (
    compute_rsi_14, detect_foreign_flow_flip,
    compute_volume_ratio, compute_ma_cross, compute_52w_extreme,
)
from app.tracking.registry import active_symbols
from app.triggers.event_listener import on_market_tick

logger = logging.getLogger(__name__)

# symbol -> (조회한 날짜, 그날의 일별 피처). 하루 1회만 갱신한다.
_daily_cache: dict[str, tuple[date, dict]] = {}


async def _get_daily_features(symbol: str) -> dict:
    today = date.today()
    cached = _daily_cache.get(symbol)
    if cached and cached[0] == today:
        return cached[1]

    # kis_client.DAILY_CHART_MAX_ROWS - KIS가 1회 호출에 그 이상은 안 돌려준다
    # (그래서 week52_high/low는 실제로는 52주가 아니라 최근 100영업일 기준이다.
    #  진짜 52주가 필요하면 kis_client에 날짜 구간을 나눠 호출하는 페이지네이션 추가 필요).
    closes = await kis_client.get_daily_closes(symbol, days=kis_client.DAILY_CHART_MAX_ROWS)
    volumes = await kis_client.get_daily_volumes(symbol, days=kis_client.DAILY_CHART_MAX_ROWS)
    foreign_flow = await kis_client.get_foreign_daily_net_buy(symbol, days=5)

    features: dict = {
        "foreign_net_flow": foreign_flow[-1] if foreign_flow else 0.0,
        **detect_foreign_flow_flip(foreign_flow),
    }
    if len(closes) >= 15:
        features["rsi_14"] = compute_rsi_14(closes[-15:])
    if len(volumes) >= 2:
        features["volume_ratio"] = compute_volume_ratio(volumes)
    if len(closes) >= 21:
        features.update(compute_ma_cross(closes))
    if len(closes) >= 2:
        features.update(compute_52w_extreme(closes))
    if closes:
        features["_prev_close"] = closes[-1]

    _daily_cache[symbol] = (today, features)
    return features


async def build_tick(symbol: str) -> dict:
    """event_listener.on_market_tick이 기대하는 키를 갖춘 tick dict를 조립한다."""
    price = await kis_client.get_current_price(symbol)
    daily = await _get_daily_features(symbol)
    tick = {"price": price, **daily}
    prev_close = tick.pop("_prev_close", None)
    if prev_close:
        tick["price_change_pct"] = (price - prev_close) / prev_close * 100
    return tick


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


async def run_polling_loop(interval_sec: int) -> None:
    logger.info("KIS 실시간 폴링 시작: interval=%ss", interval_sec)
    while True:
        for symbol in active_symbols():
            await poll_symbol(symbol)
        await asyncio.sleep(interval_sec)
