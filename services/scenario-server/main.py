"""Anttitude 시나리오 서버 진입점."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from routes import mypage, scenario_play, scenario_scoring
from data.store import get_store


logger = logging.getLogger(__name__)
app = FastAPI(title="Anttitude Scenario Server")


def error_response(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "error",
            "data": None,
            "message": message,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request,
    exc: RequestValidationError,
):
    fields = []

    for item in exc.errors():
        location = item.get("loc", ())
        field = ".".join(
            str(part)
            for part in location
            if part not in ("body", "path", "query")
        )

        if field and field not in fields:
            fields.append(field)

    if fields:
        message = (
            "요청 형식이 올바르지 않습니다. "
            f"확인할 항목: {', '.join(fields)}"
        )
    else:
        message = "요청 형식이 올바르지 않습니다."

    return error_response(
        message,
        status.HTTP_422_UNPROCESSABLE_ENTITY,
    )


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(
    request: Request,
    exc: StarletteHTTPException,
):
    if exc.status_code == status.HTTP_404_NOT_FOUND:
        message = "요청한 주소를 찾을 수 없습니다."
    elif isinstance(exc.detail, str):
        message = exc.detail
    else:
        message = "요청을 처리할 수 없습니다."

    return error_response(message, exc.status_code)


@app.exception_handler(Exception)
async def unexpected_error_handler(
    request: Request,
    exc: Exception,
):
    logger.exception(
        "처리되지 않은 서버 오류: method=%s, path=%s",
        request.method,
        request.url.path,
    )
    return error_response(
        "서버에서 일시적인 오류가 발생했습니다.",
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


# 개발 중에는 모든 프론트 주소에서 접근을 허용한다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scenario_scoring.router)
app.include_router(scenario_play.router)
app.include_router(mypage.router)


@app.get("/")
def health():
    database = "connected"
    try:
        get_store().ping()
    except Exception:
        database = "unavailable"
    return {
        "status": "ok",
        "data": {
            "service": "Anttitude Scenario Server",
            "state": "running",
            "database": database,
        },
        "message": "",
    }
