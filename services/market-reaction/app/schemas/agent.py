"""시장참여자 에이전트 출력 모델."""

from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field

from .analysis import (
    AgentType,
    InputRelevance,
    ReactionDirection,
    ReactionStrength,
)


class AgentOutput(BaseModel):
    """단일 에이전트의 반응 결과.

    base_weight 는 코드에서 고정 주입하는 float 이며 LLM 이 결정하지 않는다.
    input_relevance 는 low/normal/high enum 문자열로 유지하며,
    숫자(0.8/1.0/1.2) 변환은 이 단계에서 구현하지 않는다.
    """

    agent_type: AgentType = Field(description="에이전트 유형")
    agent_name_ko: str = Field(description="에이전트 한글명")
    reaction_direction: ReactionDirection = Field(description="반응 방향")
    reaction_direction_ko: str = Field(description="반응 방향 한글 라벨")
    reaction_strength: ReactionStrength = Field(description="반응 강도")
    reaction_strength_ko: str = Field(description="반응 강도 한글 라벨")
    base_weight: float = Field(description="고정 가중치(코드에서 주입)")
    input_relevance: InputRelevance = Field(
        description="입력 관련도 enum(low/normal/high). 숫자 변환은 후속 단계"
    )
    key_reasons: List[str] = Field(default_factory=list, description="핵심 근거")
    comment: str = Field(description="에이전트 코멘트")
    risk_factors: List[str] = Field(default_factory=list, description="리스크 요인")
