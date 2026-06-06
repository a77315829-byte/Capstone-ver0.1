"""순수 계산 + deterministic fallback 로직(LLM/외부 호출 없음).

- pressure: 시장 압력
- sentiment: 시장 분위기
- confidence: 분석 신뢰도
- fallback: Ollama 미사용 시 rule-based 대체
"""

from .confidence import (
    calculate_analysis_confidence,
    score_input_specificity,
    score_uncertainty,
)
from .fallback import (
    build_all_fallback_agent_outputs,
    build_fallback_agent_output,
    fallback_agent_focus,
    fallback_classify_input,
    fallback_external_context,
    fallback_summary,
)
from .pressure import calculate_market_pressure
from .realtime_context import (
    build_realtime_context,
    determine_momentum,
    determine_price_reflection,
    determine_volatility,
)
from .sentiment import determine_market_sentiment
from .validator import is_valid, validate_simulation_input

__all__ = [
    # 순수 계산
    "calculate_market_pressure",
    "determine_market_sentiment",
    "calculate_analysis_confidence",
    "score_input_specificity",
    "score_uncertainty",
    # fallback
    "fallback_classify_input",
    "fallback_external_context",
    "fallback_agent_focus",
    "build_fallback_agent_output",
    "build_all_fallback_agent_outputs",
    "fallback_summary",
    # validator
    "validate_simulation_input",
    "is_valid",
    # realtime context
    "build_realtime_context",
    "determine_price_reflection",
    "determine_momentum",
    "determine_volatility",
]
