"""요인 카탈로그를 DB에 1회 시딩하는 스크립트.
실행: python -m app.db.seed_factors
"""
import asyncio
from app.db.mongo import get_database
from app.factors.catalog import get_catalog


async def seed():
    db = get_database()
    for factor in get_catalog():
        await db["factor_catalog"].update_one(
            {"factor_id": factor["factor_id"]}, {"$set": factor}, upsert=True,
        )
    print(f"{len(get_catalog())}개 요인 시딩 완료")


if __name__ == "__main__":
    asyncio.run(seed())
