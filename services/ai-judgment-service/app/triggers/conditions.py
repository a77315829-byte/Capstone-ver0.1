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


def news_arrived(new_article_count: int) -> bool:
    return new_article_count > 0
