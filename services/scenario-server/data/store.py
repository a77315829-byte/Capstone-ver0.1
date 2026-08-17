"""MongoDB와 자동 테스트용 메모리 저장소.

서비스 계층은 이 모듈의 작은 문서 저장소 계약만 사용한다. 실제 베타는
MongoStore를 사용하며 테스트에서는 외부 서버 없이 MemoryStore를 사용한다.
"""
from __future__ import annotations

from copy import deepcopy
from threading import RLock
from typing import Any, Protocol
from uuid import uuid4


SortSpec = list[tuple[str, int]]


class DocumentStore(Protocol):
    def ping(self) -> None: ...
    def ensure_indexes(self) -> None: ...
    def find_one(self, collection: str, query: dict[str, Any]) -> dict | None: ...
    def find_many(
        self,
        collection: str,
        query: dict[str, Any] | None = None,
        *,
        sort: SortSpec | None = None,
        limit: int = 0,
    ) -> list[dict]: ...
    def insert_one(self, collection: str, document: dict[str, Any]) -> str: ...
    def replace_one(
        self,
        collection: str,
        query: dict[str, Any],
        document: dict[str, Any],
        *,
        upsert: bool = False,
    ) -> str | None: ...
    def delete_many(self, collection: str, query: dict[str, Any]) -> int: ...


def _get_nested(document: dict, path: str) -> Any:
    current: Any = document
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _matches(document: dict, query: dict[str, Any]) -> bool:
    for key, expected in query.items():
        actual = _get_nested(document, key)
        if isinstance(expected, dict):
            for operator, value in expected.items():
                if operator == "$lte" and not (actual is not None and actual <= value):
                    return False
                if operator == "$lt" and not (actual is not None and actual < value):
                    return False
                if operator == "$gte" and not (actual is not None and actual >= value):
                    return False
                if operator == "$gt" and not (actual is not None and actual > value):
                    return False
                if operator == "$in" and actual not in value:
                    return False
                if operator == "$ne" and actual == value:
                    return False
        elif actual != expected:
            return False
    return True


class MemoryStore:
    """서비스 단위 테스트와 로컬 로직 검증용 저장소."""

    def __init__(self) -> None:
        self._collections: dict[str, list[dict]] = {}
        self._lock = RLock()

    def ping(self) -> None:
        return None

    def ensure_indexes(self) -> None:
        return None

    def find_one(self, collection: str, query: dict[str, Any]) -> dict | None:
        with self._lock:
            for document in self._collections.get(collection, []):
                if _matches(document, query):
                    return deepcopy(document)
        return None

    def find_many(
        self,
        collection: str,
        query: dict[str, Any] | None = None,
        *,
        sort: SortSpec | None = None,
        limit: int = 0,
    ) -> list[dict]:
        with self._lock:
            result = [
                deepcopy(document)
                for document in self._collections.get(collection, [])
                if _matches(document, query or {})
            ]
        if sort:
            for field, direction in reversed(sort):
                result.sort(
                    key=lambda item: (_get_nested(item, field) is None, _get_nested(item, field)),
                    reverse=direction < 0,
                )
        return result[:limit] if limit else result

    def insert_one(self, collection: str, document: dict[str, Any]) -> str:
        saved = deepcopy(document)
        saved.setdefault("_id", str(uuid4()))
        with self._lock:
            self._collections.setdefault(collection, []).append(saved)
        return str(saved["_id"])

    def replace_one(
        self,
        collection: str,
        query: dict[str, Any],
        document: dict[str, Any],
        *,
        upsert: bool = False,
    ) -> str | None:
        saved = deepcopy(document)
        with self._lock:
            items = self._collections.setdefault(collection, [])
            for index, current in enumerate(items):
                if _matches(current, query):
                    saved.setdefault("_id", current.get("_id", str(uuid4())))
                    items[index] = saved
                    return str(saved["_id"])
            if upsert:
                saved.setdefault("_id", str(uuid4()))
                items.append(saved)
                return str(saved["_id"])
        return None

    def delete_many(self, collection: str, query: dict[str, Any]) -> int:
        with self._lock:
            items = self._collections.get(collection, [])
            kept = [item for item in items if not _matches(item, query)]
            deleted = len(items) - len(kept)
            self._collections[collection] = kept
        return deleted


class MongoStore:
    """PyMongo 기반 실제 저장소. import는 실행 시점까지 지연한다."""

    def __init__(self, uri: str, database: str, timeout_ms: int = 3000) -> None:
        try:
            from pymongo import MongoClient
        except ImportError as exc:  # pragma: no cover - 환경 설정 오류
            raise RuntimeError(
                "MongoDB 사용을 위해 'pip install -r requirements.txt'를 실행하세요."
            ) from exc
        self._client = MongoClient(
            uri,
            serverSelectionTimeoutMS=timeout_ms,
            connectTimeoutMS=timeout_ms,
        )
        self._db = self._client[database]

    def ping(self) -> None:
        self._client.admin.command("ping")

    def ensure_indexes(self) -> None:
        from pymongo import ASCENDING, DESCENDING

        specs: dict[str, list[tuple[list[tuple[str, int]], bool]]] = {
            "scenarios": [([("scenario_id", ASCENDING), ("version", ASCENDING)], True)],
            "question_banks": [([("bank_id", ASCENDING)], True)],
            "scenario_turns": [
                ([
                    ("scenario_id", ASCENDING),
                    ("scenario_version", ASCENDING),
                    ("turn_no", ASCENDING),
                ], True)
            ],
            "assets": [([("asset_id", ASCENDING)], True)],
            "daily_prices": [([("asset_id", ASCENDING), ("trade_date", ASCENDING)], True)],
            "news_items": [([("news_id", ASCENDING)], True)],
            "market_snapshots": [([("snapshot_id", ASCENDING)], True)],
            "order_book_snapshots": [
                ([
                    ("scenario_id", ASCENDING),
                    ("scenario_version", ASCENDING),
                    ("turn_no", ASCENDING),
                    ("asset_id", ASCENDING),
                    ("generator_version", ASCENDING),
                ], True),
                ([("snapshot_id", ASCENDING)], True),
            ],
            "turn_rubrics": [
                ([
                    ("scenario_id", ASCENDING),
                    ("scenario_version", ASCENDING),
                    ("turn_no", ASCENDING),
                ], True)
            ],
            "scenario_sessions": [([("session_id", ASCENDING)], True)],
            "orders": [([("order_id", ASCENDING)], True)],
            "turn_records": [([("session_id", ASCENDING), ("turn_no", ASCENDING)], True)],
            "turn_evaluations": [([("evaluation_id", ASCENDING)], True)],
            "portfolio_snapshots": [([("snapshot_id", ASCENDING)], True)],
            "scenario_evaluations": [
                ([("evaluation_id", ASCENDING)], True),
                ([("session_id", ASCENDING)], True),
            ],
            "user_behavior_profiles": [([("user_id", ASCENDING)], True)],
        }
        for collection, indexes in specs.items():
            for keys, unique in indexes:
                self._db[collection].create_index(keys, unique=unique)
        self._db["scenario_evaluations"].create_index(
            [("user_id", ASCENDING), ("completed_at", DESCENDING)]
        )
        self._db["orders"].create_index(
            [("session_id", ASCENDING), ("turn_no", ASCENDING), ("created_at", ASCENDING)]
        )

    @staticmethod
    def _clean(document: dict | None) -> dict | None:
        if document is None:
            return None
        value = deepcopy(document)
        if "_id" in value:
            value["_id"] = str(value["_id"])
        return value

    def find_one(self, collection: str, query: dict[str, Any]) -> dict | None:
        return self._clean(self._db[collection].find_one(query))

    def find_many(
        self,
        collection: str,
        query: dict[str, Any] | None = None,
        *,
        sort: SortSpec | None = None,
        limit: int = 0,
    ) -> list[dict]:
        cursor = self._db[collection].find(query or {})
        if sort:
            cursor = cursor.sort(sort)
        if limit:
            cursor = cursor.limit(limit)
        return [self._clean(document) for document in cursor]

    def insert_one(self, collection: str, document: dict[str, Any]) -> str:
        result = self._db[collection].insert_one(deepcopy(document))
        return str(result.inserted_id)

    def replace_one(
        self,
        collection: str,
        query: dict[str, Any],
        document: dict[str, Any],
        *,
        upsert: bool = False,
    ) -> str | None:
        saved = deepcopy(document)
        saved.pop("_id", None)
        result = self._db[collection].replace_one(query, saved, upsert=upsert)
        return str(result.upserted_id) if result.upserted_id else None

    def delete_many(self, collection: str, query: dict[str, Any]) -> int:
        return self._db[collection].delete_many(query).deleted_count


_store: DocumentStore | None = None


def build_store() -> DocumentStore:
    from config import (
        DATA_BACKEND,
        MONGODB_CONNECT_TIMEOUT_MS,
        MONGODB_DATABASE,
        MONGODB_URI,
    )

    if DATA_BACKEND == "memory":
        return MemoryStore()
    if DATA_BACKEND != "mongodb":
        raise RuntimeError("DATA_BACKEND는 mongodb 또는 memory여야 합니다.")
    return MongoStore(MONGODB_URI, MONGODB_DATABASE, MONGODB_CONNECT_TIMEOUT_MS)


def get_store() -> DocumentStore:
    global _store
    if _store is None:
        _store = build_store()
    return _store


def set_store(store: DocumentStore | None) -> None:
    """자동 테스트에서 저장소를 교체한다."""
    global _store
    _store = store
