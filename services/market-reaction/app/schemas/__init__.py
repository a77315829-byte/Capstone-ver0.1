"""시장 반응 시뮬레이션 데이터 계약(schemas).

이 패키지는 Pydantic v2 모델과 enum 만 정의한다.
계산 로직/LLM 호출/fallback/route/저장 은 포함하지 않는다.
"""

from .agent import AgentOutput
from .analysis import (
    AgentType,
    AnalysisConfidence,
    Classification,
    ConfidenceGrade,
    CurrentStockContext,
    DataSource,
    DbSaveStatus,
    ExternalContext,
    ImpactDirection,
    ImpactStrength,
    InputClassificationResult,
    InputRelevance,
    InputType,
    LlmStatus,
    MarketPressure,
    MarketSentiment,
    RealtimeContext,
    ReactionDirection,
    ReactionStrength,
    ResponseStatus,
    SentimentCode,
    SimulationMeta,
    StandardInput,
    TimeHorizon,
)
from .request import SelectedStock, SimulationRequest
from .response import (
    ImpactAnalysis,
    RejectedResponse,
    SimulationResponse,
)

__all__ = [
    # request
    "SelectedStock",
    "SimulationRequest",
    # analysis models
    "InputClassificationResult",
    "ExternalContext",
    "CurrentStockContext",
    "RealtimeContext",
    "StandardInput",
    "MarketPressure",
    "MarketSentiment",
    "AnalysisConfidence",
    "SimulationMeta",
    # agent
    "AgentOutput",
    # response
    "ImpactAnalysis",
    "SimulationResponse",
    "RejectedResponse",
    # enums
    "ResponseStatus",
    "InputType",
    "Classification",
    "ImpactDirection",
    "ImpactStrength",
    "TimeHorizon",
    "ReactionDirection",
    "ReactionStrength",
    "InputRelevance",
    "SentimentCode",
    "ConfidenceGrade",
    "AgentType",
    "LlmStatus",
    "DbSaveStatus",
    "DataSource",
]
