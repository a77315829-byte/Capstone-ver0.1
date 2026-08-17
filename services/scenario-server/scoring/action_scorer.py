"""
행동 채점기 (논문 표 2 기반).
- 행동 적합도 = 사용자 행동 점수(방향/강도)가 이 턴 적정 범위 안에 있는가.
- PORTFOLIO = 배분 품질(함정주·몰빵·현금).

최종 M4는 engine에서 자유서술-실제행동 일치, 객관식, 행동 적합도를 합쳐 계산한다.
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


def derive_action_score(holdings) -> float:
    """실제 주문에서 만든 holding 목록을 -3~+2 행동 강도로 변환한다."""
    if not holdings:
        return 0.0
    action_score = sum(_action_to_score(holding) for holding in holdings)
    return max(-3.0, min(2.0, action_score))


def score_actions(holdings, cash_pct, q36_answer, action_rule) -> tuple:
    # q36_answer는 기존 호출 계약 호환을 위해 유지한다. 객관식 M4 응답은
    # engine의 최종 M4 합성 단계에서 별도로 반영한다.
    _ = q36_answer
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

    # ── 행동 적합도: 행동 점수가 시나리오 적정 범위 안인가 ──
    action_score = derive_action_score(holdings)

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

    m4 = MetricResult(
        metric=MetricId.M4,
        score=round(m4_score, 2),
        penalties=m4_penalties,
        reason=f"실제 행동 강도 {action_score}, 시나리오 적정 범위 {lo}~{hi}",
    )
    port = MetricResult(metric=MetricId.PORTFOLIO, score=round(port_score, 2), penalties=port_penalties)
    return m4, port
