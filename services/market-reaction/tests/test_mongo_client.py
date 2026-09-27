"""mongo_client.py 테스트 (설정 값이 비어 있으면 네트워크 시도 없이 즉시 실패해야 함)."""

import pytest

import app.services.mongo_client as mongo_client_module
from app.services.mongo_client import MongoConfigError, get_database


@pytest.fixture(autouse=True)
def _reset_client(monkeypatch):
    monkeypatch.setattr(mongo_client_module, "_client", None)
    yield
    monkeypatch.setattr(mongo_client_module, "_client", None)


def test_get_database_raises_when_credentials_missing(monkeypatch):
    monkeypatch.setattr(mongo_client_module.settings, "stotra_mongodb_username", "")
    monkeypatch.setattr(mongo_client_module.settings, "stotra_mongodb_password", "")
    monkeypatch.setattr(mongo_client_module.settings, "stotra_mongodb_cluster", "")
    monkeypatch.setattr(mongo_client_module.settings, "mongo_db_name", "testdb")
    with pytest.raises(MongoConfigError):
        get_database()


def test_get_database_raises_when_db_name_missing(monkeypatch):
    monkeypatch.setattr(mongo_client_module.settings, "stotra_mongodb_username", "u")
    monkeypatch.setattr(mongo_client_module.settings, "stotra_mongodb_password", "p")
    monkeypatch.setattr(mongo_client_module.settings, "stotra_mongodb_cluster", "c.mongodb.net")
    monkeypatch.setattr(mongo_client_module.settings, "mongo_db_name", "")
    with pytest.raises(MongoConfigError):
        get_database()
