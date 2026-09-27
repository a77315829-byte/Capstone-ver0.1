"""분석 신뢰도 순수 함수 테스트.

기준: docs/test_fixtures.json (confidence_tests), docs/market_reaction_backend_spec.md 섹션 13.
"""

import pytest

from app.core.confidence import (
    calculate_analysis_confidence,
    score_input_specificity,
    score_uncertainty,
)
from app.schemas.analysis import ConfidenceGrade


# ---------------------------------------------------------------------------
# 3.1 대표 신뢰도 (stub 시나리오 → 0.715 / medium / 보통)
# ---------------------------------------------------------------------------
def test_representative_confidence():
    result = calculate_analysis_confidence(
        input_specificity=1.0,
        stock_relevance=1.0,
        data_completeness=0.3,
        analysis_consistency=1.0,
        uncertainty_score=0.7,
        fallback_modules_count=0,
        uses_stub_stock_data=True,
    )

    assert result.score == pytest.approx(0.715)
    assert result.grade == ConfidenceGrade.MEDIUM
    assert result.grade_ko == "보통"
    assert result.explanation.strip()


# ---------------------------------------------------------------------------
# 3.2 high 등급 (경계값 0.75)
# ---------------------------------------------------------------------------
def test_grade_high_boundary():
    result = calculate_analysis_confidence(
        input_specificity=1.0,
        stock_relevance=1.0,
        data_completeness=1.0,
        analysis_consistency=0.6,
        uncertainty_score=0.0,
    )

    assert result.score == pytest.approx(0.75)
    assert result.grade == ConfidenceGrade.HIGH
    assert result.grade_ko == "높음"


# ---------------------------------------------------------------------------
# 3.3 medium 등급 (경계값 0.50)
# ---------------------------------------------------------------------------
def test_grade_medium_boundary():
    result = calculate_analysis_confidence(
        input_specificity=0.7,
        stock_relevance=0.7,
        data_completeness=0.6,
        analysis_consistency=0.4,
        uncertainty_score=0.0,
    )

    assert result.score == pytest.approx(0.50)
    assert result.grade == ConfidenceGrade.MEDIUM
    assert result.grade_ko == "보통"


# ---------------------------------------------------------------------------
# 3.4 low 등급 (낮음 케이스 0.155)
# ---------------------------------------------------------------------------
def test_grade_low():
    result = calculate_analysis_confidence(
        input_specificity=0.4,
        stock_relevance=0.4,
        data_completeness=0.3,
        analysis_consistency=0.3,
        uncertainty_score=0.4,
        fallback_modules_count=2,
        uses_stub_stock_data=True,
    )

    assert result.score == pytest.approx(0.155)
    assert result.grade == ConfidenceGrade.LOW
    assert result.grade_ko == "낮음"


# ---------------------------------------------------------------------------
# 3.5 fallback 감점 (1개당 -0.05)
# ---------------------------------------------------------------------------
def test_fallback_penalty():
    base_kwargs = dict(
        input_specificity=0.8,
        stock_relevance=0.8,
        data_completeness=0.8,
        analysis_consistency=0.8,
        uncertainty_score=0.8,
        uses_stub_stock_data=False,
    )
    no_fb = calculate_analysis_confidence(**base_kwargs, fallback_modules_count=0)
    one_fb = calculate_analysis_confidence(**base_kwargs, fallback_modules_count=1)
    two_fb = calculate_analysis_confidence(**base_kwargs, fallback_modules_count=2)

    assert no_fb.score == pytest.approx(0.80)
    assert one_fb.score == pytest.approx(0.75)
    assert two_fb.score == pytest.approx(0.70)


# ---------------------------------------------------------------------------
# 3.6 stub 시세 감점 (-0.10)
# ---------------------------------------------------------------------------
def test_stub_penalty():
    base_kwargs = dict(
        input_specificity=0.8,
        stock_relevance=0.8,
        data_completeness=0.8,
        analysis_consistency=0.8,
        uncertainty_score=0.8,
        fallback_modules_count=0,
    )
    no_stub = calculate_analysis_confidence(**base_kwargs, uses_stub_stock_data=False)
    with_stub = calculate_analysis_confidence(**base_kwargs, uses_stub_stock_data=True)

    assert no_stub.score == pytest.approx(0.80)
    assert with_stub.score == pytest.approx(0.70)


# ---------------------------------------------------------------------------
# 3.7 clamp (하한 0.0 / 상한 1.0)
# ---------------------------------------------------------------------------
def test_clamp_lower_bound():
    result = calculate_analysis_confidence(
        input_specificity=0.0,
        stock_relevance=0.0,
        data_completeness=0.0,
        analysis_consistency=0.0,
        uncertainty_score=0.0,
        fallback_modules_count=3,
        uses_stub_stock_data=True,
    )
    assert result.score == 0.0
    assert result.grade == ConfidenceGrade.LOW


def test_clamp_upper_bound():
    result = calculate_analysis_confidence(
        input_specificity=1.0,
        stock_relevance=1.0,
        data_completeness=1.0,
        analysis_consistency=1.0,
        uncertainty_score=1.0,
    )
    assert result.score == 1.0
    assert result.score <= 1.0
    assert result.grade == ConfidenceGrade.HIGH


# ---------------------------------------------------------------------------
# 3.8 helper 함수
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "text,expected",
    [
        ("가" * 60, 1.0),
        ("가" * 45, 0.7),
        ("가" * 20, 0.4),
        ("가" * 5, 0.2),
        ("   ", 0.2),  # strip 후 0자
    ],
)
def test_score_input_specificity(text, expected):
    assert score_input_specificity(text) == expected


@pytest.mark.parametrize(
    "count,expected",
    [
        (0, 1.0),
        (1, 1.0),
        (2, 0.7),
        (3, 0.7),
        (4, 0.4),
        (10, 0.4),
    ],
)
def test_score_uncertainty(count, expected):
    assert score_uncertainty(count) == expected
