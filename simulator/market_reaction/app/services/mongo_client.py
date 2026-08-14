"""MongoDB 연결 (server/src/utils/db.ts 와 같은 Atlas 클러스터/DB, market_reaction 전용
컬렉션에만 접근).

Motor 는 deprecated/EOL 상태라 쓰지 않고, PyMongo 4.9+ 의 Async API(`AsyncMongoClient`)를
쓴다. 연결은 최초 get_database() 호출 시점에 lazy 하게 만든다 — 이 모듈을 import 하는 것만으로는
(예: 오프라인 테스트에서) 설정 값이 비어 있어도 실패하지 않는다.
"""

from __future__ import annotations

from urllib.parse import quote_plus

from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from ..config import settings


class MongoConfigError(Exception):
    """Mongo 연결에 필요한 설정 값(STOTRA_MONGODB_* / MONGO_DB_NAME)이 비어 있음."""


_client: AsyncMongoClient | None = None


def _build_uri() -> str:
    username = settings.stotra_mongodb_username
    password = settings.stotra_mongodb_password
    cluster = settings.stotra_mongodb_cluster
    if not username or not password or not cluster:
        raise MongoConfigError(
            "STOTRA_MONGODB_USERNAME / STOTRA_MONGODB_PASSWORD / STOTRA_MONGODB_CLUSTER 가 "
            "설정되지 않았습니다."
        )
    return (
        f"mongodb+srv://{quote_plus(username)}:{quote_plus(password)}"
        f"@{cluster}/?authMechanism=DEFAULT&retryWrites=true&w=majority"
    )


def get_database() -> AsyncDatabase:
    """market_reaction 이 쓸 MongoDB 데이터베이스 핸들을 반환한다(연결은 lazy, 프로세스 내 재사용)."""
    global _client
    if not settings.mongo_db_name:
        raise MongoConfigError("MONGO_DB_NAME 이 설정되지 않았습니다.")
    if _client is None:
        _client = AsyncMongoClient(_build_uri())
    return _client[settings.mongo_db_name]
