"""market-reaction FastAPI 엔트리포인트.

현재 단계는 서비스 골격 + /health 만 제공한다.
/simulate, LLM 호출, service 파이프라인은 이후 단계에서 추가한다.
"""

from __future__ import annotations

from typing import Literal

import httpx
from fastapi import FastAPI

from .api.routes import router
from .config import settings

SERVICE_NAME = "market-reaction"
SERVICE_VERSION = "0.1.0"

app = FastAPI(title=SERVICE_NAME, version=SERVICE_VERSION)
app.include_router(router)

# /health 의 Ollama 확인은 빠르게 끝나야 하므로 짧은 timeout 사용
_HEALTH_OLLAMA_TIMEOUT = 2.0

# ollama 필드 허용값(이 두 문자열 외에는 절대 반환하지 않는다)
OLLAMA_CONNECTED = "connected"
OLLAMA_DISCONNECTED = "disconnected"

OllamaStatus = Literal["connected", "disconnected"]


async def _check_ollama() -> OllamaStatus:
    """Ollama 연결 여부만 확인. 실패해도 예외를 던지지 않고 disconnected 를 반환한다."""
    try:
        async with httpx.AsyncClient(timeout=_HEALTH_OLLAMA_TIMEOUT) as client:
            resp = await client.get(f"{settings.ollama_host}/api/tags")
        if resp.status_code == 200:
            return OLLAMA_CONNECTED
        return OLLAMA_DISCONNECTED
    except Exception:
        return OLLAMA_DISCONNECTED


@app.get("/health")
async def health() -> dict:
    """서비스 헬스체크.

    - Ollama 가 꺼져 있어도 service status 는 항상 "ok" 로 HTTP 200 을 반환한다.
    - ollama 필드는 반드시 "connected" 또는 "disconnected" 중 하나다.
    - model 필드는 설정값(settings.ollama_model)을 그대로 반환한다.
    """
    ollama_status = await _check_ollama()
    # 방어적 정규화: 예기치 못한 값이 와도 두 허용값 중 하나로 고정
    if ollama_status not in (OLLAMA_CONNECTED, OLLAMA_DISCONNECTED):
        ollama_status = OLLAMA_DISCONNECTED

    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "ollama": ollama_status,
        "model": settings.ollama_model,
    }
