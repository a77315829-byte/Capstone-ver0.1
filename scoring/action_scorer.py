"""
행동 채점기 (논문 표 2 기반).
- M4 = 사용자 행동 점수(방향/강도)가 이 턴 적정 범위 안에 있는가.
- PORTFOLIO = 배분 품질(함정주·몰빵·현금).
"""
from data.models import MetricResult, MetricId, Penalty, Action


def _action_to_score(h) -> float:
    """우리 행동(action+비중) → 논문 표 점수(+2~-3)."""
    w = h.weight_pct
    if h.action == Action.BUY:
        if w >= 40: return 2.0
        if w >= 15: return 1.0
        return 0.5
    if h.action == Action.HOLD:
        return 0.0
    if h.action == Action.PARTIAL_SELL:
        return -1.0
    if h.action == Action.SELL:
        if w >= 70: return -3.0
        if w >= 30: return -2.0
        return -1.0
    return 0.0


def score_actions(holdings, cash_pct, q36_answer, action_rule) -> tuple:
    trap_assets = action_rule.get("trap_assets", [])
    core_assets = action_rule.get("core_assets", [])
    max_single = action_rule.get("max_single_weight", 100)
    cash_min = action_rule.get("good_cash_min", 0)
    expected_range = action_rule.get("expected_action_score", [-3.0, 2.0])  # [최소, 최대]

    buys = [h for h in holdings if h.action == Action.BUY]

    # ── PORTFOLIO: 배분 품질 ──
    port_score = 5.0
    port_penalties = []
    for h in buys:
        if h.asset_id in trap_assets:
            deduct = round(2.0 * (h.weight_pct / 100) + 1.0, 2)
            port_score -= deduct
            port_penalties.append(Penalty(amount=deduct, cause="PICKED_TRAP_ASSET",
                evidence=f"함정 종목 {h.asset_id}를 {h.weight_pct}% 매수"))
        elif h.asset_id in core_assets:
            port_score += 0.3
    for h in buys:
        if h.weight_pct > max_single:
            port_score -= 1.0
            port_penalties.append(Penalty(amount=1.0, cause="OVERWEIGHT",
                evidence=f"{h.asset_id} {h.weight_pct}% 집중(적정 {max_single}% 초과)"))
    if cash_pct < cash_min:
        port_score -= 1.0
        port_penalties.append(Penalty(amount=1.0, cause="LOW_CASH",
            evidence=f"현금 {cash_pct}%로 적정({cash_min}%)보다 낮음"))
    port_score = max(1.0, min(5.0, port_score))

    # ── M4: 행동 점수가 적정 범위 안인가 (논문 방식) ──
    # 사용자의 대표 행동 점수 = 모든 holding 점수의 합(순매수/순매도 방향)
    if holdings:
        action_score = sum(_action_to_score(h) for h in holdings)
        # 여러 종목이면 평균적 방향으로 clip
        action_score = max(-3.0, min(2.0, action_score))
    else:
        action_score = 0.0  # 아무것도 안 함 = 관망

    lo, hi = expected_range
    m4_penalties = []
    if action_score < lo:
        gap = lo - action_score
        m4_score = max(1.0, 5.0 - gap * 1.5)
        m4_penalties.append(Penalty(amount=round(gap*1.5,2), cause="TOO_DEFENSIVE",
            evidence=f"행동({action_score})이 이 턴 적정({lo}~{hi})보다 과도하게 방어적/소극적"))
    elif action_score > hi:
        gap = action_score - hi
        m4_score = max(1.0, 5.0 - gap * 1.5)
        m4_penalties.append(Penalty(amount=round(gap*1.5,2), cause="TOO_AGGRESSIVE",
            evidence=f"행동({action_score})이 이 턴 적정({lo}~{hi})보다 과도하게 공격적"))
    else:
        m4_score = 5.0  # 적정 범위 안

    m4 = MetricResult(metric=MetricId.M4, score=round(m4_score, 2), penalties=m4_penalties)
    port = MetricResult(metric=MetricId.PORTFOLIO, score=round(port_score, 2), penalties=port_penalties)
    return m4, port