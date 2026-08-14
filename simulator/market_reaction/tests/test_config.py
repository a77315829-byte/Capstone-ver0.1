"""config.py 의 RAG 관련 설정 기본값 테스트."""

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
