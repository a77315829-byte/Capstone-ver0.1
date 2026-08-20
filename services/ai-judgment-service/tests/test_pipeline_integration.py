from app.factors.resolver import resolve_factors
from app.scoring.rubric import compute_weights
from app.scoring.fuzzy_judge import compute_judgment

# scripts/run_local.py의 SAMPLE_MARKET_DATA와 동일한 기준 시나리오.
# fuzzy_hold_baseline 등 config.py의 데모 값을 바꾸면 이 테스트가 깨질 수 있다 -
# 그건 재튜닝이 필요하다는 신호다.
REFERENCE_MARKET_DATA = {
    "foreign_net_flow_flipped_negative": True,
    "foreign_net_flow": 500000,
    "rsi_14": 67,
    "sector_index_change_pct": -1.5,
}


def test_reference_scenario_yields_sell():
    resolved = resolve_factors(REFERENCE_MARKET_DATA)
    weighted = compute_weights(resolved)
    assert compute_judgment(weighted)["judge"] == "매도"
