"""빠른 조회와 분리된, 종목별 중복 방지/전체 동시 실행 1개의 갱신 작업."""
import asyncio
import logging
import time

from app.tracking.registry import active_symbols

logger = logging.getLogger(__name__)
_tasks: dict[str, asyncio.Task] = {}
_next_attempt: dict[str, float] = {}
_ready: set[str] = set()
_generation_slot = asyncio.Semaphore(1)
MAX_PENDING = 32


def is_refreshing(symbol: str) -> bool:
    task = _tasks.get(symbol)
    return task is not None and not task.done()


def prepared_symbols() -> set[str]:
    return set(_ready)


def refreshing_symbols() -> list[str]:
    return [symbol for symbol in _tasks if is_refreshing(symbol)]


def request_refresh(symbol: str, market_data: dict | None = None) -> bool:
    if is_refreshing(symbol):
        return True
    if time.monotonic() < _next_attempt.get(symbol, 0) or len(_tasks) >= MAX_PENDING:
        return False

    async def run():
        try:
            async with _generation_slot:
                if symbol not in active_symbols():
                    return
                from app.marketdata.cold_start import cold_start
                await cold_start(symbol, market_data=market_data)
                _ready.add(symbol)
                _next_attempt[symbol] = time.monotonic() + 30
        except asyncio.CancelledError:
            raise
        except Exception as error:
            _next_attempt[symbol] = time.monotonic() + 60
            # 연결 주소/인증정보가 들어갈 수 있는 예외 본문은 출력하지 않는다.
            logger.warning("판단 갱신 실패 %s (%s); 이후 재시도", symbol, type(error).__name__)
        finally:
            _tasks.pop(symbol, None)

    _tasks[symbol] = asyncio.create_task(run())
    return True


async def stop_refresh_tasks():
    tasks = list(_tasks.values())
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    _tasks.clear()
