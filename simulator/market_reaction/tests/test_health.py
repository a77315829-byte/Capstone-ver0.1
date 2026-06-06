"""/health 엔드포인트 회귀 테스트.

ollama 가 connected/disconnected 어느 쪽이든 응답 필드가 정확해야 하며,
문자열이 잘리거나 합쳐지면 안 된다. Ollama 상태와 무관하게 항상 HTTP 200.
"""

import app.main as main
from fastapi.testclient import TestClient

client = TestClient(main.app)

EXPECTED_KEYS = {"status", "service", "version", "ollama", "model"}


def _expected(ollama_value: str) -> dict:
    return {
        "status": "ok",
        "service": "market-reaction",
        "version": "0.1.0",
        "ollama": ollama_value,
        "model": main.settings.ollama_model,
    }


def test_health_connected(monkeypatch):
    async def fake_check():
        return "connected"

    monkeypatch.setattr(main, "_check_ollama", fake_check)

    resp = client.get("/health")
    body = resp.json()
    assert resp.status_code == 200
    assert resp.json() == _expected("connected")
    # connected 케이스 명시 검증: 전체 문자열 + model 존재
    assert body["ollama"] == "connected"
    assert body["model"] == "llama3.1:8b"
    assert "model" in body


def test_health_disconnected(monkeypatch):
    async def fake_check():
        return "disconnected"

    monkeypatch.setattr(main, "_check_ollama", fake_check)

    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == _expected("disconnected")


def test_health_always_200_when_ollama_down(monkeypatch):
    """실제 _check_ollama 로직: 닫힌 포트를 가리키면 disconnected + 200."""
    monkeypatch.setattr(main.settings, "ollama_host", "http://127.0.0.1:9")

    resp = client.get("/health")
    body = resp.json()

    assert resp.status_code == 200
    assert body["ollama"] == "disconnected"


def test_health_fields_not_truncated_or_merged(monkeypatch):
    async def fake_check():
        return "connected"

    monkeypatch.setattr(main, "_check_ollama", fake_check)
    body = client.get("/health").json()

    # 키 누락/잘림 방지
    assert set(body.keys()) == EXPECTED_KEYS
    # ollama 는 정확히 허용값 중 하나(잘린 "co"/"di" 아님)
    assert body["ollama"] in {"connected", "disconnected"}
    # model 은 설정값 전체(잘리거나 ollama 필드에 섞이지 않음)
    assert body["model"] == main.settings.ollama_model
    assert ":8b" not in body["ollama"]
    assert body["service"] == "market-reaction"
    assert body["version"] == "0.1.0"
