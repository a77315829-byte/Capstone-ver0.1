from fastapi import APIRouter
from fastapi import Path
from app.config import settings
from app.tracking.refresh import request_refresh
from app.tracking.registry import subscribe, unsubscribe

router = APIRouter(prefix="/judgment", tags=["watch"])


@router.post("/{symbol}/watch")
async def start_watch(symbol: str = Path(pattern=r"^\d[A-Z0-9]{5}$")):
    """즉시 구독을 등록하고 갱신은 예약한다. 조회는 AI 완료를 기다리지 않는다."""
    subscribe(symbol)
    refreshing = request_refresh(symbol)
    return {"symbol": symbol, "status": "watching", "refreshing": refreshing,
            "always_watched": symbol in settings.always_watch_symbols}


@router.delete("/{symbol}/watch")
async def stop_watch(symbol: str = Path(pattern=r"^\d[A-Z0-9]{5}$")):
    """프론트가 종목 화면을 벗어날 때 호출하는 구독 해제."""
    unsubscribe(symbol)
    return {"symbol": symbol, "status": "always_watched" if symbol in settings.always_watch_symbols else "unsubscribed"}
