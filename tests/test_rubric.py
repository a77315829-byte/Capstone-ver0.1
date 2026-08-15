from app.config import settings
from app.factors.resolver import ResolvedFactor
from app.scoring.rubric import compute_weights


def test_direct_factor_alone_reaches_full_weight():
    factor = ResolvedFactor(
        factor_id="foreign_sell_flip", type="직접", direction="부정",
        description="외국인 순매도 전환", raw_strength=1.0,
    )
    weighted = compute_weights([factor])
    assert weighted[0]["weight"] == 100.0


def test_indirect_factor_alone_stays_capped_by_base_weight():
    """간접요인만 발생해도 직접요인 대비 discount(indirect_factor_weight)가
    정규화 과정에서 사라지면 안 된다 - 100%까지 부풀려지면 direct>indirect
    위계가 무너진다."""
    factor = ResolvedFactor(
        factor_id="sector_weakness", type="간접", direction="부정",
        description="IT 섹터 전반 약세", raw_strength=1.0,
    )
    weighted = compute_weights([factor])
    assert weighted[0]["weight"] == settings.indirect_factor_weight * 100


def test_direct_outweighs_indirect_at_equal_raw_strength():
    """같은 raw_strength라면 직접요인이 간접요인보다 더 크게 반영돼야 한다
    (BASE_TYPE_WEIGHT의 핵심 보장). raw_strength 자체가 다르면 신호가 약한 쪽이
    지는 게 당연하므로, 이 비교는 raw_strength를 동일하게 고정해야 의미가 있다."""
    direct = ResolvedFactor(
        factor_id="rsi_oversold_exit", type="직접", direction="긍정",
        description="RSI 과매도 이탈", raw_strength=0.5,
    )
    indirect = ResolvedFactor(
        factor_id="sector_strength", type="간접", direction="긍정",
        description="IT 섹터 전반 강세", raw_strength=0.5,
    )
    weighted = {w["factor"]: w["weight"] for w in compute_weights([direct, indirect])}
    assert weighted["RSI 과매도 이탈"] > weighted["IT 섹터 전반 강세"]
