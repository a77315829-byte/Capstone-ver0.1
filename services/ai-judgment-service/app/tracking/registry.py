"""서버 고정 감시와 패널의 임시 감시를 합친 구독 목록.

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
    # 패널 닫기/TTL 만료로는 고정 감시 종목이 제거되지 않는다.
    return list(dict.fromkeys([*settings.always_watch_symbols, *_subscriptions.keys()]))
