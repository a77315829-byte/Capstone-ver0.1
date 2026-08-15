"""사용자별 시나리오 평가와 누적 투자 습관 API."""
from __future__ import annotations

from fastapi import APIRouter

from data.app_repository import AppRepository, NotFoundError
from routes.common import handled_error, ok


router = APIRouter(prefix="/api/users", tags=["mypage"])


@router.get("/{user_id}/evaluations")
def list_evaluations(user_id: str):
    try:
        repository = AppRepository()
        values = repository.list_user_evaluations(user_id)
        summaries = [
            {
                "evaluation_id": item["evaluation_id"],
                "session_id": item["session_id"],
                "scenario_id": item["scenario_id"],
                "scenario_version": item["scenario_version"],
                "completed_at": item["completed_at"],
                "overall_score": item.get("decision_evaluation", {}).get("overall_score"),
                "cumulative_return_pct": item.get("portfolio_analysis", {}).get("cumulative_return_pct"),
                "summary": item.get("feedback", {}).get("summary", ""),
                "repeated_patterns": [
                    pattern["label"]
                    for pattern in item.get("behavior_patterns", [])
                    if pattern.get("classification") == "REPEATED_PATTERN"
                ],
            }
            for item in values
        ]
        return ok(summaries)
    except Exception as exc:
        return handled_error(exc)


@router.get("/{user_id}/evaluations/{evaluation_id}")
def get_evaluation(user_id: str, evaluation_id: str):
    try:
        value = AppRepository().get_scenario_evaluation(evaluation_id)
        if value.get("user_id") != user_id:
            raise NotFoundError("종합평가를 찾을 수 없습니다.")
        return ok(value)
    except Exception as exc:
        return handled_error(exc)


@router.get("/{user_id}/behavior-profile")
def get_behavior_profile(user_id: str):
    try:
        value = AppRepository().get_user_profile(user_id)
        if value is None:
            value = {
                "schema_version": 1,
                "user_id": user_id,
                "completed_scenario_count": 0,
                "dimension_averages": {},
                "pattern_statistics": [],
                "portfolio_tendencies": {},
                "updated_at": None,
            }
        return ok(value)
    except Exception as exc:
        return handled_error(exc)
