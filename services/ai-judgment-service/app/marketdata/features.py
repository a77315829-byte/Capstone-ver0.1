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


def compute_volume_ratio(volumes: list[float]) -> float:
    """당일 거래량이 그 이전 평균 거래량의 몇 배인지. volumes는 오래된 날짜 -> 최신
    날짜 순, 마지막 원소가 오늘. 최소 2개(과거 1일 이상 + 오늘) 필요."""
    if len(volumes) < 2:
        raise ValueError(f"거래량 비율 계산에는 2개 이상 필요 (받은 개수: {len(volumes)})")

    today, history = volumes[-1], volumes[:-1]
    avg = sum(history) / len(history)
    return round(today / avg, 2) if avg else 0.0


def compute_ma_cross(closes: list[float], short: int = 5, long: int = 20) -> dict:
    """카탈로그 규칙(golden_cross/dead_cross) 구현: 어제는 단기 이동평균이 장기
    이동평균 위/아래에 있다가 오늘 반대로 뒤집혔는지 판정한다. closes는 오래된
    날짜 -> 최신 날짜 순, 장기 이동평균 계산 + 어제/오늘 비교를 위해 최소
    long+1개 필요. ma_gap_pct는 오늘 기준 단기-장기 이동평균 괴리율(%).
    """
    if len(closes) < long + 1:
        raise ValueError(f"이동평균 교차 계산에는 종가 {long + 1}개 이상 필요 (받은 개수: {len(closes)})")

    def ma(values: list[float], period: int) -> float:
        return sum(values[-period:]) / period

    prev_short, prev_long = ma(closes[:-1], short), ma(closes[:-1], long)
    cur_short, cur_long = ma(closes, short), ma(closes, long)

    return {
        "golden_cross": prev_short <= prev_long and cur_short > cur_long,
        "dead_cross": prev_short >= prev_long and cur_short < cur_long,
        "ma_gap_pct": round((cur_short - cur_long) / cur_long * 100, 2) if cur_long else 0.0,
    }


def compute_52w_extreme(closes: list[float]) -> dict:
    """카탈로그 규칙(week52_high/week52_low) 구현: 오늘 종가가 그 이전 기간의
    최고가/최저가를 갱신했는지 판정한다. closes는 오래된 날짜 -> 최신 날짜 순
    (호출 측에서 최근 52주 범위로 슬라이싱해 넘겨야 한다), 최소 2개 필요.
    week52_distance_pct는 갱신폭(%) - 신고가면 이전 최고가 대비, 신저가면
    이전 최저가 대비 얼마나 더 뻗어나갔는지를 나타낸다.
    """
    if len(closes) < 2:
        raise ValueError(f"52주 신고가/신저가 계산에는 종가 2개 이상 필요 (받은 개수: {len(closes)})")

    today, history = closes[-1], closes[:-1]
    prev_high, prev_low = max(history), min(history)

    is_high, is_low = today >= prev_high, today <= prev_low
    distance_pct = 0.0
    if is_high and prev_high:
        distance_pct = (today - prev_high) / prev_high * 100
    elif is_low and prev_low:
        distance_pct = (prev_low - today) / prev_low * 100

    return {
        "week52_high": is_high,
        "week52_low": is_low,
        "week52_distance_pct": round(distance_pct, 2),
    }
