"""현재 결과는 조회 API로 즉시 제공하고 이 함수는 백그라운드에서만 실행한다."""
import asyncio
from datetime import datetime, timezone

from app.config import settings
from app.history.repository import get_latest_judgment
from app.pipeline import run_judgment_pipeline
from app.triggers.event_listener import mark_run, seed_state

_locks: dict[str, asyncio.Lock] = {}


def recent(doc: dict | None) -> bool:
    if not doc:
        return False
    try:
        stamp = datetime.fromisoformat(doc["time"].replace("Z", "+00:00"))
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - stamp).total_seconds()
        return 0 <= age < max(300, settings.trigger_cooldown_sec)
    except (KeyError, ValueError, TypeError):
        return False


async def cold_start(symbol: str, market_data: dict | None = None) -> dict:
    async with _locks.setdefault(symbol, asyncio.Lock()):
        existing = await get_latest_judgment(symbol)
        # DB 시각도 확인하므로 서버 재시작/여러 패널에도 5분 제한을 유지한다.
        if recent(existing):
            if existing.get("market_data"):
                seed_state(symbol, existing["market_data"])
            return existing
        if market_data is None:
            from app.marketdata.poller import build_tick
            market_data = await build_tick(symbol)
        # 같은 시세/지표로 동일 내용을 반복 생성하지 않는다.
        if existing and existing.get("market_data") == market_data:
            seed_state(symbol, market_data)
            return existing
        result = await run_judgment_pipeline(symbol, market_data)
        seed_state(symbol, market_data)
        mark_run(symbol)
        return result
