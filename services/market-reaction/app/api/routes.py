"""시장 반응 시뮬레이션 HTTP 라우트.

- POST /simulate : 정상 200(SimulationResponse) / 입력 부적합 422(RejectedResponse)
- POST /simulate/stream : 단계별 SSE 및 동일한 최종 SimulationResponse
- GET /simulations/{id} : 501 (stateless 서비스, 저장은 후속 Node+MongoDB 단계)

Ollama 실패는 500 이 아니라 fallback 으로 200 처리된다(service 계층 책임).
"""

from __future__ import annotations

import asyncio
import json

from anyio import CancelScope
from fastapi import APIRouter
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse

from ..schemas.request import SimulationRequest
from ..schemas.response import RejectedResponse, SimulationResponse
from ..service import SimulationRejectedError, run_market_reaction_simulation

router = APIRouter()

_STREAM_TIMEOUT_SECONDS = 110.0
_STREAM_HEARTBEAT_SECONDS = 10.0


@router.post("/simulate", response_model=SimulationResponse)
async def simulate(request: SimulationRequest):
    try:
        return await run_market_reaction_simulation(request)
    except SimulationRejectedError as exc:
        rejected = RejectedResponse(reason_code=exc.reason_code, message=exc.message)
        return JSONResponse(status_code=422, content=rejected.model_dump())


async def _simulation_events(request: SimulationRequest):
    queue = asyncio.Queue()

    async def publish(name: str, data: dict):
        queue.put_nowait((name, jsonable_encoder(data)))
        # 첫 검증 이벤트부터 실제 작업보다 먼저 소비자에게 전달한다.
        await asyncio.sleep(0)

    async def run():
        try:
            result = await asyncio.wait_for(
                run_market_reaction_simulation(request, on_event=publish),
                timeout=_STREAM_TIMEOUT_SECONDS,
            )
            await publish("result", result.model_dump(mode="json"))
        except SimulationRejectedError as exc:
            await publish("error", {
                "status": "rejected", "reason_code": exc.reason_code, "message": exc.message,
            })
        except asyncio.TimeoutError:
            await publish("error", {
                "status": "error", "reason_code": "SIMULATION_TIMEOUT",
                "message": "분석 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
            })
        except Exception:
            await publish("error", {
                "status": "error", "reason_code": "SIMULATION_FAILED",
                "message": "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
            })

    task = asyncio.create_task(run())
    try:
        while True:
            try:
                name, data = await asyncio.wait_for(queue.get(), _STREAM_HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                yield ": keep-alive\n\n"
                continue
            yield f"event: {name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
            if name in ("result", "error"):
                return
    finally:
        if not task.done():
            task.cancel()
        # StreamingResponse 의 disconnect 취소 범위에서도 하위 작업 정리를 기다린다.
        with CancelScope(shield=True):
            await asyncio.gather(task, return_exceptions=True)


@router.post("/simulate/stream")
async def simulate_stream(request: SimulationRequest):
    return StreamingResponse(
        _simulation_events(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/simulations/{simulation_id}")
async def get_simulation(simulation_id: str):
    return JSONResponse(
        status_code=501,
        content={
            "status": "not_implemented",
            "simulation_id": simulation_id,
            "message": (
                "현재 Python market_reaction 서비스는 stateless 분석 API이며, "
                "결과 저장은 후속 Node backend + MongoDB 연동 단계에서 처리합니다."
            ),
        },
    )
