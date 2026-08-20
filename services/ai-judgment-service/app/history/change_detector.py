from app.config import settings


def detect_change(previous: dict | None, new_judge: str, new_probabilities: dict[str, float]) -> bool:
    """대표 판단 라벨이 바뀌었거나, 라벨은 같아도 확률이 judge_change_threshold_pct
    포인트 이상 움직였으면 '변경'으로 본다 (라벨만 보면 관망 51%->관망 90% 같은
    큰 변화를 놓친다)."""
    if previous is None:
        return True
    if previous.get("judge") != new_judge:
        return True

    prev_probabilities = previous.get("probabilities") or {}
    return any(
        abs(prev_probabilities.get(label, 0.0) - value) >= settings.judge_change_threshold_pct
        for label, value in new_probabilities.items()
    )
