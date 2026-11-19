import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import judgment, compare, history, watch
from app.config import settings
from app.db.mongo import get_database
from app.marketdata.poller import run_polling_loop
from app.tracking.refresh import refreshing_symbols, stop_refresh_tasks
from app.tracking.registry import active_symbols

logging.basicConfig(level=logging.INFO)


import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from service_security import install_service_security
app = FastAPI(title="AI 판단 서비스")
install_service_security(app)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(judgment.router)
app.include_router(compare.router)
app.include_router(history.router)
app.include_router(watch.router)
_polling_task = None


@app.on_event("startup")
async def start_kis_polling():
    global _polling_task
    # kis_app_key가 없는 환경(테스트 등)에서는 폴링을 아예 켜지 않는다.
    if not settings.kis_app_key:
        return
    _polling_task = asyncio.create_task(run_polling_loop(settings.poll_interval_sec))


@app.on_event("shutdown")
async def stop_kis_polling():
    if _polling_task is not None:
        _polling_task.cancel()
        await asyncio.gather(_polling_task, return_exceptions=True)
    await stop_refresh_tasks()


@app.get("/health")
async def health():
    async def ping_database():
        # Resolving a mongodb+srv URI can block during client construction.
        # Keep that work off the event loop and bound the whole health check.
        database = await asyncio.to_thread(get_database)
        await database.command("ping")

    try:
        await asyncio.wait_for(ping_database(), timeout=3.0)
        return {"status": "ok", "database": "connected", "monitoring": {
            "always_symbols": settings.always_watch_symbols,
            "active_symbols": active_symbols(),
            "refreshing_symbols": refreshing_symbols(),
            "poll_interval_sec": settings.poll_interval_sec,
        }}
    except Exception:
        return {"status": "degraded", "database": "unavailable", "fallback_available": True}

