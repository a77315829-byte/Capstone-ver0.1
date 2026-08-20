from fastapi import APIRouter
from app.marketdata.cold_start import cold_start
from app.tracking.registry import subscribe, unsubscribe

router = APIRouter(prefix="/judgment", tags=["watch"])


@router.post("/{symbol}/watch")
async def start_watch(symbol: str):
    """프론트가 종목 화면 진입 시(+ 보고 있는 동안 주기적으로) 호출하는
    구독 하트비트. 이력이 없는 종목이면 콜드스타트로 첫 판단까지 만든다."""
    doc = await cold_start(symbol)
    # probabilities 필드 도입 전에 저장된 이력 문서에는 이 키가 없다.
    probabilities = doc.get("probabilities") or {"매수": 0.0, "매도": 0.0, "관망": 0.0}
    return {"symbol": symbol, "judge": doc["judge"], "probabilities": probabilities}


@router.delete("/{symbol}/watch")
async def stop_watch(symbol: str):
    """프론트가 종목 화면을 벗어날 때 호출하는 구독 해제."""
    unsubscribe(symbol)
    return {"symbol": symbol, "status": "unsubscribed"}
