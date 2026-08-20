from fastapi import APIRouter, HTTPException
from app.history.repository import get_latest_judgment
from app.models.schemas import JudgmentResponse, Factor

router = APIRouter(prefix="/judgment", tags=["judgment"])


@router.get("/{symbol}", response_model=JudgmentResponse)
async def get_judgment(symbol: str):
    doc = await get_latest_judgment(symbol)
    if doc is None:
        raise HTTPException(status_code=404, detail="아직 계산된 판단이 없습니다")
    return JudgmentResponse(
        symbol=symbol,
        judge=doc["judge"],
        confidence=doc["confidence"],
        # probabilities 필드 도입 전에 저장된 이력 문서에는 이 키가 없다.
        probabilities=doc.get("probabilities") or {"매수": 0.0, "매도": 0.0, "관망": 0.0},
        summary=doc["reason"],
        factors=[Factor(**f) for f in doc["factors"]],
        computed_at=doc["time"],
    )
