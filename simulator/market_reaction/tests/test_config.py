"""config.py 의 RAG 관련 설정 기본값 테스트."""

from app.config import Settings


def test_rag_settings_defaults():
    s = Settings(_env_file=None)
    assert s.dart_api_key == ""
    assert s.rag_index_dir == "data/rag_index"
    assert s.ollama_embedding_model == "bge-m3"
