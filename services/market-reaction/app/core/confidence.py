"""분석 신뢰도 계산 — 순수 함수.

docs/market_reaction_backend_spec.md 섹션 13, docs/test_fixtures.json 의
confidence_tests 계약을 따른다. LLM/외부 호출 없음.

이 신뢰도는 실제 시장 예측 정확도를 보장하는 값이 아니라,
입력 정보의 구체성과 분석 일관성 등을 종합한 참고 지표다.
"""

from __future__ import annotations

from ..schemas.analysis import AnalysisConfidence, ConfidenceGrade

# 가중치
_W_INPUT_SPECIFICITY = 0.20
_W_STOCK_RELEVANCE = 0.20
_W_DATA_COMPLETENESS = 0.20
_W_ANALYSIS_CONSISTENCY = 0.25
_W_UNCERTAINTY = 0.15

# 추가 감점
_FALLBACK_PENALTY = 0.05  # fallback 모듈 1개당
_STUB_PENALTY = 0.10  # stub 시세 사용 시


def score_input_specificity(text: str) -> float:
    """입력 길이 기반 구체성 점수(보조 helper)."""
    length = len(text.strip())
    if length >= 60:
        return 1.0
    if length >= 30:
        return 0.7
    if length >= 10:
        return 0.4
    return 0.2


def score_uncertainty(num_uncertainty_factors: int) -> float:
    """불확실성 요인 개수 기반 점수(보조 helper)."""
    if num_uncertainty_factors <= 1:
        return 1.0
    if num_uncertainty_factors <= 3:
        return 0.7
    return 0.4


def _grade(score: float) -> tuple[ConfidenceGrade, str]:
    if score >= 0.75:
        return ConfidenceGrade.HIGH, "높음"
    if score >= 0.50:
        return ConfidenceGrade.MEDIUM, "보통"
    return ConfidenceGrade.LOW, "낮음"


def _build_explanation(
    grade_ko: str,
    uses_stub_stock_data: bool,
    fallback_modules_count: int,
) -> str:
    parts = [f"분석 신뢰도는 '{grade_ko}' 수준입니다."]
    if uses_stub_stock_data:
        parts.append("현재 시세가 stub 데이터라 데이터 완전성 점수가 낮게 반영되었습니다.")
    if fallback_modules_count > 0:
        parts.append(
            f"{fallback_modules_count}개 모듈이 fallback으로 처리되어 일부 감점되었습니다."
        )
    parts.append(
        "이 값은 입력 정보의 구체성과 분석 일관성 등을 종합한 참고 지표이며, "
        "실제 시장 예측의 정확도를 보장하지 않습니다."
    )
    return " ".join(parts)


def calculate_analysis_confidence(
    input_specificity: float,
    stock_relevance: float,
    data_completeness: float,
    analysis_consistency: float,
    uncertainty_score: float,
    fallback_modules_count: int = 0,
    uses_stub_stock_data: bool = False,
) -> AnalysisConfidence:
    """세부 점수(0.0~1.0) + 감점 요소 → 분석 신뢰도.

    감점: fallback 모듈 1개당 -0.05, stub 시세 사용 시 -0.10.
    최종 score 는 0.0~1.0 으로 clamp 후 소수점 3자리 반올림.
    """
    raw = (
        input_specificity * _W_INPUT_SPECIFICITY
        + stock_relevance * _W_STOCK_RELEVANCE
        + data_completeness * _W_DATA_COMPLETENESS
        + analysis_consistency * _W_ANALYSIS_CONSISTENCY
        + uncertainty_score * _W_UNCERTAINTY
    )
    raw -= _FALLBACK_PENALTY * fallback_modules_count
    if uses_stub_stock_data:
        raw -= _STUB_PENALTY

    score = round(min(1.0, max(0.0, raw)), 3)
    grade, grade_ko = _grade(score)
    explanation = _build_explanation(grade_ko, uses_stub_stock_data, fallback_modules_count)

    return AnalysisConfidence(
        score=score,
        grade=grade,
        grade_ko=grade_ko,
        explanation=explanation,
    )
