"""실시간 시장 데이터를 요인 카탈로그 규칙에 대입해 '발생한 요인'만 골라낸다.
여기엔 LLM 호출이 없다 - 순수 규칙 판정.
"""
from dataclasses import dataclass

from app.factors.catalog import get_factor_by_id


@dataclass
class ResolvedFactor:
    factor_id: str
    type: str
    direction: str
    description: str
    raw_strength: float  # 0~1, 신호 강도 (규칙 기반)


def _resolved(factor_id: str, raw_strength: float) -> ResolvedFactor:
    entry = get_factor_by_id(factor_id)
    return ResolvedFactor(
        factor_id=factor_id,
        type=entry["type"],
        direction=entry["direction"],
        description=entry["description"],
        raw_strength=raw_strength,
    )


def resolve_news_factor(classified: dict) -> ResolvedFactor | None:
    """news_classifier.classify_news()의 결과를 ResolvedFactor로 승격한다.
    분류기가 이미 factor_id로 카테고리를 확정했으므로, resolver가 sentiment_score를
    다시 별도 임계치로 재판정하지 않는다 (과거엔 이 부분이 이중 판정이었음).
    """
    factor_id = classified.get("factor_id")
    if not factor_id or get_factor_by_id(factor_id) is None:
        return None
    raw_strength = min(abs(classified.get("sentiment_score", 0.0)), 1.0)
    return _resolved(factor_id, raw_strength)


def resolve_factors(market_data: dict, classified_news: list[dict] | None = None) -> list[ResolvedFactor]:
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

    rsi = market_data.get("rsi_14")
    if rsi is not None and 65 <= rsi < 70:
        resolved.append(_resolved(
            "rsi_overbought_exit",
            raw_strength=(70 - rsi) / 10,
        ))
    if rsi is not None and 30 <= rsi < 35:
        resolved.append(_resolved(
            "rsi_oversold_exit",
            raw_strength=(rsi - 30) / 10,
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

    for classified in classified_news or []:
        news_factor = resolve_news_factor(classified)
        if news_factor is not None:
            resolved.append(news_factor)

    return _dedupe_by_factor_id(resolved)


def _dedupe_by_factor_id(candidates: list[ResolvedFactor]) -> list[ResolvedFactor]:
    """시장데이터 규칙과 뉴스 분류가 같은 factor_id를 동시에 발생시키면
    (예: 섹터 약세를 시세로도, 뉴스로도 감지) 같은 신호를 두 번 집계하게 된다.
    같은 factor_id끼리는 raw_strength가 더 큰 쪽만 남긴다.
    """
    best: dict[str, ResolvedFactor] = {}
    for candidate in candidates:
        existing = best.get(candidate.factor_id)
        if existing is None or candidate.raw_strength > existing.raw_strength:
            best[candidate.factor_id] = candidate
    return list(best.values())
