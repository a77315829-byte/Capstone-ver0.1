from app.factors.resolver import ResolvedFactor
from app.scoring.rubric import compute_weights


def test_full_strength_factor_reaches_full_weight():
    factor = ResolvedFactor(
        factor_id="foreign_sell_flip", direction="부정",
        description="외국인 순매도 전환", raw_strength=1.0,
    )
    weighted = compute_weights([factor])
    assert weighted[0]["weight"] == 100.0


def test_weight_scales_linearly_with_raw_strength():
    factor = ResolvedFactor(
        factor_id="rsi_oversold_exit", direction="긍정",
        description="RSI 과매도 이탈", raw_strength=0.5,
    )
    weighted = compute_weights([factor])
    assert weighted[0]["weight"] == 50.0


def test_all_factors_treated_equally_regardless_of_origin():
    """모든 요인이 이 종목 자체의 시세/수급에서 계산되므로, 어떤 요인이든
    raw_strength가 같으면 weight도 같아야 한다 (타입별 할인 없음)."""
    a = ResolvedFactor(
        factor_id="rsi_oversold_exit", direction="긍정",
        description="RSI 과매도 이탈", raw_strength=0.5,
    )
    b = ResolvedFactor(
        factor_id="sector_strength", direction="긍정",
        description="IT 섹터 전반 강세", raw_strength=0.5,
    )
    weighted = {w["factor"]: w["weight"] for w in compute_weights([a, b])}
    assert weighted["RSI 과매도 이탈"] == weighted["IT 섹터 전반 강세"]


def test_sorted_descending_by_weight():
    strong = ResolvedFactor(
        factor_id="golden_cross", direction="긍정",
        description="단기/장기 이동평균 골든크로스", raw_strength=0.9,
    )
    weak = ResolvedFactor(
        factor_id="rsi_oversold_exit", direction="긍정",
        description="RSI 과매도 이탈", raw_strength=0.2,
    )
    weighted = compute_weights([weak, strong])
    assert weighted[0]["factor"] == "단기/장기 이동평균 골든크로스"
