"""입력값 적합성 확인 — hybrid(rule-based 형식 검증 + LLM 의미 판단).

- 빈 입력/동일 문자 반복/한글 자모 단독 나열/너무 짧음(10자 미만) 같은 **형식** 문제는
  LLM 호출 없이 rule-based 로 즉시 판정한다(UNANALYZABLE/VAGUE).
- 형식이 정상이면 직접·완곡 매수/매도 추천 요청 여부, 시장 관련성 같은 **의미** 판단은
  LLM 으로 분류한다(VALID/DIRECT_ADVICE/LOW_RELEVANCE).
- LLM 호출이 실패하면 기존 fallback_classify_input() 전체(rule-based)로 대체한다.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from ..schemas.analysis import Classification, InputClassificationResult, InputType
from ..schemas.request import SimulationRequest
from ..services.llm_client import PROMPT_INJECTION_GUARD, chat_json, wrap_user_content
from .fallback import ADVICE_KEYWORDS, REASON_MESSAGES, fallback_classify_input

_MIN_LENGTH = 10

_SYSTEM = f"""You are an input classifier for a stock market-reaction simulation service.
Classify the user's input text about a selected stock into exactly one category:

- "valid": analyzable input about news, events, scenarios, or information related to the
  stock or its industry. Questions asking how the market/price MIGHT react
  (e.g. "will it go up?", "how would the market react to this?") are VALID —
  they are not advice requests.
- "direct_advice": the user is asking to be told directly whether to buy/sell/enter/exit
  right now, or asking for a buy/sell recommendation. This includes indirect or softened
  phrasing (e.g. "should I get in now?", "is it worth buying?", "should I sell this?").
- "low_relevance": the input has no meaningful connection to the selected stock, its
  industry, or the broader market.

If classification is "valid", also infer input_type: real_news, hypothetical_scenario,
company_information, industry_information, economic_market_event, or unknown.
If classification is not "valid", set input_type to "unknown".

{PROMPT_INJECTION_GUARD}
Output JSON only."""

_SCHEMA = {
    "type": "object",
    "properties": {
        "classification": {
            "type": "string",
            "enum": ["valid", "direct_advice", "low_relevance"],
        },
        "input_type": {
            "type": "string",
            "enum": [
                "real_news", "hypothetical_scenario", "company_information",
                "industry_information", "economic_market_event", "unknown",
            ],
        },
    },
    "required": ["classification", "input_type"],
}


def _build_user_prompt(stock_name: str, input_text: str) -> str:
    return (
        f"Selected stock: {stock_name}\n"
        f"Input:\n{wrap_user_content(input_text)}"
    )


def _rejected(classification: Classification) -> InputClassificationResult:
    reason_code, message = REASON_MESSAGES[classification]
    return InputClassificationResult(
        classification=classification,
        input_type=InputType.UNKNOWN,
        reason_code=reason_code,
        message=message,
    )


def _format_check(input_text: str) -> Optional[InputClassificationResult]:
    """형식 검증(rule-based). 문제 있으면 거절 결과, 없으면 None(LLM 판단으로 넘어감).

    명시적 매수/매도 추천 키워드는 길이 검증보다 우선 판정한다(fallback_classify_input 과
    동일한 우선순위 — "삼성전자 추천해줘"처럼 짧지만 명백한 요청이 '너무 짧음'으로
    잘못 걸러지지 않도록). 이 외의 완곡/간접 표현 판단은 LLM 이 담당한다.
    """
    text = input_text.strip()

    if re.search(r"(.)\1{5,}", text) or re.fullmatch(r"[㄰-㆏\s]*", text):
        return _rejected(Classification.UNANALYZABLE)
    if any(kw in text for kw in ADVICE_KEYWORDS):
        return _rejected(Classification.DIRECT_ADVICE)
    if len(text) < _MIN_LENGTH:
        return _rejected(Classification.VAGUE)
    return None


async def validate_simulation_input(
    request: SimulationRequest,
) -> Tuple[InputClassificationResult, List[str]]:
    """시뮬레이션 요청의 입력값을 분류한다. (결과, fallback_modules) 를 반환한다.

    - 직접 투자 행동 추천 요청("지금 사야/팔아야", "추천해줘", 완곡한 표현 포함) → direct_advice
    - 시장 반응 질문("오를까", "내릴까", "어떻게 반응할까") → 거절하지 않음(valid 가능)
    - 형식 문제(너무 짧음/무의미)는 vague / unanalyzable 로 LLM 호출 없이 즉시 거절
    - 관련성 낮음은 low_relevance
    """
    format_result = _format_check(request.input_text)
    if format_result is not None:
        return format_result, []

    try:
        parsed = await chat_json(
            system=_SYSTEM,
            user=_build_user_prompt(request.selected_stock.name, request.input_text),
            schema=_SCHEMA,
            response_model=InputClassificationResult,
        )
        classification = Classification(parsed["classification"])
        if classification != Classification.VALID:
            return _rejected(classification), []
        return (
            InputClassificationResult(
                classification=Classification.VALID,
                input_type=InputType(parsed["input_type"]),
                reason_code=None,
                message=None,
            ),
            [],
        )
    except Exception:
        result = fallback_classify_input(request.selected_stock.name, request.input_text)
        return result, ["validator"]


def is_valid(result: InputClassificationResult) -> bool:
    """분류 결과가 분석 진행 가능한 상태인지 여부."""
    return result.classification == Classification.VALID
