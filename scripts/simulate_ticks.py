"""가상 종목의 틱 시퀀스를 만들어 이벤트 트리거 -> 파이프라인 -> LLM 서술까지
실제 KIS 연동 없이 검증하는 스크립트.

평온한 틱을 몇 번 흘려보내다가 마지막 틱에서 임계치를 넘는 변동(가격 급락 +
외국인 수급 반전 + RSI 구간 진입 + 섹터 약세 + 뉴스 악재)을 한 번에 주입해서
event_listener.on_market_tick이 실제로 감지하는지 확인한다.

실행: python -m scripts.simulate_ticks
"""
import asyncio

from app.triggers.event_listener import on_market_tick, on_news_event
from app.triggers.conditions import (
    price_move_exceeds, rsi_crossed_overbought_exit, supply_demand_flipped,
)
from app.history.repository import get_latest_judgment

SYMBOL = "TEST005930"  # 실제 삼성전자(005930)와 섞이지 않도록 가상 코드 사용

# 마지막 틱은 시장 변동과 뉴스가 겹치는 상황을 가정 - on_news_event를 통해
# run_judgment_pipeline이 classify_news까지 자동으로 호출하는지 확인한다.
FAKE_ARTICLE = "삼성전자, 반도체 업황 둔화 우려 속 외국인 매도세 확대... IT 섹터 전반 약세"

TICKS = [
    {"price": 71000, "rsi_14": 55, "foreign_net_flow": 300000},
    {"price": 71100, "rsi_14": 58, "foreign_net_flow": 250000},
    {"price": 71200, "rsi_14": 61, "foreign_net_flow": 200000},
    # 여기서 의미 있는 변동을 주입한다.
    {
        "price": 69500,                          # 71200 -> 69500 (-2.4%, 임계치 0.5% 초과)
        "rsi_14": 67,                             # resolve_factors의 65<=rsi<70 구간 충족
        "foreign_net_flow": -400000,              # 직전 양수 -> 음수 (수급 반전)
        "foreign_net_flow_flipped_negative": True,  # resolve_factors가 읽는 사전계산 플래그
        "sector_index_change_pct": -1.8,          # 섹터 약세 조건 충족
    },
]


def describe_trigger(prev: dict, cur: dict) -> bool:
    """event_listener.on_market_tick과 동일한 조건을 미리 평가해 진단 출력용으로 보여준다."""
    return (
        price_move_exceeds(prev.get("price", cur["price"]), cur["price"])
        or rsi_crossed_overbought_exit(prev.get("rsi_14", 0), cur.get("rsi_14", 0))
        or supply_demand_flipped(prev.get("foreign_net_flow", 0), cur.get("foreign_net_flow", 0))
    )


async def main():
    prev_tick: dict = {}
    for i, tick in enumerate(TICKS[:-1]):
        would_trigger = describe_trigger(prev_tick, tick)
        print(f"\n--- Tick {i} ---")
        print(f"이전: {prev_tick or '(없음, 첫 틱)'}")
        print(f"현재: {tick}")
        print(f"트리거 조건 충족: {'예' if would_trigger else '아니오'}")

        await on_market_tick(SYMBOL, tick)
        prev_tick = tick

    final_tick = TICKS[-1]
    would_trigger = describe_trigger(prev_tick, final_tick)
    print(f"\n--- Tick {len(TICKS) - 1} (뉴스 포함) ---")
    print(f"이전: {prev_tick}")
    print(f"현재: {final_tick}")
    print(f"뉴스 기사: {FAKE_ARTICLE!r}")
    print(f"트리거 조건 충족: {'예' if would_trigger else '아니오'}")

    await on_news_event(SYMBOL, [FAKE_ARTICLE], final_tick)

    doc = await get_latest_judgment(SYMBOL)
    if doc is None:
        print("\n트리거가 한 번도 감지되지 않아 파이프라인이 실행되지 않았습니다.")
        return

    print("\n=== 최종 AI 판단 ===")
    print(f"판단: {doc['judge']}  (신뢰도 {doc['confidence']}%)")
    print(f"근거: {doc['reason']}")
    print("요인:")
    for f in doc["factors"]:
        print(f"  [{f['type']}] {f['factor']} - {f['weight']}%")


if __name__ == "__main__":
    asyncio.run(main())
