"""KIS 원시 시세를 resolver.py가 기대하는 파생 피처로 변환한다. 순수 함수 -
네트워크 호출이 없어 결정론적으로 테스트 가능하다.
"""


def compute_rsi_14(closes: list[float]) -> float:
    """Wilder's RSI(14). closes는 오래된 날짜 -> 최신 날짜 순, 최소 15개 필요
    (14개의 등락폭을 만들려면 종가 15개가 있어야 한다)."""
    if len(closes) < 15:
        raise ValueError(f"RSI-14 계산에는 종가 15개 이상 필요 (받은 개수: {len(closes)})")

    gains, losses = [], []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0.0))
        losses.append(max(-diff, 0.0))

    period = 14
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def detect_foreign_flow_flip(daily_net_buys: list[float]) -> dict:
    """카탈로그 규칙(foreign_sell_flip/foreign_buy_flip) 그대로 구현:
    직전 3일 연속 동일 부호였다가 오늘(마지막 값) 반대 부호로 전환됐는지 판정한다.
    daily_net_buys는 오래된 날짜 -> 최신 날짜 순, 마지막 원소가 오늘.

    resolver.py가 그대로 소비하는 두 키를 직접 만든다 - event_listener.py의 트리거
    판정(단순 전일 대비)과는 별개의, factor 발동을 위한 진짜 판정 로직이다.
    """
    result = {"foreign_net_flow_flipped_negative": False, "foreign_net_flow_flipped_positive": False}
    if len(daily_net_buys) < 4:
        return result

    prev_three, today = daily_net_buys[-4:-1], daily_net_buys[-1]
    if all(v > 0 for v in prev_three) and today < 0:
        result["foreign_net_flow_flipped_negative"] = True
    if all(v < 0 for v in prev_three) and today > 0:
        result["foreign_net_flow_flipped_positive"] = True
    return result
