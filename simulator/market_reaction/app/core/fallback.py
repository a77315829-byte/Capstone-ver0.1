"""LLM 없이 동작하는 deterministic fallback 로직.

docs/fallback_rules.md 를 기준으로, Ollama 가 꺼져 있어도 시장 반응 시뮬레이션
파이프라인이 완주할 수 있도록 rule-based 대체 함수를 제공한다.

이 모듈은 LLM/외부 호출을 하지 않는다. 직접 매수/매도 추천과 구체적 가격 예측을
하지 않으며, 모든 자연어 출력은 시장 반응 설명형 한국어로 작성한다.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Union

from ..schemas.agent import AgentOutput
from ..schemas.analysis import (
    AgentType,
    Classification,
    ExternalContext,
    ImpactDirection,
    ImpactStrength,
    InputClassificationResult,
    InputRelevance,
    InputType,
    MarketPressure,
    MarketSentiment,
    ReactionDirection,
    ReactionStrength,
    SentimentCode,
    TimeHorizon,
)

# =========================================================================
# 공통 상수 / 한글 라벨 매핑
# =========================================================================

BASE_WEIGHTS: Dict[AgentType, float] = {
    AgentType.INDIVIDUAL_INVESTOR: 0.20,
    AgentType.INSTITUTIONAL_INVESTOR: 0.25,
    AgentType.FOREIGN_INVESTOR: 0.25,
    AgentType.SHORT_TERM_INVESTOR: 0.15,
    AgentType.LONG_TERM_INVESTOR: 0.15,
}

# fallback 및 응답 구성 순서(고정)
AGENT_ORDER: List[AgentType] = [
    AgentType.INDIVIDUAL_INVESTOR,
    AgentType.INSTITUTIONAL_INVESTOR,
    AgentType.FOREIGN_INVESTOR,
    AgentType.SHORT_TERM_INVESTOR,
    AgentType.LONG_TERM_INVESTOR,
]

AGENT_NAME_KO: Dict[AgentType, str] = {
    AgentType.INDIVIDUAL_INVESTOR: "개인 투자자",
    AgentType.INSTITUTIONAL_INVESTOR: "기관 투자자",
    AgentType.FOREIGN_INVESTOR: "외국인 투자자",
    AgentType.SHORT_TERM_INVESTOR: "단기 투자자",
    AgentType.LONG_TERM_INVESTOR: "장기 투자자",
}

_DIRECTION_KO: Dict[ReactionDirection, str] = {
    ReactionDirection.BUY: "매수",
    ReactionDirection.SELL: "매도",
    ReactionDirection.HOLD: "관망",
}

_STRENGTH_KO: Dict[ReactionStrength, str] = {
    ReactionStrength.LOW: "낮음",
    ReactionStrength.MEDIUM: "중간",
    ReactionStrength.HIGH: "높음",
}

_IMPACT_DIRECTION_KO: Dict[ImpactDirection, str] = {
    ImpactDirection.POSITIVE: "긍정적",
    ImpactDirection.NEGATIVE: "부정적",
    ImpactDirection.NEUTRAL: "중립적",
}

# 거절 사유 코드 / 안내문
_REASON = {
    Classification.DIRECT_ADVICE: (
        "DIRECT_ADVICE_REQUEST",
        "본 기능은 직접적인 매수·매도 추천을 제공하지 않습니다.",
    ),
    Classification.LOW_RELEVANCE: (
        "LOW_RELEVANCE",
        "입력 내용이 선택 종목과 관련성이 낮습니다. 다시 입력해 주세요.",
    ),
    Classification.VAGUE: (
        "TOO_SHORT_OR_VAGUE",
        "보다 구체적인 정보를 입력해 주세요.",
    ),
    Classification.UNANALYZABLE: (
        "UNANALYZABLE",
        "분석할 수 없는 입력입니다.",
    ),
}


def _coerce_direction(direction: Union[ImpactDirection, str]) -> ImpactDirection:
    if isinstance(direction, ImpactDirection):
        return direction
    return ImpactDirection(str(direction))


def _is_high_reflection(price_reflection_level: Optional[str]) -> bool:
    return str(price_reflection_level).lower() == "high"


# =========================================================================
# 1.1 입력값 분류 fallback
# =========================================================================

# 시장 반응 질문은 허용. 사용자의 투자 행동을 직접 결정해 달라는 요청만 거절.
_ADVICE_KEYWORDS = [
    "지금 사야", "지금 팔아야", "매수해도", "매도해도", "매수할까", "매도할까",
    "추천해", "매수 추천", "매도 추천", "지금 들어가야", "지금 나와야",
    "사도 되", "팔아도 되",
]

_INDUSTRY_KEYWORDS = [
    "반도체", "HBM", "AI", "배터리", "자동차", "바이오", "게임",
    "플랫폼", "조선", "에너지", "금리", "환율", "원유", "실적", "매출",
]


def fallback_classify_input(
    stock_name: str, input_text: str
) -> InputClassificationResult:
    """LLM 없이 키워드/규칙 기반으로 입력을 분류한다."""
    text = input_text.strip()

    # 1) 무의미 문자열: 동일 문자 6회 이상 반복 또는 한글 자모(U+3130~U+318F) 단독 나열
    if re.search(r"(.)\1{5,}", text) or re.fullmatch(r"[㄰-㆏\s]+", text):
        return _rejected(Classification.UNANALYZABLE)

    # 2) 직접 투자 행동 추천 요청(명시적 키워드는 길이보다 우선 판정)
    if any(kw in text for kw in _ADVICE_KEYWORDS):
        return _rejected(Classification.DIRECT_ADVICE)

    # 3) 너무 짧음/불명확: 10자 미만
    if len(text) < 10:
        return _rejected(Classification.VAGUE)

    # 4) 종목 관련성: 종목명도 없고 산업 키워드도 없으면 관련성 낮음
    if stock_name not in text and not any(kw in text for kw in _INDUSTRY_KEYWORDS):
        return _rejected(Classification.LOW_RELEVANCE)

    # 5) 분석 가능 → 입력 유형 추론
    return InputClassificationResult(
        classification=Classification.VALID,
        input_type=_infer_input_type(text),
        reason_code=None,
        message=None,
    )


def _rejected(classification: Classification) -> InputClassificationResult:
    reason_code, message = _REASON[classification]
    return InputClassificationResult(
        classification=classification,
        input_type=InputType.UNKNOWN,
        reason_code=reason_code,
        message=message,
    )


def _infer_input_type(text: str) -> InputType:
    if any(kw in text for kw in ["라면", "한다면", "가정", "만약", "경우"]):
        return InputType.HYPOTHETICAL_SCENARIO
    if any(kw in text for kw in ["실적", "매출", "영업이익", "순이익", "분기"]):
        return InputType.COMPANY_INFORMATION
    if any(kw in text for kw in ["수요", "공급", "산업", "시장", "업계", "투자 확대"]):
        return InputType.INDUSTRY_INFORMATION
    if any(kw in text for kw in ["금리", "환율", "원유", "원자재", "CPI", "GDP"]):
        return InputType.ECONOMIC_MARKET_EVENT
    return InputType.REAL_NEWS


# =========================================================================
# 1.2 외부 시장 맥락 fallback
# =========================================================================

_POSITIVE_KW = [
    "증가", "확대", "개선", "성장", "상승", "호조", "흑자",
    "계약", "수주", "출시", "돌파", "최대", "신고가",
]
_NEGATIVE_KW = [
    "감소", "축소", "악화", "하락", "적자", "손실",
    "규제", "제재", "소송", "리콜", "중단", "철수", "결함", "지연",
]

_INDUSTRY_MAP = {
    "반도체": ["반도체", "HBM", "DRAM", "NAND", "파운드리", "메모리"],
    "AI 인프라": ["AI", "인공지능", "GPU", "서버", "데이터센터"],
    "2차전지": ["배터리", "2차전지", "리튬", "양극재", "음극재"],
    "자동차": ["자동차", "EV", "전기차", "자율주행"],
    "바이오": ["바이오", "제약", "신약", "임상"],
    "조선": ["조선", "LNG", "선박"],
}

_TIME_MAP = {
    TimeHorizon.SHORT_TERM: ["오늘", "내일", "이번 주", "단기", "즉시"],
    TimeHorizon.LONG_TERM: ["장기", "3년", "5년", "10년", "구조적"],
}

_EVENT_TYPE_MAP = {
    "earnings": ["실적", "매출", "영업이익", "순이익"],
    "new_product": ["신제품", "출시", "발표"],
    "regulation": ["규제", "제재", "법안"],
    "industry_demand_increase": ["수요 증가", "수요 확대", "투자 확대"],
    "interest_rate_change": ["금리", "기준금리"],
    "exchange_rate_change": ["환율", "원달러"],
    "supply_chain": ["공급", "계약", "공급망"],
    "competition": ["경쟁사", "경쟁", "점유율"],
}


def fallback_external_context(
    stock_name: str,
    input_text: str,
    input_type: Union[InputType, str] = InputType.UNKNOWN,
) -> ExternalContext:
    """키워드 빈도 기반으로 최소 ExternalContext 를 생성한다."""
    pos_count = sum(1 for kw in _POSITIVE_KW if kw in input_text)
    neg_count = sum(1 for kw in _NEGATIVE_KW if kw in input_text)

    if pos_count > neg_count:
        direction = ImpactDirection.POSITIVE
    elif neg_count > pos_count:
        direction = ImpactDirection.NEGATIVE
    else:
        direction = ImpactDirection.NEUTRAL

    total = pos_count + neg_count
    if total >= 4:
        strength = ImpactStrength.HIGH
    elif total >= 2:
        strength = ImpactStrength.MEDIUM
    else:
        strength = ImpactStrength.LOW

    related = [
        industry
        for industry, kws in _INDUSTRY_MAP.items()
        if any(kw in input_text for kw in kws)
    ]
    if not related:
        related = ["기타"]

    time_horizon = TimeHorizon.MID_TERM
    for horizon, kws in _TIME_MAP.items():
        if any(kw in input_text for kw in kws):
            time_horizon = horizon
            break

    event_type = "other"
    for etype, kws in _EVENT_TYPE_MAP.items():
        if any(kw in input_text for kw in kws):
            event_type = etype
            break

    input_type_label = (
        input_type.value if isinstance(input_type, InputType) else str(input_type)
    )

    positive_factors = [f"{kw} 관련 긍정 요인" for kw in _POSITIVE_KW if kw in input_text][:3]
    negative_factors = [f"{kw} 관련 부정 요인" for kw in _NEGATIVE_KW if kw in input_text][:3]

    return ExternalContext(
        event_summary=f"{stock_name} 관련 {input_type_label} 분석 (자동 생성)",
        event_type=event_type,
        impact_direction=direction,
        impact_strength=strength,
        related_industries=related,
        positive_factors=positive_factors or ["정보 기반 긍정 요인 미검출"],
        negative_factors=negative_factors or ["정보 기반 부정 요인 미검출"],
        uncertainty_factors=[
            "LLM 분석 미수행으로 상세 불확실성 미평가",
            "사용자 입력 정보의 사실 여부 미확인",
        ],
        time_horizon=time_horizon,
    )


# =========================================================================
# 1.3 에이전트별 판단 초점 fallback
# =========================================================================

_BASE_FOCUS: Dict[AgentType, List[str]] = {
    AgentType.INDIVIDUAL_INVESTOR: ["뉴스 주목도", "테마성", "단기 기대감"],
    AgentType.INSTITUTIONAL_INVESTOR: ["실적 개선 가능성", "밸류에이션", "리스크"],
    AgentType.FOREIGN_INVESTOR: ["글로벌 산업 흐름", "환율", "외국인 수급 가능성"],
    AgentType.SHORT_TERM_INVESTOR: ["거래량", "모멘텀", "단기 변동성"],
    AgentType.LONG_TERM_INVESTOR: ["산업 지속성", "기업 경쟁력", "장기 실적 개선 가능성"],
}

# 주가 선반영(high) 시 추가되는 초점
_HIGH_REFLECTION_FOCUS: Dict[AgentType, str] = {
    AgentType.INDIVIDUAL_INVESTOR: "추격 매수 위험",
    AgentType.INSTITUTIONAL_INVESTOR: "밸류에이션 및 주가 선반영 여부",
    AgentType.SHORT_TERM_INVESTOR: "차익 실현 및 모멘텀 약화 가능성",
    AgentType.LONG_TERM_INVESTOR: "단기 가격 움직임과 장기 가치 분리",
}


def fallback_agent_focus(
    impact_direction: Union[ImpactDirection, str],
    price_reflection_level: Optional[str],
) -> Dict[str, List[str]]:
    """에이전트별 판단 초점(rule-based).

    base 초점은 방향과 무관하게 고정이며, price_reflection_level 이 high 일 때
    선반영 관련 초점이 추가된다. impact_direction 은 인터페이스 일관성을 위해
    받되, 현재 base 초점 분기에는 사용하지 않는다.
    """
    _coerce_direction(impact_direction)  # 유효성만 확인
    high = _is_high_reflection(price_reflection_level)

    focus: Dict[str, List[str]] = {}
    for agent_type in AGENT_ORDER:
        items = list(_BASE_FOCUS[agent_type])
        if high and agent_type in _HIGH_REFLECTION_FOCUS:
            items.append(_HIGH_REFLECTION_FOCUS[agent_type])
        focus[agent_type.value] = items
    return focus


# =========================================================================
# 1.4 에이전트 반응 fallback
# =========================================================================

# (impact_direction, agent_type) → 정적 반응. comment/key_reasons/risk_factors 는
# 시장 반응 설명형 한국어이며 직접 매수/매도 추천 문구를 포함하지 않는다.
_FALLBACK_MATRIX = {
    # === POSITIVE ===
    (ImpactDirection.POSITIVE, AgentType.INDIVIDUAL_INVESTOR): {
        "reaction_direction": ReactionDirection.BUY,
        "reaction_strength": ReactionStrength.HIGH,
        "input_relevance": InputRelevance.HIGH,
        "key_reasons": ["테마 기대감", "뉴스 주목도"],
        "comment": "긍정적 뉴스에 매수 관심이 높아질 수 있습니다.",
        "risk_factors": ["단기 과열 가능성"],
    },
    (ImpactDirection.POSITIVE, AgentType.INSTITUTIONAL_INVESTOR): {
        "reaction_direction": ReactionDirection.HOLD,
        "reaction_strength": ReactionStrength.MEDIUM,
        "input_relevance": InputRelevance.NORMAL,
        "key_reasons": ["실적 개선 가능성 확인 필요"],
        "comment": "긍정적이나 밸류에이션 확인을 위해 관망할 가능성이 있습니다.",
        "risk_factors": ["밸류에이션 부담", "주가 선반영 가능성"],
    },
    (ImpactDirection.POSITIVE, AgentType.FOREIGN_INVESTOR): {
        "reaction_direction": ReactionDirection.BUY,
        "reaction_strength": ReactionStrength.MEDIUM,
        "input_relevance": InputRelevance.NORMAL,
        "key_reasons": ["글로벌 투자 흐름 부합"],
        "comment": "글로벌 트렌드에 부합해 매수 성향을 보일 수 있습니다.",
        "risk_factors": ["환율 변동 리스크"],
    },
    (ImpactDirection.POSITIVE, AgentType.SHORT_TERM_INVESTOR): {
        "reaction_direction": ReactionDirection.BUY,
        "reaction_strength": ReactionStrength.HIGH,
        "input_relevance": InputRelevance.HIGH,
        "key_reasons": ["뉴스 모멘텀", "거래량 증가 기대"],
        "comment": "단기 모멘텀에 따라 매수 성향을 보일 수 있습니다.",
        "risk_factors": ["단기 변동성 확대"],
    },
    (ImpactDirection.POSITIVE, AgentType.LONG_TERM_INVESTOR): {
        "reaction_direction": ReactionDirection.HOLD,
        "reaction_strength": ReactionStrength.MEDIUM,
        "input_relevance": InputRelevance.NORMAL,
        "key_reasons": ["장기 성장 가능성"],
        "comment": "장기적으로 긍정적이나 지속성 확인을 위해 관망할 가능성이 있습니다.",
        "risk_factors": ["장기 실적 지속성 불확실"],
    },
    # === NEGATIVE ===
    (ImpactDirection.NEGATIVE, AgentType.INDIVIDUAL_INVESTOR): {
        "reaction_direction": ReactionDirection.SELL,
        "reaction_strength": ReactionStrength.HIGH,
        "input_relevance": InputRelevance.HIGH,
        "key_reasons": ["부정적 뉴스 확산", "공포 심리"],
        "comment": "부정적 뉴스에 매도 심리가 강해질 수 있습니다.",
        "risk_factors": ["과매도 가능성"],
    },
    (ImpactDirection.NEGATIVE, AgentType.INSTITUTIONAL_INVESTOR): {
        "reaction_direction": ReactionDirection.SELL,
        "reaction_strength": ReactionStrength.MEDIUM,
        "input_relevance": InputRelevance.NORMAL,
        "key_reasons": ["리스크 확대", "실적 악화 우려"],
        "comment": "리스크 관리 차원에서 비중을 줄일 가능성이 있습니다.",
        "risk_factors": ["추가 악재 가능성"],
    },
    (ImpactDirection.NEGATIVE, AgentType.FOREIGN_INVESTOR): {
        "reaction_direction": ReactionDirection.SELL,
        "reaction_strength": ReactionStrength.MEDIUM,
        "input_relevance": InputRelevance.NORMAL,
        "key_reasons": ["글로벌 리스크 회피"],
        "comment": "부정적 정보에 외국인 자금 이탈 가능성이 있습니다.",
        "risk_factors": ["신흥국 자금 유출"],
    },
    (ImpactDirection.NEGATIVE, AgentType.SHORT_TERM_INVESTOR): {
        "reaction_direction": ReactionDirection.SELL,
        "reaction_strength": ReactionStrength.HIGH,
        "input_relevance": InputRelevance.HIGH,
        "key_reasons": ["하락 모멘텀", "손절 기준 도달"],
        "comment": "하락 모멘텀에 빠르게 매도 대응할 가능성이 있습니다.",
        "risk_factors": ["반등 시 손실 확대"],
    },
    (ImpactDirection.NEGATIVE, AgentType.LONG_TERM_INVESTOR): {
        "reaction_direction": ReactionDirection.HOLD,
        "reaction_strength": ReactionStrength.LOW,
        "input_relevance": InputRelevance.LOW,
        "key_reasons": ["단기 악재의 장기 영향 제한적"],
        "comment": "장기 투자 논리 유지 여부를 확인하며 관망할 가능성이 있습니다.",
        "risk_factors": ["구조적 악화 가능성"],
    },
    # === NEUTRAL ===
    (ImpactDirection.NEUTRAL, AgentType.INDIVIDUAL_INVESTOR): {
        "reaction_direction": ReactionDirection.HOLD,
        "reaction_strength": ReactionStrength.LOW,
        "input_relevance": InputRelevance.LOW,
        "key_reasons": ["뚜렷한 방향성 없음"],
        "comment": "추가 정보를 기다리며 관망할 가능성이 있습니다.",
        "risk_factors": ["방향성 불명확"],
    },
    (ImpactDirection.NEUTRAL, AgentType.INSTITUTIONAL_INVESTOR): {
        "reaction_direction": ReactionDirection.HOLD,
        "reaction_strength": ReactionStrength.MEDIUM,
        "input_relevance": InputRelevance.NORMAL,
        "key_reasons": ["현재 포지션 유지"],
        "comment": "중립적 정보로 기존 판단을 유지할 가능성이 있습니다.",
        "risk_factors": ["예상과 다른 전개 가능성"],
    },
    (ImpactDirection.NEUTRAL, AgentType.FOREIGN_INVESTOR): {
        "reaction_direction": ReactionDirection.HOLD,
        "reaction_strength": ReactionStrength.LOW,
        "input_relevance": InputRelevance.LOW,
        "key_reasons": ["매크로 환경 관찰"],
        "comment": "추가 매크로 데이터를 확인하며 관망할 가능성이 있습니다.",
        "risk_factors": ["환율 변동"],
    },
    (ImpactDirection.NEUTRAL, AgentType.SHORT_TERM_INVESTOR): {
        "reaction_direction": ReactionDirection.HOLD,
        "reaction_strength": ReactionStrength.LOW,
        "input_relevance": InputRelevance.LOW,
        "key_reasons": ["명확한 트리거 없음"],
        "comment": "뚜렷한 진입 시그널이 없어 관망할 가능성이 있습니다.",
        "risk_factors": ["급변 가능성"],
    },
    (ImpactDirection.NEUTRAL, AgentType.LONG_TERM_INVESTOR): {
        "reaction_direction": ReactionDirection.HOLD,
        "reaction_strength": ReactionStrength.MEDIUM,
        "input_relevance": InputRelevance.NORMAL,
        "key_reasons": ["기존 투자 논리 유지"],
        "comment": "장기 관점에서 큰 변화 없이 관망할 가능성이 있습니다.",
        "risk_factors": ["거시 환경 변화 가능성"],
    },
}

# 주가 선반영(high)일 때 관망 가능성을 높이는 신중 에이전트
_HIGH_REFLECTION_HOLD_AGENTS = {
    AgentType.INSTITUTIONAL_INVESTOR,
    AgentType.FOREIGN_INVESTOR,
    AgentType.LONG_TERM_INVESTOR,
}

_DEFAULT_REACTION = {
    "reaction_direction": ReactionDirection.HOLD,
    "reaction_strength": ReactionStrength.LOW,
    "input_relevance": InputRelevance.NORMAL,
    "key_reasons": ["분석 정보 부족"],
    "comment": "추가 정보 확인이 필요해 관망할 가능성이 있습니다.",
    "risk_factors": ["분석 불확실성"],
}


def build_fallback_agent_output(
    agent_type: AgentType,
    impact_direction: Union[ImpactDirection, str],
    price_reflection_level: Optional[str] = "medium",
) -> AgentOutput:
    """단일 에이전트의 fallback 반응을 생성한다."""
    direction = _coerce_direction(impact_direction)
    base = _FALLBACK_MATRIX.get((direction, agent_type), _DEFAULT_REACTION)

    reaction_direction: ReactionDirection = base["reaction_direction"]
    reaction_strength: ReactionStrength = base["reaction_strength"]
    input_relevance: InputRelevance = base["input_relevance"]
    key_reasons: List[str] = list(base["key_reasons"])
    comment: str = base["comment"]
    risk_factors: List[str] = list(base["risk_factors"])

    # 주가 선반영(high)이면 신중 에이전트는 관망 가능성을 높인다.
    if _is_high_reflection(price_reflection_level) and agent_type in _HIGH_REFLECTION_HOLD_AGENTS:
        if reaction_direction != ReactionDirection.HOLD:
            reaction_direction = ReactionDirection.HOLD
            reaction_strength = ReactionStrength.MEDIUM
            comment = "주가 선반영 가능성을 점검하며 관망할 가능성이 있습니다."
            key_reasons = ["주가 선반영 가능성 점검"]
        if "주가 선반영 가능성" not in risk_factors:
            risk_factors = risk_factors + ["주가 선반영 가능성"]

    return AgentOutput(
        agent_type=agent_type,
        agent_name_ko=AGENT_NAME_KO[agent_type],
        reaction_direction=reaction_direction,
        reaction_direction_ko=_DIRECTION_KO[reaction_direction],
        reaction_strength=reaction_strength,
        reaction_strength_ko=_STRENGTH_KO[reaction_strength],
        base_weight=BASE_WEIGHTS[agent_type],
        input_relevance=input_relevance,
        key_reasons=key_reasons,
        comment=comment,
        risk_factors=risk_factors,
    )


def build_all_fallback_agent_outputs(
    impact_direction: Union[ImpactDirection, str],
    price_reflection_level: Optional[str] = "medium",
) -> List[AgentOutput]:
    """5개 에이전트 fallback 반응을 고정 순서로 반환한다."""
    return [
        build_fallback_agent_output(agent_type, impact_direction, price_reflection_level)
        for agent_type in AGENT_ORDER
    ]


# =========================================================================
# 1.6 종합 해설 fallback
# =========================================================================

_SENTIMENT_FIRST_SENTENCE = {
    SentimentCode.VERY_POSITIVE: "{stock}에 대해 매우 강한 긍정적 반응이 나타날 가능성이 높습니다.",
    SentimentCode.POSITIVE: "{stock}에 대해 전반적으로 긍정적인 반응이 나타날 가능성이 있습니다.",
    SentimentCode.NEUTRAL: "{stock}에 대해 뚜렷한 방향성 없이 엇갈린 반응이 나타날 수 있습니다.",
    SentimentCode.NEGATIVE: "{stock}에 대해 부정적인 반응이 나타날 가능성이 있습니다.",
    SentimentCode.VERY_NEGATIVE: "{stock}에 대해 강한 부정적 반응이 나타날 가능성이 높습니다.",
    SentimentCode.UNCERTAIN: "{stock}에 대해 시장참여자들의 판단이 유보적인 상태입니다.",
}


def fallback_summary(
    stock_name: str,
    impact_direction: Union[ImpactDirection, str],
    pressure: MarketPressure,
    sentiment: MarketSentiment,
    agents: List[AgentOutput],
    uncertainty_factors: List[str],
) -> str:
    """impact_direction / market_pressure / market_sentiment / uncertainty 를
    반영한 2~4문장 한국어 종합 해설(rule-based)."""
    direction = _coerce_direction(impact_direction)
    direction_ko = _IMPACT_DIRECTION_KO[direction]

    first = _SENTIMENT_FIRST_SENTENCE.get(
        sentiment.code, "{stock}의 시장 반응을 분석하였습니다."
    ).format(stock=stock_name)
    first = (
        f"입력 정보는 전반적으로 {direction_ko} 영향으로 해석되며, {first} "
        f"시장 분위기는 '{sentiment.label_ko}'으로 분석되었습니다."
    )

    pressure_sentence = (
        f"시장 압력은 매수 {pressure.buy}% · 매도 {pressure.sell}% · "
        f"관망 {pressure.hold}% 분포로 나타났습니다."
    )

    buy_names = [AGENT_NAME_KO[a.agent_type] for a in agents
                 if a.reaction_direction == ReactionDirection.BUY]
    hold_names = [AGENT_NAME_KO[a.agent_type] for a in agents
                  if a.reaction_direction == ReactionDirection.HOLD]
    sell_names = [AGENT_NAME_KO[a.agent_type] for a in agents
                  if a.reaction_direction == ReactionDirection.SELL]

    parts = []
    if buy_names:
        parts.append(f"{', '.join(buy_names)}은(는) 매수 성향을 보일 수 있고")
    if hold_names:
        parts.append(f"{', '.join(hold_names)}은(는) 관망할 가능성이 있으며")
    if sell_names:
        parts.append(f"{', '.join(sell_names)}은(는) 매도 성향을 보일 수 있습니다")
    agent_sentence = ", ".join(parts) + "." if parts else "시장참여자들의 반응이 혼재되어 있습니다."

    if uncertainty_factors:
        uf_text = ", ".join(uncertainty_factors[:3])
        closing = (
            f"사용자는 {uf_text} 등 주요 불확실성 요소를 함께 고려하여 "
            "모의투자 판단을 수행할 필요가 있습니다."
        )
    else:
        closing = "사용자는 주요 불확실성 요소를 함께 고려하여 모의투자 판단을 수행할 필요가 있습니다."

    return f"{first} {pressure_sentence} {agent_sentence} {closing}"
