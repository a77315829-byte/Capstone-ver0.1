from app.factors.resolver import resolve_factors
from app.scoring.rubric import compute_weights
from app.scoring.judge import decide_judgment

# scripts/run_local.py의 SAMPLE_MARKET_DATA와 동일한 기준 시나리오.
# judge_sell_threshold/judge_hold_threshold는 이 시나리오가 "매도"로 판정되는 것을
# 기준으로 재산정했으므로, 이 테스트가 깨지면 threshold 재계산이 필요하다는 신호다.
REFERENCE_MARKET_DATA = {
    "foreign_net_flow_flipped_negative": True,
    "foreign_net_flow": 500000,
    "rsi_14": 67,
    "sector_index_change_pct": -1.5,
}


def test_reference_scenario_yields_sell():
    resolved = resolve_factors(REFERENCE_MARKET_DATA)
    weighted = compute_weights(resolved)
    assert decide_judgment(weighted) == "매도"
