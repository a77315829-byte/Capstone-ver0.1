from fastapi import APIRouter, HTTPException
from app.history.repository import get_latest_judgment
from app.narrative.generator import generate_comparison
from app.models.schemas import CompareRequest, CompareResponse

router = APIRouter(prefix="/judgment", tags=["judgment"])


@router.post("/compare", response_model=CompareResponse)
async def compare_judgment(payload: CompareRequest):
    doc = await get_latest_judgment(payload.symbol)
    if doc is None:
        raise HTTPException(status_code=404, detail="비교할 AI 판단이 없습니다")

    explanation = await generate_comparison(payload.user_judge, doc["judge"], doc["factors"])

    highlighted = [f["factor"] for f in doc["factors"]]

    return CompareResponse(
        user_judge=payload.user_judge,
        ai_judge=doc["judge"],
        # probabilities 필드 도입 전에 저장된 이력 문서에는 이 키가 없다.
        ai_probabilities=doc.get("probabilities") or {"매수": 0.0, "매도": 0.0, "관망": 0.0},
        explanation=explanation,
        highlighted_factors=highlighted,
    )
