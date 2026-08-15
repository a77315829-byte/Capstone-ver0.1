"""뉴스 기사를 사전 정의된 요인 카탈로그 중 하나로 분류한다 (zero-shot).
전용 파인튜닝 모델 없이 GPT-4o로 시작한다. 데이터가 쌓이면 이 함수의 시그니처는
그대로 두고 내부 구현만 경량 모델로 교체할 수 있다.
"""
import json
from app.factors.catalog import get_catalog
from app.narrative.clients.provider import call_json


def classify_news(article_text: str) -> dict:
    catalog_desc = "\n".join(
        f"- {f['factor_id']}: {f['description']} ({f['type']})" for f in get_catalog()
    )
    system_prompt = (
        "너는 금융 뉴스를 사전 정의된 카테고리로만 분류하는 분류기다. "
        "새로운 카테고리를 만들지 말고, 아래 목록 중 가장 근접한 하나를 선택하거나 "
        "해당사항이 없으면 factor_id를 null로 반환해라."
    )
    user_prompt = (
        f"카테고리 목록:\n{catalog_desc}\n\n"
        f"기사:\n{article_text}\n\n"
        '다음 JSON 형식으로만 답해라: '
        '{"factor_id": "...", "sentiment_score": -1.0~1.0}'
    )
    raw = call_json(system_prompt, user_prompt)
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # 확신도 낮은/파싱 실패 케이스는 unclassified 큐로 보내 사람 검토 대상으로 남긴다
        return {"factor_id": None, "sentiment_score": 0.0}
    return result
