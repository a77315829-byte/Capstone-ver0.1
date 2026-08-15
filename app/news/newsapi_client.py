"""newsapi.org 클라이언트. 실제 계정으로 라이브 호출해 응답 형태를 확인한 뒤 작성했다
(KIS와 달리 이 환경에서 검증 가능했음).

무료(Developer) 플랜 제약:
- 하루 100 요청
- /everything 은 최근 1개월 이내 기사만, 기사 반영이 최대 몇십 분 지연될 수 있어
  완전한 실시간은 아니다
- `content` 필드는 200자 남짓에서 잘리므로("... [+1234 chars]") 분류 입력으로 쓰지 않고
  title/description만 사용한다
"""
import httpx

from app.config import settings

BASE_URL = "https://newsapi.org/v2/everything"


async def fetch_articles(query: str, *, page_size: int = 10) -> list[dict]:
    params = {
        "q": query,
        "language": "ko",
        "sortBy": "publishedAt",
        "pageSize": page_size,
        "apiKey": settings.newsapi_api_key,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(BASE_URL, params=params)
    response.raise_for_status()
    data = response.json()
    if data.get("status") != "ok":
        raise RuntimeError(f"NewsAPI 요청 실패: {data.get('message')}")
    return data.get("articles", [])


def extract_text(article: dict) -> str:
    """news_classifier.classify_news()에 넘길 텍스트. title/description만 쓴다."""
    title = (article.get("title") or "").strip()
    description = (article.get("description") or "").strip()
    if title and description:
        return f"{title}. {description}"
    return title or description
