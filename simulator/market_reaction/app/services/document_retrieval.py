"""종목별 IR/실적발표 자료 검색(RAG, MVP).

실제 문서 수집/색인 파이프라인 대신, 지원 종목(005930, 000660)에 한해 손으로 정리한
소규모 문서 세트를 코드에 내장하고 키워드 중복도 기반으로 검색한다. 임베딩/벡터DB
없이도 동작하는 최소 구현이며, 지원하지 않는 종목이거나 관련 문서를 못 찾으면
빈 리스트를 반환한다(예외를 던지지 않음 — 호출부가 항상 정상 동작하도록).
"""

from __future__ import annotations

from typing import Dict, List, TypedDict


class _Document(TypedDict):
    title: str
    source_type: str
    published_at: str
    content: str


# 종목코드별 IR/실적발표 자료(MVP: 소량 손수 정리, 실제 서비스에서는 주기적 수집/색인으로 교체).
_DOCUMENTS: Dict[str, List[_Document]] = {
    "005930": [
        {
            "title": "삼성전자 2026년 2분기 실적발표 컨퍼런스콜 요약",
            "source_type": "earnings_call",
            "published_at": "2026-07-24",
            "content": (
                "삼성전자는 2026년 2분기 HBM(고대역폭메모리) 매출이 전분기 대비 큰 폭으로 "
                "증가했다고 밝혔다. AI 서버향 메모리 수요 증가로 반도체 부문 영업이익이 "
                "개선되었으며, 파운드리 부문은 신규 고객사 수주 확대로 가동률이 상승했다고 언급했다. "
                "경영진은 하반기 메모리 가격 상승세가 이어질 것으로 전망한다고 밝혔다."
            ),
        },
        {
            "title": "삼성전자 IR 자료: 반도체 사업부 중장기 전략",
            "source_type": "ir_material",
            "published_at": "2026-06-10",
            "content": (
                "삼성전자는 차세대 HBM4 양산 준비 현황과 파운드리 미세공정 로드맵을 공개했다. "
                "AI 반도체 수요 확대에 대응하기 위한 설비 투자를 지속하고 있으며, 메모리 반도체 "
                "업황 개선에 따른 실적 회복을 기대한다고 밝혔다. 환율 변동과 글로벌 반도체 경쟁 "
                "심화는 주요 리스크 요인으로 언급되었다."
            ),
        },
    ],
    "000660": [
        {
            "title": "SK하이닉스 2026년 2분기 실적발표 컨퍼런스콜 요약",
            "source_type": "earnings_call",
            "published_at": "2026-07-23",
            "content": (
                "SK하이닉스는 HBM3E 공급 확대와 AI 서버향 D램 수요 증가로 2분기 영업이익이 "
                "시장 예상치를 상회했다고 밝혔다. 주요 고객사向 HBM 공급 계약이 확대되고 있으며, "
                "메모리 가격 상승 흐름이 하반기까지 지속될 것으로 전망한다고 언급했다."
            ),
        },
    ],
}

_TOP_K = 2
_MIN_MATCH_SCORE = 1

# 검색에 사용할 도메인 키워드(고정 목록). 한국어는 조사가 단어에 바로 붙어
# (예: "실적을", "실적이") 형태소 분석기 없이 임의 토큰을 부분 문자열로 매칭하면
# "대한"이 "기대한다고" 안에서 우연히 매칭되는 식의 오탐이 발생한다. 그래서 원문을
# 임의로 토큰화하는 대신, 의미 있는 도메인 키워드만 미리 정해두고 쿼리/문서 양쪽에
# 그 키워드가 (부분 문자열로) 있는지만 비교한다.
_DOMAIN_KEYWORDS = [
    "HBM", "HBM3E", "HBM4", "반도체", "파운드리", "메모리", "D램", "DRAM", "낸드",
    "AI", "인공지능", "서버", "실적", "영업이익", "매출", "수요", "공급", "가격",
    "고객사", "환율", "경쟁", "설비", "투자", "가동률",
]


def _matched_keywords(text: str) -> set:
    return {kw for kw in _DOMAIN_KEYWORDS if kw in text}


def _score(query_keywords: set, document: _Document) -> int:
    haystack = document["title"] + " " + document["content"]
    return len(query_keywords & _matched_keywords(haystack))


def retrieve_relevant_documents(stock_code: str, query_text: str) -> List[_Document]:
    """query_text 와 도메인 키워드 중복도가 높은 상위 문서를 반환한다.

    지원하지 않는 종목이거나 임계치 이상 겹치는 문서가 없으면 빈 리스트를 반환한다.
    """
    candidates = _DOCUMENTS.get(stock_code)
    if not candidates:
        return []

    query_keywords = _matched_keywords(query_text)
    if not query_keywords:
        return []

    scored = [(doc, _score(query_keywords, doc)) for doc in candidates]
    scored = [(doc, score) for doc, score in scored if score >= _MIN_MATCH_SCORE]
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return [doc for doc, _ in scored[:_TOP_K]]
