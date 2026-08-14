"""config.py 의 RAG 관련 설정 기본값 테스트."""

import pytest

from app.config import Settings


def test_rag_settings_defaults():
    s = Settings(_env_file=None)
    assert s.dart_api_key == ""
    assert s.rag_index_dir == "data/rag_index"
    assert s.ollama_embedding_model == "bge-m3"


def test_mongo_settings_defaults():
    s = Settings(_env_file=None)
    assert s.stotra_mongodb_username == ""
    assert s.stotra_mongodb_password == ""
    assert s.stotra_mongodb_cluster == ""
    assert s.mongo_db_name == ""
    assert s.rag_max_cached_stocks is None


def test_rag_max_cached_stocks_empty_string_env_becomes_none(monkeypatch):
    """빈 문자열 env var가 field_validator를 통해 None으로 변환되는지 확인."""
    monkeypatch.setenv("RAG_MAX_CACHED_STOCKS", "")
    s = Settings(_env_file=None)
    assert s.rag_max_cached_stocks is None
