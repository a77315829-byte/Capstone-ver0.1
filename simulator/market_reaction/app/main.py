"""market-reaction FastAPI 엔트리포인트.

현재 단계는 서비스 골격 + /health 만 제공한다.
/simulate, LLM 호출, service 파이프라인은 이후 단계에서 추가한다.
"""

from __future__ import annotations

import httpx
from fastapi import FastAPI

from .config import settings

SERVICE_NAME = "market-reaction"
SERVICE_VERSION = "0.1.0"

app = FastAPI(title=SERVICE_NAME, version=SERVICE_VERSION)

# /health 의 Ollama 확인은 빠르게 끝나야 하므로 짧은 timeout 사용
_HEALTH_OLLAMA_TIMEOUT = 2.0


async def _check_ollama() -> str:
    """Ollama 연결 여부만 확인. 실패해도 예외를 던지지 않는다."""
    try:
        async with httpx.AsyncClient(timeout=_HEALTH_OLLAMA_TIMEOUT) as client:
            resp = await client.get(f"{settings.ollama_host}/api/tags")
        return "connected" if resp.status_code == 200 else "disconnected"
    except Exception:
        return "disconnected"


@app.get("/health")
async def health() -> dict:
    """서비스 헬스체크.

    Ollama 가 꺼져 있어도 service status 는 항상 "ok" 로 HTTP 200 을 반환한다.
    """
    ollama_status = await _check_ollama()
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "ollama": ollama_status,
        "model": settings.ollama_model,
    }
