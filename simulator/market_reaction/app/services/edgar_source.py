"""SEC EDGAR 문서 수집 및 정규화.

normalize_edgar_document/_form_source_type/_html_to_text 는 순수 함수라 pytest 로
검증한다. fetch_ticker_cik_map/fetch_edgar_documents 는 실제 SEC EDGAR API 를 호출하는
네트워크 I/O 라 scripts/build_rag_index.py 를 수동 실행해 확인한다.

SEC 는 자동화된 요청에 식별 가능한 User-Agent 헤더를 요구한다.
"""

from __future__ import annotations

import asyncio
from typing import Dict, List, TypedDict

import httpx
from bs4 import BeautifulSoup

_USER_AGENT = "market-reaction-rag capstone project admin@example.com"

EDGAR_HEADING_PATTERN = r"(?im)^\s*item\s+\d+[a-z]?\.?\s+\S"

_FORM_SOURCE_TYPES = {"10-K": "edgar_10k", "10-Q": "edgar_10q", "8-K": "edgar_8k"}
_FETCH_FORMS = ("10-K", "10-Q", "8-K")


class NormalizedDocument(TypedDict):
    title: str
    source_type: str
    published_at: str
    stock_code: str
    market: str
    url: str
    content: str


def _form_source_type(form: str) -> str:
    return _FORM_SOURCE_TYPES.get(form, "edgar_other")


def _html_to_text(html: str) -> str:
    """EDGAR 필링 HTML 에서 텍스트만 추출한다(script/style 태그 내용 제외)."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    return soup.get_text(separator="\n")


def normalize_edgar_document(
    *, ticker: str, form: str, filing_date: str, url: str, html: str
) -> NormalizedDocument:
    """EDGAR 필링 HTML(html)을 공통 문서 포맷으로 변환한다."""
    return {
        "title": f"{ticker} {form} ({filing_date})",
        "source_type": _form_source_type(form),
        "published_at": filing_date,
        "stock_code": ticker,
        "market": "US",
        "url": url,
        "content": _html_to_text(html),
    }


async def fetch_ticker_cik_map() -> Dict[str, str]:
    """SEC 공개 매핑에서 {ticker: cik(10자리, 0패딩)} 을 만든다."""
    url = "https://www.sec.gov/files/company_tickers.json"
    headers = {"User-Agent": _USER_AGENT}
    async with httpx.AsyncClient(timeout=httpx.Timeout(30), headers=headers) as client:
        resp = await client.get(url)
    resp.raise_for_status()
    data = resp.json()
    return {entry["ticker"]: f"{entry['cik_str']:010d}" for entry in data.values()}


async def _fetch_recent_filings(cik: str) -> List[dict]:
    """SEC submissions API 로 최근 10-K/10-Q/8-K 목록을 가져온다."""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    headers = {"User-Agent": _USER_AGENT}
    async with httpx.AsyncClient(timeout=httpx.Timeout(30), headers=headers) as client:
        resp = await client.get(url)
    resp.raise_for_status()
    recent = resp.json()["filings"]["recent"]
    results = []
    for i, form in enumerate(recent["form"]):
        if form in _FETCH_FORMS:
            results.append(
                {
                    "form": form,
                    "accessionNumber": recent["accessionNumber"][i],
                    "filingDate": recent["filingDate"][i],
                    "primaryDocument": recent["primaryDocument"][i],
                }
            )
    return results


async def fetch_edgar_documents(ticker: str, cik: str) -> List[NormalizedDocument]:
    """ticker 의 최근 10-K/10-Q/8-K(최대 3건)를 동시에 조회해 정규화된 문서 목록으로 반환한다.

    최대 3건만 받으므로 동시 요청도 최대 3개다(SEC 정책상 초당 10건 제한에 여유있게 안전).
    """
    filings = await _fetch_recent_filings(cik)
    headers = {"User-Agent": _USER_AGENT}

    async def _fetch_one(client: httpx.AsyncClient, filing: dict) -> NormalizedDocument:
        accession_nodash = filing["accessionNumber"].replace("-", "")
        doc_url = (
            f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/"
            f"{accession_nodash}/{filing['primaryDocument']}"
        )
        resp = await client.get(doc_url)
        resp.raise_for_status()
        return normalize_edgar_document(
            ticker=ticker,
            form=filing["form"],
            filing_date=filing["filingDate"],
            url=doc_url,
            html=resp.text,
        )

    async with httpx.AsyncClient(timeout=httpx.Timeout(30), headers=headers) as client:
        documents = await asyncio.gather(*(_fetch_one(client, f) for f in filings[:3]))
    return list(documents)
