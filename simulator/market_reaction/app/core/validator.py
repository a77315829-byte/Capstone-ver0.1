"""입력값 적합성 확인.

현재 단계는 LLM 분류를 사용하지 않고 rule-based fallback_classify_input 만 사용한다.
요청에서 종목명/입력 텍스트를 꺼내 분류 결과(InputClassificationResult)를 반환한다.
"""

from __future__ import annotations

from ..schemas.analysis import Classification, InputClassificationResult
from ..schemas.request import SimulationRequest
from .fallback import fallback_classify_input


def validate_simulation_input(request: SimulationRequest) -> InputClassificationResult:
    """시뮬레이션 요청의 입력값을 분류한다.

    - 직접 투자 행동 추천 요청("지금 사야/팔아야", "추천해줘" 등) → direct_advice
    - 시장 반응 질문("오를까", "내릴까", "어떻게 반응할까") → 거절하지 않음(valid 가능)
    - 너무 짧음/무의미/관련성 낮음은 각각 vague / unanalyzable / low_relevance
    """
    return fallback_classify_input(
        request.selected_stock.name, request.input_text
    )


def is_valid(result: InputClassificationResult) -> bool:
    """분류 결과가 분석 진행 가능한 상태인지 여부."""
    return result.classification == Classification.VALID
