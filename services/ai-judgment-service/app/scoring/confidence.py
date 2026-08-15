"""판단의 신뢰도(%)를 계산한다. 요인 수와 상위 요인 쏠림 정도를 기반으로 한다."""


def compute_confidence(weighted_factors: list[dict]) -> float:
    if not weighted_factors:
        return 0.0

    total = sum(w["weight"] for w in weighted_factors)
    top = max(w["weight"] for w in weighted_factors)
    concentration = top / total if total else 0

    base = min(len(weighted_factors) * 12, 60)
    confidence = base + concentration * 40
    return round(min(confidence, 99.0), 1)
