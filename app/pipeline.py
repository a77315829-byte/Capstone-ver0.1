"""전체 파이프라인 조립: 요인 조회 -> 스코어링 -> LLM 서술 -> 이력 저장.
event_listener.py가 트리거 조건 충족 시 이 함수를 호출한다.
"""
import asyncio
from datetime import datetime
from app.factors.resolver import resolve_factors
from app.factors.news_classifier import classify_news
from app.scoring.rubric import compute_weights
from app.scoring.judge import decide_judgment
from app.scoring.confidence import compute_confidence
from app.narrative.generator import generate_reasoning_summary
from app.history.repository import get_latest_judgment, save_judgment
from app.history.change_detector import detect_change


async def run_judgment_pipeline(symbol: str, market_data: dict, articles: list[str] | None = None) -> dict:
    classified_news = [
        await asyncio.to_thread(classify_news, article) for article in (articles or [])
    ]
    resolved = resolve_factors(market_data, classified_news)
    weighted = compute_weights(resolved)
    judge = decide_judgment(weighted)
    confidence = compute_confidence(weighted)

    # LLM은 여기서만 호출되고, 위에서 계산된 숫자는 절대 바꾸지 않는다.
    summary = await generate_reasoning_summary(judge, weighted)

    previous = await get_latest_judgment(symbol)
    changed = detect_change(previous, judge)

    doc = {
        "symbol": symbol,
        "time": datetime.utcnow().isoformat(timespec="seconds"),
        "judge": judge,
        "confidence": confidence,
        "reason": summary,
        "factors": weighted,
        "changed": changed,
    }
    await save_judgment(doc)
    return doc
