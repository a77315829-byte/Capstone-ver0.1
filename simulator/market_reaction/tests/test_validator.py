"""validate_simulation_input 테스트."""

import pytest

from app.core.validator import is_valid, validate_simulation_input
from app.schemas.analysis import Classification
from app.schemas.request import SelectedStock, SimulationRequest

SAMSUNG = SelectedStock(code="005930", name="삼성전자")


def make_request(text: str) -> SimulationRequest:
    return SimulationRequest(user_id="u1", selected_stock=SAMSUNG, input_text=text)


def test_valid_industry_input():
    result = validate_simulation_input(
        make_request("AI 반도체 수요 증가로 삼성전자의 HBM 관련 실적 개선 가능성이 높아질 것으로 예상된다.")
    )
    assert result.classification == Classification.VALID
    assert is_valid(result) is True


@pytest.mark.parametrize(
    "text",
    [
        "삼성전자 지금 사야 하나요?",
        "삼성전자 지금 팔아야 하나요?",
        "삼성전자 추천해줘",
    ],
)
def test_direct_advice_rejected(text):
    result = validate_simulation_input(make_request(text))
    assert result.classification == Classification.DIRECT_ADVICE
    assert result.reason_code == "DIRECT_ADVICE_REQUEST"
    assert is_valid(result) is False


@pytest.mark.parametrize(
    "text",
    [
        "삼성전자 HBM 공급 확대 소식에 주가는 오를까?",
        "삼성전자 납품 지연 소식에 주가는 내릴까?",
        "삼성전자 HBM 공급 확대 시 시장은 어떻게 반응할까?",
    ],
)
def test_market_reaction_questions_allowed(text):
    result = validate_simulation_input(make_request(text))
    assert result.classification == Classification.VALID


def test_unanalyzable_repeated():
    result = validate_simulation_input(make_request("ㅋㅋㅋㅋㅋㅋㅋㅋ"))
    assert result.classification == Classification.UNANALYZABLE


def test_vague_short():
    result = validate_simulation_input(make_request("좋아"))
    assert result.classification == Classification.VAGUE


def test_low_relevance():
    result = validate_simulation_input(make_request("오늘 점심은 뭘 먹을지 고민이다"))
    assert result.classification == Classification.LOW_RELEVANCE
