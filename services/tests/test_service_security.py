import os
import sys
from pathlib import Path
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from service_security import install_service_security

class Repository:
    def get_session(self, session_id):
        if session_id == "missing":
            raise LookupError()
        return {"user_id": "alice"}

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("EXHIBITION_SERVICE_KEY", "test-service-key")
    app = FastAPI()
    install_service_security(app, scenario_repository=Repository)
    @app.get("/health")
    def health(): return {"status": "ok"}
    @app.get("/api/sessions/{session_id}/turn")
    def turn(session_id): return {"private": True}
    @app.get("/api/users/{user_id}/quiz-progress")
    def progress(user_id): return {"private": True}
    return TestClient(app)

def headers(user="alice"):
    return {"X-Service-Key": "test-service-key", "X-User-Id": user}

def test_no_key_and_wrong_key_are_denied(client):
    assert client.get("/api/sessions/123/turn").status_code == 401
    assert client.get("/api/sessions/123/turn", headers={"X-Service-Key": "wrong"}).status_code == 401
    assert client.get("/health").status_code == 200

def test_other_users_session_and_progress_are_denied(client):
    assert client.get("/api/sessions/123/turn", headers=headers("bob")).status_code == 403
    assert client.get("/api/users/bob/quiz-progress", headers=headers()).status_code == 403

def test_owner_can_access_and_missing_session_is_404(client):
    assert client.get("/api/sessions/123/turn", headers=headers()).status_code == 200
    assert client.get("/api/sessions/missing/turn", headers=headers()).status_code == 404

def test_unconfigured_service_fails_closed(client, monkeypatch):
    monkeypatch.delenv("EXHIBITION_SERVICE_KEY")
    assert client.get("/api/sessions/123/turn", headers=headers()).status_code == 503
