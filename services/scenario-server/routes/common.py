from __future__ import annotations

import logging

from fastapi import status
from fastapi.responses import JSONResponse

from data.app_repository import NotFoundError
from play.errors import PlayError


logger = logging.getLogger(__name__)


def ok(data, message: str = "") -> dict:
    return {"status": "ok", "data": data, "message": message}


def error(message: str, status_code: int, code: str = "REQUEST_FAILED") -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "error",
            "data": None,
            "message": message,
            "error_code": code,
        },
    )


def handled_error(exc: Exception) -> JSONResponse:
    if isinstance(exc, PlayError):
        return error(exc.message, exc.status_code, exc.code)
    if isinstance(exc, NotFoundError):
        return error(str(exc), status.HTTP_404_NOT_FOUND, "NOT_FOUND")
    logger.exception("시나리오 실행 API 오류")
    return error(
        "요청 처리 중 서버 오류가 발생했습니다.",
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
    )
