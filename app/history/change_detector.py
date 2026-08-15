def detect_change(previous: dict | None, new_judge: str) -> bool:
    if previous is None:
        return True
    return previous.get("judge") != new_judge
