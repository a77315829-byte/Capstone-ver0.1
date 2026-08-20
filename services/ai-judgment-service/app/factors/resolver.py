"""실시간 시장 데이터를 요인 카탈로그 규칙에 대입해 '발생한 요인'만 골라낸다.
전부 결정론적 규칙 판정 - LLM 호출 없음.
"""
from dataclasses import dataclass

from app.config import settings
from app.factors.catalog import get_factor_by_id


@dataclass
class ResolvedFactor:
    factor_id: str
    direction: str
    description: str
    raw_strength: float  # 0~1, 신호 강도 (규칙 기반)


def _resolved(factor_id: str, raw_strength: float) -> ResolvedFactor:
    entry = get_factor_by_id(factor_id)
    return ResolvedFactor(
        factor_id=factor_id,
        direction=entry["direction"],
        description=entry["description"],
        raw_strength=raw_strength,
    )


def resolve_factors(market_data: dict) -> list[ResolvedFactor]:
    resolved: list[ResolvedFactor] = []

    if market_data.get("foreign_net_flow_flipped_negative"):
        resolved.append(_resolved(
            "foreign_sell_flip",
            raw_strength=min(abs(market_data.get("foreign_net_flow", 0)) / 1_000_000, 1.0),
        ))

    if market_data.get("foreign_net_flow_flipped_positive"):
        resolved.append(_resolved(
            "foreign_buy_flip",
            raw_strength=min(abs(market_data.get("foreign_net_flow", 0)) / 1_000_000, 1.0),
        ))

    # 밴드 폭(5)로 나눠야 밴드 끝(65 또는 35)에서 raw_strength가 1.0에 도달한다.
    # 예전에 /10으로 나눠서 최대 0.5로 캡이 걸려 있었는데, 다른 요인들(최대 1.0
    # 도달 가능)과의 형평성이 깨져 RSI 혼자서는 절대 관망을 못 이기는 문제가 있었다.
    rsi = market_data.get("rsi_14")
    if rsi is not None and 65 <= rsi < 70:
        resolved.append(_resolved(
            "rsi_overbought_exit",
            raw_strength=(70 - rsi) / 5,
        ))
    if rsi is not None and 30 <= rsi < 35:
        resolved.append(_resolved(
            "rsi_oversold_exit",
            raw_strength=(rsi - 30) / 5,
        ))

    sector_chg = market_data.get("sector_index_change_pct")
    if sector_chg is not None and sector_chg <= -1.0:
        resolved.append(_resolved(
            "sector_weakness",
            raw_strength=min(abs(sector_chg) / 3, 1.0),
        ))
    if sector_chg is not None and sector_chg >= 1.0:
        resolved.append(_resolved(
            "sector_strength",
            raw_strength=min(abs(sector_chg) / 3, 1.0),
        ))

    volume_ratio = market_data.get("volume_ratio")
    price_chg = market_data.get("price_change_pct")
    if volume_ratio is not None and price_chg is not None and volume_ratio >= settings.volume_surge_ratio:
        surge_strength = min((volume_ratio - settings.volume_surge_ratio) / settings.volume_surge_ratio, 1.0)
        if price_chg > 0:
            resolved.append(_resolved("volume_surge_up", raw_strength=surge_strength))
        elif price_chg < 0:
            resolved.append(_resolved("volume_surge_down", raw_strength=surge_strength))

    if market_data.get("golden_cross"):
        resolved.append(_resolved(
            "golden_cross",
            raw_strength=min(abs(market_data.get("ma_gap_pct", 0)) / 2, 1.0),
        ))
    if market_data.get("dead_cross"):
        resolved.append(_resolved(
            "dead_cross",
            raw_strength=min(abs(market_data.get("ma_gap_pct", 0)) / 2, 1.0),
        ))

    if market_data.get("week52_high"):
        resolved.append(_resolved(
            "week52_high",
            raw_strength=min(abs(market_data.get("week52_distance_pct", 0)) / 5, 1.0),
        ))
    if market_data.get("week52_low"):
        resolved.append(_resolved(
            "week52_low",
            raw_strength=min(abs(market_data.get("week52_distance_pct", 0)) / 5, 1.0),
        ))

    return resolved
