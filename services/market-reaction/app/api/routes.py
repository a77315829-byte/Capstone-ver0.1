"""시장 반응 시뮬레이션 HTTP 라우트.

- POST /simulate : 정상 200(SimulationResponse) / 입력 부적합 422(RejectedResponse)
- GET /simulations/{id} : 501 (stateless 서비스, 저장은 후속 Node+MongoDB 단계)

Ollama 실패는 500 이 아니라 fallback 으로 200 처리된다(service 계층 책임).
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..schemas.request import SimulationRequest
from ..schemas.response import RejectedResponse, SimulationResponse
from ..service import SimulationRejectedError, run_market_reaction_simulation

router = APIRouter()


@router.post("/simulate", response_model=SimulationResponse)
async def simulate(request: SimulationRequest):
    try:
        return await run_market_reaction_simulation(request)
    except SimulationRejectedError as exc:
        rejected = RejectedResponse(reason_code=exc.reason_code, message=exc.message)
        return JSONResponse(status_code=422, content=rejected.model_dump())


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
