import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import judgment, compare, history
from app.config import settings
from app.marketdata.poller import run_polling_loop
from app.news.poller import run_news_polling_loop

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="AI 판단 서비스")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(judgment.router)
app.include_router(compare.router)
app.include_router(history.router)


@app.on_event("startup")
async def start_kis_polling():
    # kis_app_key가 없는 환경(테스트 등)에서는 폴링을 아예 켜지 않는다.
    if not settings.kis_app_key:
        return
    asyncio.create_task(run_polling_loop(settings.watch_symbols, settings.poll_interval_sec))


@app.on_event("startup")
async def start_news_polling():
    if not settings.newsapi_api_key:
        return
    asyncio.create_task(run_news_polling_loop(settings.watch_symbols, settings.news_poll_interval_sec))


@app.get("/health")
async def health():
    return {"status": "ok"}

