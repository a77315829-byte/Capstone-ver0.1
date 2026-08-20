"""이벤트 기반 트리거. 폴링이 아니라, 시세 스트림에서 조건이 충족될 때만
파이프라인(app.pipeline.run_judgment_pipeline)을 실행한다.

실제 운영에서는 KIS 웹소켓 구독으로 on_market_tick을 호출하도록 연결하면 된다.
"""
import time

from app.config import settings
from app.triggers.conditions import (
    price_move_exceeds, rsi_crossed_overbought_exit,
    supply_demand_flipped, volume_surged, ma_crossed, week52_extreme_hit,
)
from app.pipeline import run_judgment_pipeline

_last_state: dict[str, dict] = {}
_last_run_at: dict[str, float] = {}


def _cooldown_active(symbol: str) -> bool:
    last_run = _last_run_at.get(symbol)
    return last_run is not None and time.time() - last_run < settings.trigger_cooldown_sec


def mark_run(symbol: str) -> None:
    """cold_start.py처럼 이 모듈을 거치지 않고 직접 run_judgment_pipeline을 실행한
    경우에도 쿨다운 시계를 갱신해준다 - 안 그러면 콜드스타트 직후 다음 폴링
    tick(최대 10초 뒤)에서 그날 이미 참인 정적 플래그(MA 교차, 52주 신고가 등)가
    쿨다운 체크 없이 곧바로 재트리거되어 거의 중복인 이력이 하나 더 쌓인다."""
    _last_run_at[symbol] = time.time()


def cooldown_active(symbol: str) -> bool:
    return _cooldown_active(symbol)


def seed_state(symbol: str, tick: dict) -> None:
    """cold_start.py가 감시 재개 시점의 tick을 기록해둔다. 이게 없으면 다음
    폴링 tick이 비교할 '직전 상태'가 없어서(_last_state가 비어있음),
    price_move_exceeds 같은 델타 기반 트리거가 prev를 tick 자기 자신으로
    기본값 처리해 항상 변동 0으로 계산되고, 그 뒤로도 계속 못 잡는다."""
    _last_state[symbol] = tick


async def on_market_tick(symbol: str, tick: dict):
    prev = _last_state.get(symbol, {})
    triggered = (
        price_move_exceeds(prev.get("price", tick["price"]), tick["price"])
        or rsi_crossed_overbought_exit(prev.get("rsi_14", tick.get("rsi_14", 0)), tick.get("rsi_14", 0))
        or supply_demand_flipped(prev.get("foreign_net_flow", 0), tick.get("foreign_net_flow", 0))
        or volume_surged(tick.get("volume_ratio"))
        or ma_crossed(tick.get("golden_cross", False), tick.get("dead_cross", False))
        or week52_extreme_hit(tick.get("week52_high", False), tick.get("week52_low", False))
    )
    _last_state[symbol] = tick
    if not triggered or _cooldown_active(symbol):
        return

    _last_run_at[symbol] = time.time()
    await run_judgment_pipeline(symbol, tick)
