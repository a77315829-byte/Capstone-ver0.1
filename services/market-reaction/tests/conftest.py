"""테스트 공용 fixture."""

import pytest

import app.services.llm_client as llmc


@pytest.fixture
def offline(monkeypatch):
    """Ollama 를 사용할 수 없는 상태로 강제한다(닫힌 포트 → 연결 실패 → fallback).

    이 fixture 를 사용하는 테스트는 LLM 호출이 항상 실패하므로 fallback 경로를 검증한다.
    """
    monkeypatch.setattr(llmc.settings, "ollama_host", "http://127.0.0.1:9")
    monkeypatch.setattr(llmc.settings, "ollama_max_retries", 0)
    return True
