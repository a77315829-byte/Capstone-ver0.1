"""종목이 감시 대상(/watch)이 될 때 실행된다.

- 이력이 아예 없는 종목: 과거 시세를 한 번에 모아 초기 지표를 계산하고 최초
  판단을 만든다 (콜드스타트).
- 이력은 있지만 감시가 끊겨 있다가 다시 시작되는 종목: 쿨다운만 통과하면 그
  자리에서 최신 시세로 즉시 재계산한다. (가격 변동 트리거처럼 '직전 상태 대비
  델타'를 보는 조건은 여기서 못 쓴다 - 감시가 끊긴 동안 직전 상태 자체가 없기
  때문에, 그 조건에 기대면 가격이 실제로 많이 움직였어도 절대 못 잡는다.)
- 이미 감시 중이던 종목의 하트비트(프론트가 30초마다 재호출하는 것): 구독만
  갱신하고 재확인은 하지 않는다 - 안 그러면 화면을 켜둔 것만으로 계속 KIS를
  호출하게 된다.
- 짧은 시간에 같은 종목을 들락날락해도(=위 두 번째 케이스가 반복돼도)
  watch_refresh_guard_sec 안에는 신선도 체크용 KIS 호출조차 하지 않는다
  (재계산 자체는 어차피 트리거 쿨다운이 막아주지만, KIS 호출 자체도 아끼기 위함).

뉴스가 빠진 구조라 필요한 건 과거 시세뿐이라 API 호출 몇 번으로 끝난다
(LLM 분류 비용 없음). 동일 종목에 대한 동시 요청은 락으로 하나로 묶는다.
"""
import asyncio
import time

from app.config import settings
from app.marketdata import kis_client
from app.marketdata.features import (
    compute_rsi_14, compute_volume_ratio, compute_ma_cross, compute_52w_extreme,
    detect_foreign_flow_flip,
)
from app.history.repository import get_latest_judgment
from app.pipeline import run_judgment_pipeline
from app.tracking.registry import subscribe, active_symbols
from app.triggers.event_listener import mark_run, cooldown_active, seed_state

_locks: dict[str, asyncio.Lock] = {}
_last_freshness_check: dict[str, float] = {}


async def _build_tick(symbol: str) -> dict:
    closes = await kis_client.get_daily_closes(symbol, days=kis_client.DAILY_CHART_MAX_ROWS)
    volumes = await kis_client.get_daily_volumes(symbol, days=kis_client.DAILY_CHART_MAX_ROWS)
    foreign_flow = await kis_client.get_foreign_daily_net_buy(symbol, days=5)
    price = await kis_client.get_current_price(symbol)

    tick: dict = {
        "price": price,
        "foreign_net_flow": foreign_flow[-1] if foreign_flow else 0.0,
        **detect_foreign_flow_flip(foreign_flow),
    }
    if closes:
        tick["price_change_pct"] = (price - closes[-1]) / closes[-1] * 100
    if len(closes) >= 15:
        tick["rsi_14"] = compute_rsi_14(closes[-15:])
    if len(volumes) >= 2:
        tick["volume_ratio"] = compute_volume_ratio(volumes)
    if len(closes) >= 21:
        tick.update(compute_ma_cross(closes))
    if len(closes) >= 2:
        tick.update(compute_52w_extreme(closes))
    return tick


async def cold_start(symbol: str) -> dict:
    lock = _locks.setdefault(symbol, asyncio.Lock())
    async with lock:
        was_active = symbol in active_symbols()
        existing = await get_latest_judgment(symbol)
        subscribe(symbol)

        if existing is None:
            tick = await _build_tick(symbol)
            mark_run(symbol)
            _last_freshness_check[symbol] = time.time()
            return await run_judgment_pipeline(symbol, tick)

        if was_active:
            return existing

        last_check = _last_freshness_check.get(symbol)
        if last_check is not None and time.time() - last_check < settings.watch_refresh_guard_sec:
            return existing

        tick = await _build_tick(symbol)
        _last_freshness_check[symbol] = time.time()
        seed_state(symbol, tick)  # 앞으로의 폴링 tick이 비교할 기준점을 남겨둔다

        if cooldown_active(symbol):
            return existing

        mark_run(symbol)
        return await run_judgment_pipeline(symbol, tick)
