"""프론트가 지금 보고 있는 차트 종목만 실시간 폴링 대상으로 삼기 위한 동적
구독 목록. 정적 settings.watch_symbols 대신 이걸 poller.py가 매 주기 조회한다.

구독은 하트비트 방식이다: 프론트가 차트를 보는 동안 주기적으로 /watch를
호출해 subscribe()를 갱신하고, watch_ttl_sec 동안 갱신이 없으면(화면 이탈,
브라우저 종료 등) active_symbols()에서 자동으로 빠진다.
"""
import time

from app.config import settings

_subscriptions: dict[str, float] = {}  # symbol -> 마지막 구독(하트비트) 시각


def subscribe(symbol: str) -> None:
    _subscriptions[symbol] = time.time()


def unsubscribe(symbol: str) -> None:
    _subscriptions.pop(symbol, None)


def active_symbols() -> list[str]:
    cutoff = time.time() - settings.watch_ttl_sec
    expired = [symbol for symbol, last_seen in _subscriptions.items() if last_seen < cutoff]
    for symbol in expired:
        del _subscriptions[symbol]
    return list(_subscriptions.keys())
