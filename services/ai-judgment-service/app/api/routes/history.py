from fastapi import APIRouter
from app.history.repository import get_history
from app.models.schemas import HistoryEntry

router = APIRouter(prefix="/judgment", tags=["judgment"])


@router.get("/{symbol}/history", response_model=list[HistoryEntry])
async def get_judgment_history(symbol: str, limit: int = 20):
    docs = await get_history(symbol, limit)
    return [
        HistoryEntry(
            time=d["time"], judge=d["judge"],
            # probabilities 필드 도입 전에 저장된 이력 문서에는 이 키가 없다.
            probabilities=d.get("probabilities") or {"매수": 0.0, "매도": 0.0, "관망": 0.0},
            reason=d["reason"], changed=d["changed"],
        )
        for d in docs
    ]
