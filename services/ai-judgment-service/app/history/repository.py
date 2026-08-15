from app.db.mongo import get_database

COLLECTION = "judgment_history"


async def get_latest_judgment(symbol: str) -> dict | None:
    db = get_database()
    return await db[COLLECTION].find_one({"symbol": symbol}, sort=[("time", -1)])


async def save_judgment(doc: dict) -> None:
    db = get_database()
    await db[COLLECTION].insert_one(doc)


async def get_history(symbol: str, limit: int = 20) -> list[dict]:
    db = get_database()
    cursor = db[COLLECTION].find({"symbol": symbol}).sort("time", -1).limit(limit)
    return [doc async for doc in cursor]
