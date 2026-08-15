"""이벤트 기반 트리거. 폴링이 아니라, 시세/뉴스 스트림에서 조건이 충족될 때만
파이프라인(app.pipeline.run_judgment_pipeline)을 실행한다.

실제 운영에서는 KIS 웹소켓/뉴스 큐 구독으로 on_market_tick, on_news_event를
호출하도록 연결하면 된다.
"""
from app.triggers.conditions import (
    price_move_exceeds, rsi_crossed_overbought_exit,
    supply_demand_flipped, news_arrived,
)
from app.pipeline import run_judgment_pipeline

_last_state: dict[str, dict] = {}


async def on_market_tick(symbol: str, tick: dict):
    prev = _last_state.get(symbol, {})
    triggered = (
        price_move_exceeds(prev.get("price", tick["price"]), tick["price"])
        or rsi_crossed_overbought_exit(prev.get("rsi_14", tick.get("rsi_14", 0)), tick.get("rsi_14", 0))
        or supply_demand_flipped(prev.get("foreign_net_flow", 0), tick.get("foreign_net_flow", 0))
    )
    _last_state[symbol] = tick
    if triggered:
        await run_judgment_pipeline(symbol, tick)


async def on_news_event(symbol: str, articles: list[str], market_data: dict):
    if news_arrived(len(articles)):
        await run_judgment_pipeline(symbol, market_data, articles=articles)
