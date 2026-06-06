"""fallback 로직 테스트(LLM 없이 실행 가능).

기준: docs/fallback_rules.md, docs/test_fixtures.json, docs/FINAL_REVIEW.md.
"""

import pytest

from app.core.confidence import calculate_analysis_confidence  # noqa: F401 (참조용)
from app.core.fallback import (
    AGENT_ORDER,
    build_all_fallback_agent_outputs,
    build_fallback_agent_output,
    fallback_agent_focus,
    fallback_classify_input,
    fallback_external_context,
    fallback_summary,
)
from app.core.pressure import calculate_market_pressure
from app.core.sentiment import determine_market_sentiment
from app.schemas.agent import AgentOutput
from app.schemas.analysis import (
    AgentType,
    Classification,
    ExternalContext,
    ImpactDirection,
    ReactionDirection,
)

STOCK = "삼성전자"

# 직접 추천으로 오해될 수 있는 표현(요약/코멘트에 있으면 안 됨)
_FORBIDDEN = ["매수하세요", "매도하세요", "사세요", "파세요", "추천", "지금 사야 합니다", "팔아야 합니다"]


# ---------------------------------------------------------------------------
# 1. valid 분류
# ---------------------------------------------------------------------------
def test_valid_industry_input():
    result = fallback_classify_input(
        STOCK,
        "AI 반도체 수요 증가로 삼성전자의 HBM 관련 실적 개선 가능성이 높아질 것으로 예상된다.",
    )
    assert result.classification == Classification.VALID
    assert result.reason_code is None


# ---------------------------------------------------------------------------
# 2. direct_advice 분류
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "text",
    [
        "삼성전자 지금 사야 하나요?",
        "삼성전자 지금 팔아야 하나요?",
        "삼성전자 매수해도 되나요?",
        "삼성전자 추천해줘",
    ],
)
def test_direct_advice_rejected(text):
    result = fallback_classify_input(STOCK, text)
    assert result.classification == Classification.DIRECT_ADVICE
    assert result.reason_code == "DIRECT_ADVICE_REQUEST"


# ---------------------------------------------------------------------------
# 3. 시장 반응 질문은 거절되지 않음
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "text",
    [
        "삼성전자 HBM 공급 확대 소식에 주가는 오를까?",
        "삼성전자 납품 지연 소식에 주가는 내릴까?",
        "삼성전자 HBM 공급 확대 시 시장은 어떻게 반응할까?",
        "삼성전자 반도체 수요 증가가 주가에 어떤 영향이 있을까?",
        "삼성전자 실적 발표가 나오면 시장 반응은 어떨까?",
    ],
)
def test_market_reaction_question_not_rejected(text):
    result = fallback_classify_input(STOCK, text)
    assert result.classification != Classification.DIRECT_ADVICE
    assert result.classification == Classification.VALID


# ---------------------------------------------------------------------------
# 4. 반복 문자열 → unanalyzable
# ---------------------------------------------------------------------------
def test_unanalyzable_repeated_chars():
    result = fallback_classify_input(STOCK, "ㅋㅋㅋㅋㅋㅋㅋㅋ")
    assert result.classification == Classification.UNANALYZABLE
    assert result.reason_code == "UNANALYZABLE"


# ---------------------------------------------------------------------------
# 5. 너무 짧은 입력 → vague
# ---------------------------------------------------------------------------
def test_vague_short_input():
    result = fallback_classify_input(STOCK, "좋아")
    assert result.classification == Classification.VAGUE
    assert result.reason_code == "TOO_SHORT_OR_VAGUE"


# ---------------------------------------------------------------------------
# 6. fallback_external_context 스키마 만족
# ---------------------------------------------------------------------------
def test_external_context_schema():
    ctx = fallback_external_context(
        STOCK, "AI 반도체 수요 증가로 HBM 실적 개선이 기대된다.", "industry_information"
    )
    assert isinstance(ctx, ExternalContext)
    assert ctx.impact_direction in set(ImpactDirection)
    assert len(ctx.related_industries) >= 1
    assert len(ctx.uncertainty_factors) >= 1
    assert isinstance(ctx.positive_factors, list)
    assert isinstance(ctx.negative_factors, list)


def test_external_context_direction_inference():
    pos = fallback_external_context(STOCK, "수요 증가와 실적 개선, 공급 계약 확대", "industry_information")
    neg = fallback_external_context(STOCK, "대규모 결함과 납품 지연, 실적 악화", "company_information")
    assert pos.impact_direction == ImpactDirection.POSITIVE
    assert neg.impact_direction == ImpactDirection.NEGATIVE


# ---------------------------------------------------------------------------
# 7. fallback_agent_focus 5개 key
# ---------------------------------------------------------------------------
def test_agent_focus_has_five_keys():
    focus = fallback_agent_focus(ImpactDirection.POSITIVE, "medium")
    expected = {a.value for a in AGENT_ORDER}
    assert set(focus.keys()) == expected
    for items in focus.values():
        assert isinstance(items, list)
        assert len(items) >= 1


# ---------------------------------------------------------------------------
# 8. price_reflection_level=high → 선반영 focus 추가
# ---------------------------------------------------------------------------
def test_agent_focus_high_reflection_adds_items():
    base = fallback_agent_focus(ImpactDirection.POSITIVE, "medium")
    high = fallback_agent_focus(ImpactDirection.POSITIVE, "high")

    # 신중 에이전트들의 focus 항목 수가 늘어난다
    assert len(high["institutional_investor"]) > len(base["institutional_investor"])
    # 선반영 관련 표현 포함
    joined = " ".join(high["institutional_investor"] + high["individual_investor"])
    assert "선반영" in joined or "추격 매수" in joined


# ---------------------------------------------------------------------------
# 9. build_fallback_agent_output 스키마 만족
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("direction", list(ImpactDirection))
@pytest.mark.parametrize("agent_type", list(AgentType))
def test_build_fallback_agent_output_schema(agent_type, direction):
    out = build_fallback_agent_output(agent_type, direction, "medium")
    assert isinstance(out, AgentOutput)
    assert out.agent_type == agent_type
    assert out.agent_name_ko
    assert out.reaction_direction in {
        ReactionDirection.BUY,
        ReactionDirection.SELL,
        ReactionDirection.HOLD,
    }
    assert out.reaction_direction_ko
    assert out.reaction_strength_ko
    assert out.base_weight > 0
    assert len(out.key_reasons) >= 1
    assert out.comment
    assert len(out.risk_factors) >= 1


def test_high_reflection_increases_hold():
    """주가 선반영(high) 시 관망(hold) 수가 줄지 않는다(신중 에이전트가 관망 전환)."""
    medium = build_all_fallback_agent_outputs(ImpactDirection.POSITIVE, "medium")
    high = build_all_fallback_agent_outputs(ImpactDirection.POSITIVE, "high")
    holds_medium = sum(1 for a in medium if a.reaction_direction == ReactionDirection.HOLD)
    holds_high = sum(1 for a in high if a.reaction_direction == ReactionDirection.HOLD)
    assert holds_high >= holds_medium


# ---------------------------------------------------------------------------
# 10. build_all_fallback_agent_outputs 항상 5개, 고정 순서
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("direction", list(ImpactDirection))
def test_build_all_returns_five_in_order(direction):
    outs = build_all_fallback_agent_outputs(direction, "medium")
    assert len(outs) == 5
    assert [o.agent_type for o in outs] == AGENT_ORDER


# ---------------------------------------------------------------------------
# 11. fallback_summary 한국어 + 직접 추천 표현 없음
# ---------------------------------------------------------------------------
def test_fallback_summary_no_direct_advice():
    agents = build_all_fallback_agent_outputs(ImpactDirection.POSITIVE, "medium")
    pressure = calculate_market_pressure(agents)
    sentiment = determine_market_sentiment(pressure)
    uncertainty = ["실제 공급 계약 여부", "주가 선반영 가능성"]

    summary = fallback_summary(
        STOCK, ImpactDirection.POSITIVE, pressure, sentiment, agents, uncertainty
    )

    assert isinstance(summary, str)
    assert len(summary) >= 20
    assert "불확실성" in summary
    for phrase in _FORBIDDEN:
        assert phrase not in summary
