"""시나리오 턴 채점 API."""
from __future__ import annotations

from dataclasses import asdict
import json
import logging

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from data import repository as repo
from data.models import Action, Holding, QuestionAnswer, UserDecision
from scoring import engine


logger = logging.getLogger(__name__)
router = APIRouter()


class HoldingIn(BaseModel):
    asset_id: str = Field(min_length=1)
    action: str
    weight_pct: int = Field(ge=0, le=100)


class AnswerIn(BaseModel):
    question_id: str = Field(min_length=1)
    selected: list[str] = Field(default_factory=list)
    text: str = ""


class DecisionIn(BaseModel):
    holdings: list[HoldingIn] = Field(default_factory=list)
    cash_pct: int = Field(default=0, ge=0, le=100)
    answers: list[AnswerIn] = Field(default_factory=list)


def ok(data):
    return {
        "status": "ok",
        "data": data,
        "message": "",
    }


def error(message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "error",
            "data": None,
            "message": message,
        },
    )


@router.post("/scenario/{sid}/turn/{tno}/score")
def score(sid: str, tno: int, body: DecisionIn):
    # 1. 서버에 저장된 턴 기준표 조회
    try:
        rubric = repo.get_rubric(sid, tno)
    except FileNotFoundError:
        return error(
            f"시나리오/턴을 찾을 수 없습니다: {sid} turn {tno}",
            status.HTTP_404_NOT_FOUND,
        )
    except (OSError, json.JSONDecodeError):
        logger.exception(
            "턴 기준표 조회 실패: scenario=%s, turn=%s",
            sid,
            tno,
        )
        return error(
            "채점 데이터를 불러오지 못했습니다.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # 2. API 입력을 채점 엔진의 입력 타입으로 변환
    try:
        decision = UserDecision(
            scenario_id=sid,
            turn_no=tno,
            holdings=[
                Holding(
                    asset_id=holding.asset_id,
                    action=Action(holding.action),
                    weight_pct=holding.weight_pct,
                )
                for holding in body.holdings
            ],
            cash_pct=body.cash_pct,
            answers=[
                QuestionAnswer(
                    question_id=answer.question_id,
                    selected=answer.selected,
                    text=answer.text,
                )
                for answer in body.answers
            ],
        )
    except ValueError:
        allowed_actions = ", ".join(action.value for action in Action)
        return error(
            f"action은 다음 값 중 하나여야 합니다: {allowed_actions}",
            status.HTTP_400_BAD_REQUEST,
        )

    # 3. 채점 및 응답 변환
    try:
        card = engine.score_turn(decision, rubric)
        return ok(asdict(card))
    except Exception:
        # 예외 내용이나 사용자 입력은 응답에 노출하지 않는다.
        logger.exception(
            "턴 채점 실패: scenario=%s, turn=%s",
            sid,
            tno,
        )
        return error(
            "채점 중 일시적인 오류가 발생했습니다.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
