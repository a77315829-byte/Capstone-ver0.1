from typing import Literal
from pydantic import BaseModel, Field

FactorType = Literal["직접", "간접"]
FactorDirection = Literal["긍정", "부정"]
Judgment = Literal["매수", "매도", "관망"]


class Factor(BaseModel):
    type: FactorType
    direction: FactorDirection | None = None  # 과거(마이그레이션 전) 이력 문서엔 없을 수 있어 optional
    factor: str
    weight: float = Field(ge=0, le=100)


class JudgmentResponse(BaseModel):
    symbol: str
    judge: Judgment
    confidence: float = Field(ge=0, le=100)
    summary: str
    factors: list[Factor]
    computed_at: str


class HistoryEntry(BaseModel):
    time: str
    judge: Judgment
    reason: str
    changed: bool


class CompareRequest(BaseModel):
    symbol: str
    user_judge: Judgment


class CompareResponse(BaseModel):
    user_judge: Judgment
    ai_judge: Judgment
    explanation: str
    highlighted_factors: dict[str, list[str]]
