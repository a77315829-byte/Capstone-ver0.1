"""시장 반응 시뮬레이션 최종 응답 모델 (출력 계약).

docs/market_reaction_backend_spec.md 섹션 15 의 최종 응답 JSON 과 1:1 대응.
"""

from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field

from .agent import AgentOutput
from .analysis import (
    AnalysisConfidence,
    CurrentStockContext,
    ImpactDirection,
    ImpactStrength,
    InputType,
    MarketPressure,
    MarketSentiment,
    ResponseStatus,
    SimulationMeta,
    TimeHorizon,
)
from .request import SelectedStock


class ImpactAnalysis(BaseModel):
    """응답의 impact_analysis 블록(영문 enum + 한글 라벨)."""

    impact_direction: ImpactDirection = Field(description="영향 방향")
    impact_direction_ko: str = Field(description="영향 방향 한글 라벨")
    impact_strength: ImpactStrength = Field(description="영향 강도")
    impact_strength_ko: str = Field(description="영향 강도 한글 라벨")
    related_industries: List[str] = Field(default_factory=list, description="관련 산업")
    time_horizon: TimeHorizon = Field(description="영향 시간 범위")
    time_horizon_ko: str = Field(description="시간 범위 한글 라벨")
    key_keywords: List[str] = Field(default_factory=list, description="핵심 키워드")


class SimulationResponse(BaseModel):
    """POST /simulate 정상 응답."""

    status: ResponseStatus = Field(
        default=ResponseStatus.OK, description="응답 상태(정상: ok)"
    )
    simulation_id: str = Field(description="시뮬레이션 식별자")
    selected_stock: SelectedStock = Field(description="선택 종목")
    input_text: str = Field(description="사용자 입력 텍스트")
    input_type: InputType = Field(description="확정된 입력 유형")
    impact_analysis: ImpactAnalysis = Field(description="영향 분석 요약")
    current_stock_context: CurrentStockContext = Field(description="현재 종목 상태")
    market_pressure: MarketPressure = Field(description="시장 압력")
    market_sentiment: MarketSentiment = Field(description="시장 분위기")
    analysis_confidence: AnalysisConfidence = Field(description="분석 신뢰도")
    uncertainty_factors: List[str] = Field(
        default_factory=list, description="주요 불확실성 요소"
    )
    agent_reactions: List[AgentOutput] = Field(
        default_factory=list, description="5개 에이전트 반응"
    )
    overall_explanation: str = Field(description="종합 해설")
    meta: SimulationMeta = Field(description="응답 메타데이터")
    created_at: datetime = Field(description="생성 시각")


class RejectedResponse(BaseModel):
    """입력값 부적합 등으로 분석을 거절한 응답."""

    status: ResponseStatus = Field(
        default=ResponseStatus.REJECTED, description="응답 상태(거절: rejected)"
    )
    reason_code: str = Field(description="거절 사유 코드")
    message: str = Field(description="사용자 안내문")
