"""시장 반응 시뮬레이션 데이터 계약 — enum 및 분석 단계 모델.

이 모듈은 "데이터 계약"만 정의한다. 계산 로직/LLM 호출/fallback/route 는 포함하지 않는다.
enum 은 순환 import 를 피하기 위해 이 파일에 중앙화하고, 다른 schema 모듈이 여기서 가져온다.
docs/market_reaction_backend_spec.md, docs/test_fixtures.json 의 계약을 따른다.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


# =========================================================================
# Enums (데이터 계약 공통)
# =========================================================================


class ResponseStatus(str, Enum):
    """최종 응답 상태."""

    OK = "ok"
    REJECTED = "rejected"


class InputType(str, Enum):
    """입력 텍스트 유형."""

    REAL_NEWS = "real_news"
    HYPOTHETICAL_SCENARIO = "hypothetical_scenario"
    COMPANY_INFORMATION = "company_information"
    INDUSTRY_INFORMATION = "industry_information"
    ECONOMIC_MARKET_EVENT = "economic_market_event"
    UNKNOWN = "unknown"


class Classification(str, Enum):
    """입력값 적합성 분류 결과."""

    VALID = "valid"
    DIRECT_ADVICE = "direct_advice"
    LOW_RELEVANCE = "low_relevance"
    VAGUE = "vague"
    UNANALYZABLE = "unanalyzable"


class ImpactDirection(str, Enum):
    """영향 방향."""

    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"


class ImpactStrength(str, Enum):
    """영향 강도."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TimeHorizon(str, Enum):
    """영향 시간 범위."""

    SHORT_TERM = "short_term"
    MID_TERM = "mid_term"
    LONG_TERM = "long_term"


class ReactionDirection(str, Enum):
    """에이전트 반응 방향 / 시장 압력 우세 방향."""

    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


class ReactionStrength(str, Enum):
    """에이전트 반응 강도."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class InputRelevance(str, Enum):
    """에이전트 판단기준과 입력의 관련도. 숫자 변환(0.8/1.0/1.2)은 이후 단계에서 처리."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class SentimentCode(str, Enum):
    """시장 분위기 코드."""

    VERY_POSITIVE = "very_positive"
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    VERY_NEGATIVE = "very_negative"
    UNCERTAIN = "uncertain"


class ConfidenceGrade(str, Enum):
    """분석 신뢰도 등급."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AgentType(str, Enum):
    """시장참여자 에이전트 유형."""

    INDIVIDUAL_INVESTOR = "individual_investor"
    INSTITUTIONAL_INVESTOR = "institutional_investor"
    FOREIGN_INVESTOR = "foreign_investor"
    SHORT_TERM_INVESTOR = "short_term_investor"
    LONG_TERM_INVESTOR = "long_term_investor"


class LlmStatus(str, Enum):
    """meta.llm_status: LLM 호출 상태."""

    OK = "ok"
    PARTIAL_FAILURE = "partial_failure"
    FALLBACK = "fallback"


class DbSaveStatus(str, Enum):
    """meta.db_save_status: 결과 저장 상태."""

    SAVED = "saved"
    FAILED = "failed"
    NOT_USED = "not_used"


class DataSource(str, Enum):
    """시세 데이터 출처."""

    STUB = "stub"
    EXTERNAL_API = "external_api"
    UNKNOWN = "unknown"


# =========================================================================
# 분석 단계 모델
# =========================================================================


class InputClassificationResult(BaseModel):
    """입력값 적합성 확인(validator) 결과."""

    classification: Classification = Field(description="입력 적합성 분류")
    input_type: InputType = Field(description="입력 유형(분류 시 추론)")
    reason_code: Optional[str] = Field(
        default=None,
        description="거절 사유 코드(예: DIRECT_ADVICE_REQUEST). 정상 입력이면 None",
    )
    message: Optional[str] = Field(
        default=None, description="사용자 안내문(거절 시)"
    )


class ExternalContext(BaseModel):
    """외부 시장 맥락 분석(external_context) 결과."""

    event_summary: str = Field(description="사건 요약")
    event_type: str = Field(
        description=(
            "사건 유형. 허용값: earnings, new_product, regulation, "
            "industry_demand_increase, industry_demand_decrease, "
            "interest_rate_change, exchange_rate_change, supply_chain, "
            "competition, management_change, partnership, other"
        )
    )
    impact_direction: ImpactDirection = Field(description="영향 방향")
    impact_strength: ImpactStrength = Field(description="영향 강도")
    related_industries: List[str] = Field(default_factory=list, description="관련 산업")
    positive_factors: List[str] = Field(default_factory=list, description="긍정 요인")
    negative_factors: List[str] = Field(default_factory=list, description="부정 요인")
    uncertainty_factors: List[str] = Field(
        default_factory=list, description="불확실성 요인"
    )
    time_horizon: TimeHorizon = Field(description="영향 시간 범위")


class CurrentStockContext(BaseModel):
    """현재 종목 상태(시세 stub 포함)."""

    code: str = Field(description="종목 코드")
    name: str = Field(description="종목명")
    industry: str = Field(description="산업")
    current_price: Optional[int] = Field(default=None, description="현재가")
    daily_change_rate: Optional[float] = Field(default=None, description="등락률(%)")
    volume_trend: str = Field(
        description="거래량 추세. 허용값: increasing, stable, decreasing"
    )
    market_cap_trillion: Optional[float] = Field(
        default=None, description="시가총액(조원)"
    )
    data_source: DataSource = Field(description="시세 출처(stub/external_api)")
    is_realtime: bool = Field(description="실시간 시세 여부")
    observed_at: Optional[datetime] = Field(
        default=None, description="external_api 사용 시 관측 시각. stub 사용 시 None"
    )


class RealtimeContext(BaseModel):
    """실시간 모의투자 맥락 분석(realtime_context) 결과."""

    current_stock_context: CurrentStockContext = Field(description="현재 종목 상태")
    price_reflection_level: str = Field(
        description="가격 반영 수준. 허용값: low, medium, high"
    )
    short_term_momentum: str = Field(
        description="단기 모멘텀. 허용값: weak, moderate, strong"
    )
    volatility_level: str = Field(
        description="변동성 수준. 허용값: low, medium, high"
    )
    agent_focus: Dict[str, str] = Field(
        default_factory=dict, description="에이전트별 판단 초점"
    )
    internal_risk_factors: List[str] = Field(
        default_factory=list, description="내부 리스크 요인"
    )


class StandardInput(BaseModel):
    """에이전트 공통 표준 입력(integrator 산출물).

    주의: 사용자 보유 상태/평균 매입가/손익 상태는 의도적으로 포함하지 않는다.
    사용자 보유 상태는 에이전트 판단 및 시장 압력 계산에 사용하지 않는다.
    """

    selected_stock: str = Field(description="선택 종목명")
    input_type: InputType = Field(description="입력 유형")
    event_summary: str = Field(description="사건 요약")
    event_type: str = Field(description="사건 유형(ExternalContext.event_type 동일 허용값)")
    impact_direction: ImpactDirection = Field(description="영향 방향")
    impact_strength: ImpactStrength = Field(description="영향 강도")
    related_industries: List[str] = Field(default_factory=list, description="관련 산업")
    time_horizon: TimeHorizon = Field(description="영향 시간 범위")
    positive_factors: List[str] = Field(default_factory=list, description="긍정 요인")
    negative_factors: List[str] = Field(default_factory=list, description="부정 요인")
    uncertainty_factors: List[str] = Field(
        default_factory=list, description="불확실성 요인"
    )
    current_stock_context: CurrentStockContext = Field(description="현재 종목 상태")
    price_reflection_level: str = Field(
        description="가격 반영 수준. 허용값: low, medium, high"
    )
    short_term_momentum: str = Field(
        description="단기 모멘텀. 허용값: weak, moderate, strong"
    )
    volatility_level: str = Field(
        description="변동성 수준. 허용값: low, medium, high"
    )
    agent_focus: Dict[str, str] = Field(
        default_factory=dict, description="에이전트별 판단 초점"
    )
    analysis_confidence: Optional[float] = Field(
        default=None, description="분석 신뢰도(0.0~1.0). 통합 단계에서 산정"
    )


class MarketPressure(BaseModel):
    """시장 압력(매수/매도/관망 백분율)."""

    buy: int = Field(description="매수 압력(%)")
    sell: int = Field(description="매도 압력(%)")
    hold: int = Field(description="관망 압력(%)")
    dominant: ReactionDirection = Field(description="우세 방향")
    headline: str = Field(description="한 줄 헤드라인")


class MarketSentiment(BaseModel):
    """시장 분위기."""

    code: SentimentCode = Field(description="분위기 코드")
    label_ko: str = Field(description="한글 라벨")
    one_liner: str = Field(description="한 줄 설명")


class AnalysisConfidence(BaseModel):
    """분석 신뢰도."""

    score: float = Field(description="신뢰도 점수(0.0~1.0)")
    grade: ConfidenceGrade = Field(description="신뢰도 등급")
    grade_ko: str = Field(description="등급 한글 라벨")
    explanation: str = Field(description="신뢰도 설명")


class SimulationMeta(BaseModel):
    """응답 메타데이터(LLM/시세/저장 상태)."""

    llm_model: str = Field(description="사용 LLM 모델명")
    llm_status: LlmStatus = Field(description="LLM 호출 상태")
    fallback_used: bool = Field(description="fallback 사용 여부")
    fallback_modules: List[str] = Field(
        default_factory=list, description="fallback 으로 처리된 모듈 목록"
    )
    stock_data_source: DataSource = Field(description="시세 데이터 출처")
    db_save_status: DbSaveStatus = Field(description="결과 저장 상태")
