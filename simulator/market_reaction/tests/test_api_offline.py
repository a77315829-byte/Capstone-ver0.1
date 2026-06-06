"""API offline 테스트 (TestClient)."""

from fastapi.testclient import TestClient

import app.main as main

client = TestClient(main.app)

_VALID_BODY = {
    "user_id": "test_user_001",
    "selected_stock": {"code": "005930", "name": "삼성전자"},
    "input_text": "AI 반도체 수요 증가로 삼성전자의 HBM 관련 실적 개선 가능성이 높아질 것으로 예상된다.",
    "input_type_hint": "industry_information",
}


def test_health_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["service"] == "market-reaction"


def test_simulate_ok(offline):
    resp = client.post("/simulate", json=_VALID_BODY)
    assert resp.status_code == 200
    body = resp.json()

    # 필수 필드
    for key in (
        "status", "simulation_id", "selected_stock", "input_text", "input_type",
        "impact_analysis", "current_stock_context", "market_pressure",
        "market_sentiment", "analysis_confidence", "uncertainty_factors",
        "agent_reactions", "overall_explanation", "meta", "created_at",
    ):
        assert key in body

    assert len(body["agent_reactions"]) == 5
    mp = body["market_pressure"]
    assert mp["buy"] + mp["sell"] + mp["hold"] == 100
    assert body["meta"]["db_save_status"] == "not_used"
    assert body["meta"]["stock_data_source"] == "stub"
    assert body["current_stock_context"]["data_source"] == "stub"


def test_simulate_direct_advice_422(offline):
    body = dict(_VALID_BODY, input_text="삼성전자 지금 사야 하나요?")
    resp = client.post("/simulate", json=body)
    assert resp.status_code == 422
    payload = resp.json()
    assert payload["status"] == "rejected"
    assert payload["reason_code"] == "DIRECT_ADVICE_REQUEST"


def test_get_simulations_not_implemented():
    resp = client.get("/simulations/sim_abc123")
    assert resp.status_code == 501
    assert "stateless" in resp.json()["message"]
