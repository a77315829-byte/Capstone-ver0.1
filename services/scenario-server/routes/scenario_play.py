"""시나리오 조회·세션·주문·턴 진행 API."""
from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from config import DEFAULT_USER_ID
from play.session_service import ScenarioSessionService
from routes.common import handled_error, ok


router = APIRouter(prefix="/api", tags=["scenario-play"])


class StartSessionIn(BaseModel):
    user_id: str = Field(default=DEFAULT_USER_ID, min_length=1, max_length=100)


class OrderIn(BaseModel):
    asset_id: str = Field(min_length=6, max_length=12)
    side: str = Field(pattern="^(BUY|SELL|buy|sell)$")
    quantity: int = Field(ge=1)


class AnswerIn(BaseModel):
    question_id: str = Field(min_length=1)
    selected: list[str] = Field(default_factory=list)
    text: str = ""


class SubmitTurnIn(BaseModel):
    answers: list[AnswerIn] = Field(min_length=1)


def service() -> ScenarioSessionService:
    return ScenarioSessionService()


@router.get("/scenarios")
def list_scenarios():
    try:
        return ok(service().list_scenarios())
    except Exception as exc:
        return handled_error(exc)


@router.post("/scenarios/{scenario_id}/sessions", status_code=201)
def start_session(scenario_id: str, body: StartSessionIn):
    try:
        return ok(service().start_session(body.user_id, scenario_id))
    except Exception as exc:
        return handled_error(exc)


@router.get("/sessions/{session_id}/turn")
def get_current_turn(session_id: str):
    try:
        return ok(service().get_turn_view(session_id))
    except Exception as exc:
        return handled_error(exc)


@router.get("/sessions/{session_id}/chart/{asset_id}")
def get_chart(
    session_id: str,
    asset_id: str,
    start_date: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
):
    try:
        return ok(service().get_chart(session_id, asset_id, start_date=start_date))
    except Exception as exc:
        return handled_error(exc)


@router.post("/sessions/{session_id}/orders", status_code=201)
def place_order(session_id: str, body: OrderIn):
    try:
        return ok(
            service().place_order(
                session_id,
                asset_id=body.asset_id,
                side=body.side,
                quantity=body.quantity,
            )
        )
    except Exception as exc:
        return handled_error(exc)


@router.post("/sessions/{session_id}/turn/submit")
def submit_turn(session_id: str, body: SubmitTurnIn):
    try:
        answers = [item.model_dump() for item in body.answers]
        return ok(service().submit_turn(session_id, answers))
    except Exception as exc:
        return handled_error(exc)


@router.get("/sessions/{session_id}/result")
def get_result(session_id: str):
    try:
        return ok(service().get_evaluation(session_id))
    except Exception as exc:
        return handled_error(exc)


@router.post("/sessions/{session_id}/finalize")
def finalize_session(session_id: str):
    try:
        return ok(service().finalize_session(session_id))
    except Exception as exc:
        return handled_error(exc)
