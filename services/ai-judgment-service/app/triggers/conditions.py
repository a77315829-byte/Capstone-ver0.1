from app.config import settings


def price_move_exceeds(prev_price: float, cur_price: float) -> bool:
    if prev_price == 0:
        return False
    pct = abs(cur_price - prev_price) / prev_price * 100
    return pct >= settings.price_move_threshold_pct


def rsi_crossed_overbought_exit(prev_rsi: float, cur_rsi: float) -> bool:
    return prev_rsi >= settings.rsi_overbought > cur_rsi


def supply_demand_flipped(prev_flow: float, cur_flow: float) -> bool:
    return prev_flow > 0 and cur_flow < 0


def volume_surged(volume_ratio: float | None) -> bool:
    return volume_ratio is not None and volume_ratio >= settings.volume_surge_ratio


def ma_crossed(golden_cross: bool, dead_cross: bool) -> bool:
    return bool(golden_cross or dead_cross)


def week52_extreme_hit(week52_high: bool, week52_low: bool) -> bool:
    return bool(week52_high or week52_low)
