from fastapi import APIRouter
from app.history.repository import get_history
from app.models.schemas import HistoryEntry

router = APIRouter(prefix="/judgment", tags=["judgment"])


@router.get("/{symbol}/history", response_model=list[HistoryEntry])
async def get_judgment_history(symbol: str, limit: int = 20):
    docs = await get_history(symbol, limit)
    return [
        HistoryEntry(time=d["time"], judge=d["judge"], reason=d["reason"], changed=d["changed"])
        for d in docs
    ]
