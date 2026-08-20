"""전체 파이프라인 조립: 요인 조회 -> 스코어링 -> LLM 서술 -> 이력 저장.
event_listener.py가 트리거 조건 충족 시 이 함수를 호출한다.
"""
from datetime import datetime, timezone
from app.factors.resolver import resolve_factors
from app.scoring.rubric import compute_weights
from app.scoring.fuzzy_judge import compute_judgment
from app.narrative.generator import generate_reasoning_summary
from app.history.repository import get_latest_judgment, save_judgment
from app.history.change_detector import detect_change


async def run_judgment_pipeline(symbol: str, market_data: dict) -> dict:
    resolved = resolve_factors(market_data)
    weighted = compute_weights(resolved)
    result = compute_judgment(weighted)

    # LLM은 여기서만 호출되고, 위에서 계산된 숫자는 절대 바꾸지 않는다.
    summary = await generate_reasoning_summary(result["judge"], weighted)

    previous = await get_latest_judgment(symbol)
    changed = detect_change(previous, result["judge"], result["probabilities"])

    doc = {
        "symbol": symbol,
        # timezone.utc를 명시해야 "+00:00"이 붙는다 - 이게 없으면(datetime.utcnow())
        # ISO 문자열에 시간대 표시가 없어서, 프론트에서 new Date(...)로 파싱할 때
        # UTC가 아니라 브라우저 로컬 시간으로 오인해 KST 기준 9시간 과거로 보인다.
        "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "judge": result["judge"],
        "confidence": result["confidence"],
        "probabilities": result["probabilities"],
        "reason": summary,
        "factors": weighted,
        "changed": changed,
    }
    await save_judgment(doc)
    return doc
