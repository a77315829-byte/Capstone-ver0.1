"""가중치 결과를 매수/매도/관망 3-way 확률로 변환한다. LLM은 개입하지 않는다 -
전부 결정론적 계산.

Takagi-Sugeno-Kang(TSK) 퍼지 추론 방식을 따른다 (Takagi & Sugeno 1985,
"Fuzzy identification of systems and its applications to modeling and
control", IEEE Trans. SMC; Sugeno & Kang 1988, "Structure identification of
fuzzy model", Fuzzy Sets and Systems). 규칙마다 결론부가 퍼지 집합인
Mamdani식과 달리, TSK는 결론부가 crisp한 값(0차) 또는 입력의 선형함수(1차)이고
최종 출력은 규칙별 발동강도로 가중평균한 값이다.

이 서비스의 규칙 매핑:
  - 각 요인(resolver.py가 판정한 ResolvedFactor)이 TSK 규칙 하나에 대응한다.
  - 발동강도(w_i) = raw_strength (조건이 얼마나 강하게 충족됐는지, 0~1)
  - 결론값(y_i) = 방향(긍정/부정)으로 정해지는 crisp 점수
    (rubric.py가 이미 w_i*y_i 곱을 weight로 계산해뒀다)
  - 여기에 "관망" 규칙을 하나 추가한다: 항상 고정된 발동강도(fuzzy_hold_baseline)로
    발동하고 결론값은 0 - 즉 아무 요인도 없으면 관망이 그대로 가장 우세해지고,
    매수/매도 요인이 강할수록 가중평균에서 관망의 상대적 비중이 자연히 옅어진다.

net = Σ(w_i·y_i) / Σ(w_i)
    = (Σ긍정weight - Σ부정weight) / (Σraw_strength + fuzzy_hold_baseline)

net은 (-100, 100) 사이로 자연스럽게 유계(bounded)이다. 이 net으로부터 3-way
확률을 뽑아내는 마지막 단계에서, 예전에는 매수=max(0,net) / 매도=max(0,-net)으로
하드 클리핑해 net의 부호에 따라 둘 중 하나가 항상 정확히 0%가 됐다. 이 세 값을
그대로 다시 raw score로 삼아 softmax에 통과시키면, 우세하지 않은 쪽도 항상 0이
아닌 연속적인 확률을 갖게 되면서 net이 매기는 상대적 우열 순서는 그대로 보존된다.
"""
import math

from app.config import settings


def _softmax(scores: dict[str, float], temperature: float) -> dict[str, float]:
    scaled = {key: value / temperature for key, value in scores.items()}
    peak = max(scaled.values())  # overflow 방지용 shift, softmax 결과에는 영향 없음
    exp_scores = {key: math.exp(value - peak) for key, value in scaled.items()}
    total = sum(exp_scores.values())
    return {key: value / total for key, value in exp_scores.items()}


def _round_to_100(fractions: dict[str, float]) -> dict[str, float]:
    """0~1 비율(합계 1.0)을 소수 1자리 %로 반올림하되, 항목별로 따로 반올림하면
    세 값의 합이 100.0에서 ±0.1 어긋날 수 있어 최대잉여법(largest remainder
    method)으로 배분해 합을 정확히 100.0으로 맞춘다."""
    tenths = {key: value * 1000 for key, value in fractions.items()}
    floors = {key: int(value // 1) for key, value in tenths.items()}
    remainder = 1000 - sum(floors.values())
    order = sorted(tenths, key=lambda key: tenths[key] - floors[key], reverse=True)
    for key in order[:remainder]:
        floors[key] += 1
    return {key: value / 10 for key, value in floors.items()}


def compute_judgment(weighted_factors: list[dict]) -> dict:
    buy_degree = sum(w["weight"] for w in weighted_factors if w["direction"] == "긍정")
    sell_degree = sum(w["weight"] for w in weighted_factors if w["direction"] == "부정")
    total_firing = sum(w["raw_strength"] for w in weighted_factors) + settings.fuzzy_hold_baseline

    net = 0.0 if total_firing <= 0 else (buy_degree - sell_degree) / total_firing

    raw_scores = {
        "매수": max(0.0, net),
        "매도": max(0.0, -net),
        "관망": 100 - abs(net),
    }
    fractions = _softmax(raw_scores, settings.softmax_temperature)
    probabilities = _round_to_100(fractions)

    judge = max(probabilities, key=probabilities.get)
    return {"judge": judge, "confidence": probabilities[judge], "probabilities": probabilities}
