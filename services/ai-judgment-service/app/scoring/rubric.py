"""마스터 루브릭: 요인의 발동강도(raw_strength)를 최종 가중치(0~100)로 바꾼다.
LLM은 개입하지 않는다 - 전부 결정론적 계산.

모든 요인을 동등한 TSK 규칙으로 다루므로(카탈로그 참고), 타입별 할인 없이
raw_strength(0~1)를 그대로 백분율로 스케일링한다.
"""
from app.factors.resolver import ResolvedFactor


def compute_weights(resolved_factors: list[ResolvedFactor]) -> list[dict]:
    """각 요인의 최종 가중치(0~100)를 계산한다.

    raw_strength도 함께 실어 보낸다 - fuzzy_judge.py가 TSK(Takagi-Sugeno-Kang)
    가중평균의 분모(Σ발동강도)를 계산하는 데 필요하다 (weight 자체는 이미
    발동강도×결론값의 곱이라 분자로 그대로 쓸 수 있다).
    """
    weighted = []
    for f in resolved_factors:
        weighted.append({
            "direction": f.direction,
            "factor": f.description,
            "weight": round(f.raw_strength * 100, 1),
            "raw_strength": f.raw_strength,
        })
    return sorted(weighted, key=lambda w: -w["weight"])
