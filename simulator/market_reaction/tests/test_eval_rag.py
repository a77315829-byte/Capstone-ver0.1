"""eval_rag.py 의 입력 구성 로직 테스트."""

from scripts.eval_rag import build_input_text


def test_uses_disclosure_body_when_available():
    """본문이 있으면 본문을 입력으로 쓴다.

    제목만 쓰면 '자기주식취득결정' 처럼 방향을 가르는 정보(취득목적, 금액)가 빠진다.
    실제 사례: 삼성전자 2026-08-21 자사주 취득의 목적은 '임직원 주식보상' 이었고
    정답 라벨은 negative 였는데, 제목만으로는 교과서적으로 호재로 읽힌다.
    """
    case = {
        "stock_code": "005930",
        "event_title": "주요사항보고서(자기주식취득결정)",
        "event_body": "취득예정금액 15조원 취득목적 임직원 주식보상 취득방법 장내 매수",
    }

    text = build_input_text(case, "삼성전자")

    assert "임직원 주식보상" in text
    assert "삼성전자" in text


def test_falls_back_to_title_when_body_missing():
    """본문 수집에 실패한 케이스는 제목만으로라도 평가한다(조용히 빠뜨리지 않는다)."""
    case = {
        "stock_code": "005930",
        "event_title": "주요사항보고서(자기주식취득결정)",
        "event_body": "",
    }

    text = build_input_text(case, "삼성전자")

    assert "자기주식취득결정" in text
    assert "삼성전자" in text
