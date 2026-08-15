"""Gemini JSON 호출 공통 모듈.

- 지정된 모델을 앞에서부터 한 번씩 시도한다.
- API 오류, 타임아웃, 빈 응답, JSON 오류가 발생하면 다음 모델로 넘어간다.
- 모든 모델이 실패해도 예외를 호출부로 던지지 않는다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import json
import logging
from typing import Any, Iterable

import config


logger = logging.getLogger(__name__)


@dataclass
class GeminiResult:
    ok: bool
    data: dict[str, Any] | None = None
    model: str = ""
    error_code: str = ""
    attempted_models: list[str] = field(default_factory=list)


def _extract_json(raw: str) -> dict[str, Any]:
    """코드 블록이나 앞뒤 설명이 섞인 응답에서 JSON 객체만 추출한다."""
    text = (raw or "").strip()
    if not text:
        raise ValueError("EMPTY_RESPONSE")

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("JSON_OBJECT_NOT_FOUND")

    data = json.loads(text[start:end + 1])
    if not isinstance(data, dict):
        raise ValueError("JSON_ROOT_NOT_OBJECT")
    return data


def generate_json(
    prompt: str,
    models: Iterable[str],
    *,
    temperature: float = 0,
    required_keys: Iterable[str] = (),
) -> GeminiResult:
    """모델들을 순서대로 호출해 처음으로 유효한 JSON을 반환한다."""
    model_names = [name.strip() for name in models if name and name.strip()]

    if not prompt or not prompt.strip():
        return GeminiResult(ok=False, error_code="EMPTY_PROMPT")
    if not model_names:
        return GeminiResult(ok=False, error_code="NO_MODELS_CONFIGURED")
    if not config.GEMINI_API_KEY:
        return GeminiResult(ok=False, error_code="MISSING_API_KEY")

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return GeminiResult(ok=False, error_code="MISSING_SDK")

    required = set(required_keys)


    required = set(required_keys)
    attempted: list[str] = []

    for model_name in model_names:
        attempted.append(model_name)
        try:
            with genai.Client(
                    api_key=config.GEMINI_API_KEY,
                    http_options=types.HttpOptions(
                        timeout=int(config.LLM_TIMEOUT_SECONDS * 1000),
                    ),
            ) as client:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=temperature,
                        response_mime_type="application/json",
                    ),
                )

            data = _extract_json(getattr(response, "text", ""))
            missing = required - set(data)
            if missing:
                raise ValueError(f"MISSING_KEYS:{','.join(sorted(missing))}")

            return GeminiResult(
                ok=True,
                data=data,
                model=model_name,
                attempted_models=attempted,
            )
        except Exception as exc:
            # 프롬프트나 API 키 등 민감한 값은 로그에 남기지 않는다.
            logger.warning(
                "Gemini 호출 실패: model=%s, error=%s",
                model_name,
                type(exc).__name__,
            )

    return GeminiResult(
        ok=False,
        error_code="ALL_MODELS_FAILED",
        attempted_models=attempted,
    )
