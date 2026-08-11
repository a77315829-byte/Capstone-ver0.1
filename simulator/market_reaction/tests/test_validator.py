"""validate_simulation_input 테스트(offline → rule-based fallback 경로).

LLM 성공 경로(의미 판단)는 오프라인 테스트로 결정적으로 검증할 수 없으므로 실제 Ollama 로
수동 확인한다. 여기서는 형식 검증(LLM 호출 없음)과, LLM 실패 시 fallback_classify_input
전체 대체 경로를 검증한다.
"""

import pytest

from app.core.validator import is_valid, validate_simulation_input
from app.schemas.analysis import Classification
from app.schemas.request import SelectedStock, SimulationRequest

SAMSUNG = SelectedStock(code="005930", name="삼성전자")


def make_request(text: str) -> SimulationRequest:
    return SimulationRequest(user_id="u1", selected_stock=SAMSUNG, input_text=text)


@pytest.mark.asyncio
async def test_valid_industry_input(offline):
    result, fb = await validate_simulation_input(
        make_request("AI 반도체 수요 증가로 삼성전자의 HBM 관련 실적 개선 가능성이 높아질 것으로 예상된다.")
    )
    assert result.classification == Classification.VALID
    assert is_valid(result) is True
    assert fb == ["validator"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "text",
    [
        "삼성전자 지금 사야 하나요?",
        "삼성전자 지금 팔아야 하나요?",
        "삼성전자 추천해줘",
    ],
)
async def test_direct_advice_rejected(text, offline):
    """명시적 키워드는 format_check fast-path 로 걸러져 LLM 호출 자체가 없다(fb == [])."""
    result, fb = await validate_simulation_input(make_request(text))
    assert result.classification == Classification.DIRECT_ADVICE
    assert result.reason_code == "DIRECT_ADVICE_REQUEST"
    assert is_valid(result) is False
    assert fb == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "text",
    [
        "삼성전자 HBM 공급 확대 소식에 주가는 오를까?",
        "삼성전자 납품 지연 소식에 주가는 내릴까?",
        "삼성전자 HBM 공급 확대 시 시장은 어떻게 반응할까?",
    ],
)
async def test_market_reaction_questions_allowed(text, offline):
    result, _ = await validate_simulation_input(make_request(text))
    assert result.classification == Classification.VALID


@pytest.mark.asyncio
async def test_unanalyzable_repeated(offline):
    """형식 검증(rule-based)이라 LLM 호출 없이도 거절되고 fallback 모듈로 잡히지 않는다."""
    result, fb = await validate_simulation_input(make_request("ㅋㅋㅋㅋㅋㅋㅋㅋ"))
    assert result.classification == Classification.UNANALYZABLE
    assert fb == []


@pytest.mark.asyncio
async def test_vague_short(offline):
    result, fb = await validate_simulation_input(make_request("좋아"))
    assert result.classification == Classification.VAGUE
    assert fb == []


@pytest.mark.asyncio
async def test_low_relevance(offline):
    result, _ = await validate_simulation_input(make_request("오늘 점심은 뭘 먹을지 고민이다"))
    assert result.classification == Classification.LOW_RELEVANCE
