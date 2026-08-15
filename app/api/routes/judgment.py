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
        summary=doc["reason"],
        factors=[Factor(**f) for f in doc["factors"]],
        computed_at=doc["time"],
    )
