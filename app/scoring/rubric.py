"""마스터 루브릭: 요인 타입별 기본 가중치와 동적 조정 로직.
LLM은 개입하지 않는다 - 전부 결정론적 계산.
"""
from app.config import settings
from app.factors.resolver import ResolvedFactor

# 요인 타입별 기본 가중치 (직접요인이 간접요인보다 판단에 더 크게 반영) - 값은 config에서 관리
BASE_TYPE_WEIGHT = {"직접": settings.direct_factor_weight, "간접": settings.indirect_factor_weight}

# raw_score의 이론적 최댓값 (raw_strength=1.0인 요인이 도달 가능한 최댓값).
# 이번 실행에서 발생한 요인들 중 최댓값이 아니라 이 절대 기준으로 정규화해야,
# 간접요인만 발생한 경우에도 BASE_TYPE_WEIGHT의 직접/간접 discount가 유지된다.
# (배치 내 최댓값 기준으로 정규화하면 간접요인만 있을 때 discount가 사라져
#  간접요인 혼자서도 100%까지 도달해버리는 문제가 있었다.)
_MAX_RAW_SCORE = max(BASE_TYPE_WEIGHT.values())


def compute_weights(resolved_factors: list[ResolvedFactor]) -> list[dict]:
    """각 요인의 최종 가중치(0~100)를 계산한다."""
    weighted = []
    for f in resolved_factors:
        raw_score = BASE_TYPE_WEIGHT[f.type] * f.raw_strength
        pct = round((raw_score / _MAX_RAW_SCORE) * 100, 1)
        weighted.append({
            "type": f.type,
            "direction": f.direction,
            "factor": f.description,
            "weight": pct,
        })
    return sorted(weighted, key=lambda w: -w["weight"])
