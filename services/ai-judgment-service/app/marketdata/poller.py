"""KIS 시세를 주기적으로 조회해 event_listener.on_market_tick으로 흘려보내는 REST 폴링 루프.
RSI-14/이동평균/52주 신고가·신저가/외국인 순매수 추이는 일별 데이터라 하루 1회만 새로
조회하고, 현재가만 매 interval마다 조회한다. 종목 하나가 실패해도(네트워크 오류, 장중이
아닌 시간 등) 다른 종목/다음 주기에 영향이 가지 않도록 심볼 단위로 예외를 흡수한다.

폴링 대상은 tracking.registry.active_symbols()의 고정 종목과 임시 구독의 합집합이다.
"""
import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from app.marketdata import kis_client
from app.marketdata.features import (
    compute_rsi_14, detect_foreign_flow_flip,
    compute_volume_ratio, compute_ma_cross, compute_52w_extreme,
)
from app.tracking.registry import active_symbols
from app.triggers.event_listener import on_market_tick
from app.config import settings
from app.history.repository import ensure_indexes
from app.tracking.refresh import request_refresh, prepared_symbols

logger = logging.getLogger(__name__)

# symbol -> (조회한 날짜, 그날의 일별 피처). 하루 1회만 갱신한다.
_daily_cache: dict[str, tuple[date, dict]] = {}
KST = timezone(timedelta(hours=9))


def market_is_open(now: datetime | None = None) -> bool:
    local = (now or datetime.now(timezone.utc)).astimezone(KST)
    closed = {part.strip().split(":", 1)[0] for part in settings.krx_closed_dates.split(",")}
    minute = local.hour * 60 + local.minute
    return local.weekday() < 5 and local.date().isoformat() not in closed and 540 <= minute < 930


async def _get_daily_features(symbol: str) -> dict:
    today = datetime.now(KST).date()
    cached = _daily_cache.get(symbol)
    if cached and cached[0] == today:
        return cached[1]

    # kis_client.DAILY_CHART_MAX_ROWS - KIS가 1회 호출에 그 이상은 안 돌려준다
    # (그래서 week52_high/low는 실제로는 52주가 아니라 최근 100영업일 기준이다.
    #  진짜 52주가 필요하면 kis_client에 날짜 구간을 나눠 호출하는 페이지네이션 추가 필요).
    closes, volumes = await kis_client.get_daily_chart(symbol, days=kis_client.DAILY_CHART_MAX_ROWS)
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

    if len(_daily_cache) >= 64 and symbol not in _daily_cache:
        _daily_cache.pop(next(iter(_daily_cache)))
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
    except Exception as error:
        logger.warning("KIS 시세 조회 실패: %s (%s)", symbol, type(error).__name__)
        return

    try:
        await on_market_tick(symbol, tick)
    except Exception as error:
        logger.warning("판단 갱신 예약 실패: %s (%s)", symbol, type(error).__name__)


async def poll_once():
    # 최초 1회는 장 밖에도 최근 거래일 자료로 준비한다. 실패하면 다음 주기 재시도.
    for symbol in settings.always_watch_symbols:
        if symbol not in prepared_symbols():
            request_refresh(symbol)
    if not market_is_open():
        return
    for symbol in active_symbols():
        await poll_symbol(symbol)


async def run_polling_loop(interval_sec: int) -> None:
    logger.info("KIS 실시간 폴링 시작: interval=%ss", interval_sec)
    initialized = False
    while True:
        try:
            if not initialized:
                await ensure_indexes()
                initialized = True
            await poll_once()
        except Exception as error:
            logger.warning("상시 감시 초기화/주기 실패 (%s); 다음 주기 재시도", type(error).__name__)
        await asyncio.sleep(interval_sec)
