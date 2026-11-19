"""config.py 의 RAG 관련 설정 기본값 테스트."""

import pytest

from app.config import Settings


def test_rag_settings_defaults():
    s = Settings(_env_file=None)
    assert s.dart_api_key == ""
    assert s.ollama_embedding_model == "bge-m3"


def test_mongo_settings_defaults():
    s = Settings(_env_file=None)
    assert s.stotra_mongodb_username == ""
    assert s.stotra_mongodb_password == ""
    assert s.stotra_mongodb_cluster == ""
    assert s.mongo_db_name == ""
    assert s.rag_max_cached_stocks == 16


def test_rag_max_cached_stocks_empty_string_uses_bounded_default(monkeypatch):
    monkeypatch.setenv("RAG_MAX_CACHED_STOCKS", "")
    s = Settings(_env_file=None)
    assert s.rag_max_cached_stocks == 16


def test_rag_cache_limit_accepts_zero_and_rejects_negative():
    assert Settings(_env_file=None, rag_max_cached_stocks=0).rag_max_cached_stocks == 0
    with pytest.raises(ValueError):
        Settings(_env_file=None, rag_max_cached_stocks=-1)
