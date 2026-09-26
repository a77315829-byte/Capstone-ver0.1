"""Compare completed attempts without changing scores or treating absence as mastery."""
from __future__ import annotations

from datetime import datetime, timezone
from math import isfinite

from data.app_repository import AppRepository, NotFoundError


METRICS = ("M1", "M2", "M3", "M4", "M5")
SNAPSHOT_PATTERNS = {"LOW_CASH_BUFFER", "OVER_CONCENTRATION"}


def _completed_at(evaluation: dict) -> datetime:
    try:
        value = datetime.fromisoformat(evaluation["completed_at"].replace("Z", "+00:00"))
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    except (AttributeError, KeyError, TypeError, ValueError):
        return datetime.min.replace(tzinfo=timezone.utc)


def _sort_key(evaluation: dict) -> tuple:
    return (_completed_at(evaluation), str(evaluation.get("evaluation_id", "")))


def _valid_score(value) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and isfinite(value)
        and 0 <= value <= 5
    )


def _has_complete_evidence(
    evaluation: dict, expected_turns: list[int], *, require_snapshots: bool
) -> bool:
    decision = evaluation.get("decision_evaluation", {})
    timeline = decision.get("timeline", [])
    if not isinstance(timeline, list) or any(
        not isinstance(item, dict) or not isinstance(item.get("turn_no"), int)
        for item in timeline
    ):
        return False
    if not expected_turns or sorted(item["turn_no"] for item in timeline) != expected_turns:
        return False
    if not _valid_score(decision.get("overall_score")):
        return False
    if any(not _valid_score(decision.get("metric_averages", {}).get(metric)) for metric in METRICS):
        return False
    if any(not _valid_score(item.get("metrics", {}).get(metric)) for item in timeline for metric in METRICS):
        return False
    if not isinstance(evaluation.get("behavior_patterns"), list):
        return False
    coverage = evaluation.get("evaluation_coverage", {})
    if coverage and coverage.get("evaluator_versions") != [evaluation.get("evaluator_version")]:
        return False
    if require_snapshots and sorted(coverage.get("snapshot_turns", [])) != expected_turns:
        return False
    for pattern in evaluation["behavior_patterns"]:
        turns = pattern.get("evidence_turns", [])
        if not pattern.get("pattern_code") or not turns or not set(turns).issubset(expected_turns):
            return False
        if pattern.get("occurrence_count") != len(set(turns)):
            return False
    return True


def compare_attempts(current: dict, previous: dict | None, attempt_no: int, expected_turns: list[int]) -> dict:
    """Only the immediately previous attempt under the same evaluation rules is comparable."""
    progress = {
        "comparison_version": "repeat-attempt-v1",
        "attempt_no": attempt_no,
        "status": "FIRST_ATTEMPT",
        "previous_evaluation_id": previous.get("evaluation_id") if previous else None,
        "previous_completed_at": previous.get("completed_at") if previous else None,
        "score_delta": None,
        "score_delta_pct_points": None,
        "metric_changes": [],
        "repeated_patterns": [],
        "improved_patterns": [],
        "new_patterns": [],
        "summary": "첫 완료 기록입니다. 같은 시나리오를 다시 완료하면 이전 시도와 비교합니다.",
    }
    if previous is None:
        return progress
    versions = ("scenario_version", "evaluator_version")
    if any(
        not str(item.get(key) or "").strip()
        or str(item.get(key)).strip().upper() == "UNKNOWN"
        for item in (current, previous) for key in versions
    ):
        progress.update(status="INSUFFICIENT_DATA", summary="이전 기록의 평가 버전 정보가 없어 변화를 비교할 수 없습니다.")
        return progress
    if any(current[key] != previous[key] for key in versions):
        progress.update(status="VERSION_MISMATCH", summary="이전 시도와 시나리오 또는 채점 기준 버전이 달라 점수와 반복 행동을 직접 비교하지 않습니다.")
        return progress
    if any(_completed_at(item) == datetime.min.replace(tzinfo=timezone.utc) for item in (previous, current)):
        progress.update(status="INSUFFICIENT_DATA", summary="완료 시각 정보가 없어 시도 순서와 변화를 비교할 수 없습니다.")
        return progress
    require_snapshots = any(
        pattern.get("pattern_code") in SNAPSHOT_PATTERNS
        for item in (previous, current) for pattern in (item.get("behavior_patterns") or [])
    )
    if not all(
        _has_complete_evidence(item, expected_turns, require_snapshots=require_snapshots)
        for item in (previous, current)
    ):
        progress.update(status="INSUFFICIENT_DATA", summary="비교에 필요한 전체 턴 점수 또는 행동 근거가 부족합니다.")
        return progress

    before = previous["decision_evaluation"]
    after = current["decision_evaluation"]
    delta = round(after["overall_score"] - before["overall_score"], 2)
    progress.update(status="COMPARABLE", score_delta=delta, score_delta_pct_points=round(delta * 20, 2))
    progress["metric_changes"] = [
        {
            "metric": metric,
            "previous_score": before["metric_averages"][metric],
            "current_score": after["metric_averages"][metric],
            "delta": round(after["metric_averages"][metric] - before["metric_averages"][metric], 2),
        }
        for metric in METRICS
    ]
    old_patterns = {item["pattern_code"]: item for item in previous["behavior_patterns"]}
    new_patterns = {item["pattern_code"]: item for item in current["behavior_patterns"]}
    for code in sorted(old_patterns.keys() | new_patterns.keys()):
        old, new = old_patterns.get(code, {}), new_patterns.get(code, {})
        old_count, new_count = old.get("occurrence_count", 0), new.get("occurrence_count", 0)
        source = new or old
        change = {
            "pattern_code": code,
            "label": source.get("label", code),
            "previous_occurrence_count": old_count,
            "current_occurrence_count": new_count,
            "previous_evidence_turns": old.get("evidence_turns", []),
            "current_evidence_turns": new.get("evidence_turns", []),
            "recommendation": source.get("recommendation", ""),
        }
        if old_count and new_count:
            progress["repeated_patterns"].append(change)
        if new_count < old_count:
            progress["improved_patterns"].append(change)
        if new_count and not old_count:
            progress["new_patterns"].append(change)
    progress["summary"] = (
        f"같은 시나리오의 직전 시도 대비 판단 점수 {delta:+.2f}/5점. "
        f"다시 관찰된 행동 {len(progress['repeated_patterns'])}개, "
        f"관찰 횟수가 줄어든 행동 {len(progress['improved_patterns'])}개입니다. "
        "행동 횟수 감소는 이번 시도의 관찰 결과이며, 학습 숙달이나 실제 투자 성과를 보장하지 않습니다."
    )
    return progress


def enrich_learning_history(repository: AppRepository, evaluations: list[dict]) -> list[dict]:
    """Read-time enrichment supports existing records without rewriting their saved results.

    Results retain their input order. History is grouped by both user and scenario,
    and duplicate records for one session cannot inflate the attempt count.
    """
    histories: dict[tuple, list[dict]] = {}
    expected_turns: dict[tuple, list[int]] = {}
    progress_by_id: dict[str, dict] = {}
    seen_sessions: dict[tuple, dict] = {}
    for item in sorted(evaluations, key=_sort_key):
        group = (item.get("user_id"), item.get("scenario_id"))
        session_key = (*group, item.get("session_id") or item["evaluation_id"])
        if session_key in seen_sessions:
            progress_by_id[item["evaluation_id"]] = seen_sessions[session_key]
            continue
        history = histories.setdefault(group, [])
        scenario_key = (item.get("scenario_id"), item.get("scenario_version"))
        if scenario_key not in expected_turns:
            try:
                scenario = repository.get_scenario(*scenario_key)
                expected_turns[scenario_key] = sorted(turn["turn_no"] for turn in scenario["turn_schedule"])
            except NotFoundError:
                expected_turns[scenario_key] = []
        progress = compare_attempts(item, history[-1] if history else None, len(history) + 1, expected_turns[scenario_key])
        progress_by_id[item["evaluation_id"]] = progress
        seen_sessions[session_key] = progress
        history.append(item)
    return [{**item, "learning_progress": progress_by_id[item["evaluation_id"]]} for item in evaluations]


def enrich_evaluation(repository: AppRepository, evaluation: dict) -> dict:
    history = [
        item for item in repository.list_user_evaluations(evaluation["user_id"])
        if item["evaluation_id"] != evaluation["evaluation_id"]
    ]
    return enrich_learning_history(repository, [*history, evaluation])[-1]
