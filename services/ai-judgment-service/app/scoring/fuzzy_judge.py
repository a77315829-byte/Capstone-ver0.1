"""가중치 결과를 매수/매도/관망 3-way 확률로 변환한다. LLM은 개입하지 않는다 -
전부 결정론적 계산.

Takagi-Sugeno-Kang(TSK) 퍼지 추론 방식을 따른다 (Takagi & Sugeno 1985,
"Fuzzy identification of systems and its applications to modeling and
control", IEEE Trans. SMC; Sugeno & Kang 1988, "Structure identification of
fuzzy model", Fuzzy Sets and Systems). 규칙마다 결론부가 퍼지 집합인
Mamdani식과 달리, TSK는 결론부가 crisp한 값(0차) 또는 입력의 선형함수(1차)이고
최종 출력은 규칙별 발동강도로 가중평균한 값이다 - 별도의 비퍼지화(무게중심법)
단계 없이 가중평균 한 번으로 끝난다.

이 서비스의 규칙 매핑:
  - 각 요인(resolver.py가 판정한 ResolvedFactor)이 TSK 규칙 하나에 대응한다.
  - 발동강도(w_i) = raw_strength (조건이 얼마나 강하게 충족됐는지, 0~1)
  - 결론값(y_i) = 방향(긍정/부정)으로 정해지는 crisp 점수
    (rubric.py가 이미 w_i*y_i 곱을 weight로 계산해뒀다)
  - 여기에 "관망" 규칙을 하나 추가한다: 항상 고정된 발동강도(fuzzy_hold_baseline)로
    발동하고 결론값은 0 - 즉 아무 요인도 없으면 관망이 그대로 100%가 되고,
    매수/매도 요인이 강할수록 가중평균에서 관망의 상대적 비중이 자연히 옅어진다.

net = Σ(w_i·y_i) / Σ(w_i)
    = (Σ긍정weight - Σ부정weight) / (Σraw_strength + fuzzy_hold_baseline)

net은 (-100, 100) 사이로 자연스럽게 유계(bounded)이며(요인이 아무리 많아도
개별 결론값의 최댓값인 100을 넘지 않는다), 이 하나의 net 값으로부터 3-way
확률을 바로 뽑아낸다.
"""
from app.config import settings


def compute_judgment(weighted_factors: list[dict]) -> dict:
    buy_degree = sum(w["weight"] for w in weighted_factors if w["direction"] == "긍정")
    sell_degree = sum(w["weight"] for w in weighted_factors if w["direction"] == "부정")
    total_firing = sum(w["raw_strength"] for w in weighted_factors) + settings.fuzzy_hold_baseline

    if total_firing <= 0:
        probabilities = {"매수": 0.0, "매도": 0.0, "관망": 100.0}
    else:
        net = (buy_degree - sell_degree) / total_firing
        # max(0.0, x) 순서로 둔다 - x가 -0.0일 때 max(x, 0.0)은 파이썬에서 -0.0을
        # 그대로 반환해 확률에 "-0.0"이 찍히는 문제가 있다.
        probabilities = {
            "매수": round(max(0.0, net), 1),
            "매도": round(max(0.0, -net), 1),
            "관망": round(100 - abs(net), 1),
        }

    judge = max(probabilities, key=probabilities.get)
    return {"judge": judge, "confidence": probabilities[judge], "probabilities": probabilities}
