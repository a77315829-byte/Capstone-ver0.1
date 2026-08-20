"""사용자별 시나리오 진행도, 평가와 누적 투자 습관 API."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query
from pydantic import BaseModel

from data.app_repository import AppRepository, NotFoundError
from routes.common import handled_error, ok


router = APIRouter(prefix="/api/users", tags=["mypage"])


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class QuizProgressEventIn(BaseModel):
    quiz_id: str | None = None
    is_correct: bool | None = None
    session_completed: bool = False


def _quiz_progress_summary(value: dict | None, total_quiz_count: int) -> dict:
    raw = value or {}
    answered_quiz_ids = list(
        dict.fromkeys(
            str(item)
            for item in raw.get("answered_quiz_ids", [])
            if item
        )
    )
    attempt_count = max(0, _safe_int(raw.get("attempt_count"), 0))
    correct_attempt_count = max(
        0,
        _safe_int(raw.get("correct_attempt_count"), 0),
    )
    completed_sessions = max(
        0,
        _safe_int(raw.get("completed_sessions"), 0),
    )
    total = max(0, total_quiz_count)
    answered_count = len(answered_quiz_ids)
    progress_percent = (
        min(100, round(answered_count / total * 100))
        if total > 0
        else 0
    )
    accuracy_percent = (
        round(correct_attempt_count / attempt_count * 100)
        if attempt_count > 0
        else 0
    )

    return {
        "user_id": raw.get("user_id"),
        "answered_quiz_ids": answered_quiz_ids,
        "answered_count": answered_count,
        "attempt_count": attempt_count,
        "correct_attempt_count": correct_attempt_count,
        "completed_sessions": completed_sessions,
        "total_quiz_count": total,
        "progress_percent": progress_percent,
        "accuracy_percent": accuracy_percent,
        "updated_at": raw.get("updated_at"),
    }


@router.get("/{user_id}/scenario-progress")
def get_scenario_progress(user_id: str):
    """마이페이지/시나리오 목록에서 사용할 사용자별 진행 상태를 반환한다."""
    try:
        repository = AppRepository()
        scenarios = repository.list_scenarios()
        sessions = repository.list_user_sessions(user_id)
        evaluations = repository.list_user_evaluations(user_id)

        completed_scenario_ids = {
            str(item.get("scenario_id"))
            for item in evaluations
            if item.get("scenario_id")
        }

        # list_user_sessions가 최신 순으로 반환하므로 시나리오별 첫 값이 최신 세션이다.
        latest_session_by_scenario: dict[str, dict] = {}
        for session in sessions:
            scenario_id = str(session.get("scenario_id") or "")
            if scenario_id and scenario_id not in latest_session_by_scenario:
                latest_session_by_scenario[scenario_id] = session

        items: list[dict] = []
        item_by_scenario_id: dict[str, dict] = {}

        for scenario in scenarios:
            scenario_id = str(scenario.get("scenario_id") or "")
            total_turns = max(1, _safe_int(scenario.get("total_turns"), 1))
            session = latest_session_by_scenario.get(scenario_id)
            session_status = str((session or {}).get("status") or "").upper()

            # 최신 세션이 진행 중이면 과거 완료 이력이 있어도 현재 진행 상태를 우선한다.
            is_in_progress = session_status in {"ACTIVE", "FINALIZING"}
            is_completed = (
                not is_in_progress
                and (
                    scenario_id in completed_scenario_ids
                    or session_status == "COMPLETED"
                )
            )

            if is_completed:
                status = "COMPLETED"
                current_turn = total_turns
                completed_turns = total_turns
                progress_percent = 100
            elif is_in_progress:
                status = "IN_PROGRESS"
                current_turn = min(
                    total_turns,
                    max(1, _safe_int((session or {}).get("current_turn"), 1)),
                )
                # 현재 턴에 진입했다는 의미로 화면 진행률은 current_turn/total_turns를 사용한다.
                completed_turns = max(0, current_turn - 1)
                progress_percent = round(current_turn / total_turns * 100)
            else:
                status = "NOT_STARTED"
                current_turn = 0
                completed_turns = 0
                progress_percent = 0

            item = {
                "scenario_id": scenario_id,
                "title": scenario.get("title", scenario_id),
                "status": status,
                "session_id": (session or {}).get("session_id"),
                "current_turn": current_turn,
                "total_turns": total_turns,
                "completed_turns": completed_turns,
                "progress_percent": progress_percent,
                "updated_at": (
                    (session or {}).get("updated_at")
                    or (session or {}).get("completed_at")
                    or (session or {}).get("started_at")
                ),
            }
            items.append(item)
            item_by_scenario_id[scenario_id] = item

        active_session = next(
            (
                session
                for session in sessions
                if str(session.get("status") or "").upper()
                in {"ACTIVE", "FINALIZING"}
            ),
            None,
        )
        active = None
        if active_session:
            active_id = str(active_session.get("scenario_id") or "")
            candidate = item_by_scenario_id.get(active_id)
            if candidate and candidate["status"] == "IN_PROGRESS":
                active = candidate

        total_count = len(items)
        completed_count = sum(
            1 for item in items if item["status"] == "COMPLETED"
        )
        overall_progress_percent = (
            round(
                sum(item["progress_percent"] for item in items)
                / total_count
            )
            if total_count > 0
            else 0
        )

        return ok(
            {
                "active": active,
                "completed_count": completed_count,
                "total_count": total_count,
                "overall_progress_percent": overall_progress_percent,
                "items": items,
            }
        )
    except Exception as exc:
        return handled_error(exc)


@router.get("/{user_id}/quiz-progress")
def get_quiz_progress(
    user_id: str,
    total_quiz_count: int = Query(default=0, ge=0),
):
    try:
        value = AppRepository().get_quiz_progress(user_id)
        summary = _quiz_progress_summary(value, total_quiz_count)
        summary["user_id"] = user_id
        return ok(summary)
    except Exception as exc:
        return handled_error(exc)


@router.post("/{user_id}/quiz-progress/events")
def record_quiz_progress_event(
    user_id: str,
    body: QuizProgressEventIn,
):
    try:
        repository = AppRepository()
        current = repository.get_quiz_progress(user_id) or {
            "schema_version": 1,
            "user_id": user_id,
            "answered_quiz_ids": [],
            "attempt_count": 0,
            "correct_attempt_count": 0,
            "completed_sessions": 0,
            "updated_at": None,
        }

        answered = list(current.get("answered_quiz_ids", []))
        answered_set = {str(item) for item in answered if item}

        if body.quiz_id:
            answered_set.add(body.quiz_id)
            current["attempt_count"] = (
                _safe_int(current.get("attempt_count"), 0) + 1
            )
            if body.is_correct is True:
                current["correct_attempt_count"] = (
                    _safe_int(
                        current.get("correct_attempt_count"),
                        0,
                    )
                    + 1
                )

        if body.session_completed:
            current["completed_sessions"] = (
                _safe_int(current.get("completed_sessions"), 0) + 1
            )

        current["schema_version"] = 1
        current["user_id"] = user_id
        current["answered_quiz_ids"] = sorted(answered_set)
        current["updated_at"] = _utc_now()

        repository.save_quiz_progress(current)
        return ok(_quiz_progress_summary(current, 0))
    except Exception as exc:
        return handled_error(exc)


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
                "overall_score": item.get("decision_evaluation", {}).get(
                    "overall_score"
                ),
                "cumulative_return_pct": item.get(
                    "portfolio_analysis", {}
                ).get("cumulative_return_pct"),
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
