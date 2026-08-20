from typing import TypedDict, Literal


class FactorCatalogEntry(TypedDict):
    factor_id: str
    direction: Literal["긍정", "부정"]  # 판단에 긍정적(매수)/부정적(매도) 신호인지
    feature_key: str       # 예: "foreign_net_flow", "rsi_14"
    description: str
    rule: str               # 사람이 읽는 임계치 규칙 설명


class JudgmentHistoryDoc(TypedDict):
    symbol: str
    time: str
    judge: str
    confidence: float
    probabilities: dict[str, float]  # {"매수": %, "매도": %, "관망": %}, 합계 100
    reason: str
    factors: list[dict]
    changed: bool
