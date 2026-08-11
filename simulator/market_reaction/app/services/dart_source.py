"""DART(전자공시시스템) 문서 수집 및 정규화.

normalize_dart_document/_rcept_dt_to_iso/_report_source_type/_strip_xml_tags 는 순수 함수라
pytest 로 검증한다. fetch_corp_code_map/fetch_dart_documents 는 실제 DART Open API 를
호출하는 네트워크 I/O 라 DART_API_KEY 로 scripts/build_rag_index.py 를 수동 실행해 확인한다.
"""

from __future__ import annotations

import zipfile
from io import BytesIO
from typing import Dict, List, TypedDict
from xml.etree import ElementTree

import httpx

from ..config import settings

DART_HEADING_PATTERN = r"(?m)^\s*(?:[IVX]+\.|[0-9]+\.)\s+\S"

_PERIODIC_KEYWORDS = ("사업보고서", "분기보고서", "반기보고서")


class NormalizedDocument(TypedDict):
    title: str
    source_type: str
    published_at: str
    stock_code: str
    market: str
    url: str
    content: str


def _rcept_dt_to_iso(rcept_dt: str) -> str:
    """DART 의 YYYYMMDD 형식 날짜를 YYYY-MM-DD 로 변환한다."""
    return f"{rcept_dt[0:4]}-{rcept_dt[4:6]}-{rcept_dt[6:8]}"


def _report_source_type(report_nm: str) -> str:
    """공시 제목으로 dart_periodic(정기공시)/dart_material(수시공시)을 구분한다."""
    if any(keyword in report_nm for keyword in _PERIODIC_KEYWORDS):
        return "dart_periodic"
    return "dart_material"


def _strip_xml_tags(xml_bytes: bytes) -> str:
    """DART document.xml 응답(ZIP 내부 XML)에서 텍스트만 추출한다."""
    root = ElementTree.fromstring(xml_bytes)
    return "".join(root.itertext())


def normalize_dart_document(
    *, stock_code: str, report_nm: str, rcept_no: str, rcept_dt: str, raw_text: str
) -> NormalizedDocument:
    """DART 공시 원문(raw_text)을 공통 문서 포맷으로 변환한다."""
    return {
        "title": report_nm,
        "source_type": _report_source_type(report_nm),
        "published_at": _rcept_dt_to_iso(rcept_dt),
        "stock_code": stock_code,
        "market": "KR",
        "url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}",
        "content": raw_text,
    }


async def fetch_corp_code_map() -> Dict[str, str]:
    """DART corpCode.xml(ZIP)을 내려받아 {stock_code: corp_code} 매핑을 만든다."""
    url = "https://opendart.fss.or.kr/api/corpCode.xml"
    params = {"crtfc_key": settings.dart_api_key}
    async with httpx.AsyncClient(timeout=httpx.Timeout(30)) as client:
        resp = await client.get(url, params=params)
    resp.raise_for_status()
    with zipfile.ZipFile(BytesIO(resp.content)) as zf:
        xml_bytes = zf.read("CORPCODE.xml")
    root = ElementTree.fromstring(xml_bytes)
    mapping: Dict[str, str] = {}
    for item in root.findall("list"):
        stock_code = (item.findtext("stock_code") or "").strip()
        corp_code = (item.findtext("corp_code") or "").strip()
        if stock_code:
            mapping[stock_code] = corp_code
    return mapping


async def _fetch_filing_list(corp_code: str) -> List[dict]:
    """DART list.json 으로 종목의 최근 정기공시 목록을 가져온다."""
    url = "https://opendart.fss.or.kr/api/list.json"
    params = {
        "crtfc_key": settings.dart_api_key,
        "corp_code": corp_code,
        "pblntf_ty": "A",
        "page_count": "5",
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(30)) as client:
        resp = await client.get(url, params=params)
    resp.raise_for_status()
    return resp.json().get("list", [])


async def _fetch_filing_text(rcept_no: str) -> str:
    """DART document.xml(ZIP)을 내려받아 안의 XML 파일들에서 텍스트만 추출한다."""
    url = "https://opendart.fss.or.kr/api/document.xml"
    params = {"crtfc_key": settings.dart_api_key, "rcept_no": rcept_no}
    async with httpx.AsyncClient(timeout=httpx.Timeout(30)) as client:
        resp = await client.get(url, params=params)
    resp.raise_for_status()
    with zipfile.ZipFile(BytesIO(resp.content)) as zf:
        texts = [_strip_xml_tags(zf.read(name)) for name in zf.namelist()]
    return "\n\n".join(texts)


async def fetch_dart_documents(stock_code: str, corp_code: str) -> List[NormalizedDocument]:
    """stock_code 의 최근 DART 정기공시를 조회해 정규화된 문서 목록으로 반환한다."""
    filings = await _fetch_filing_list(corp_code)
    documents: List[NormalizedDocument] = []
    for filing in filings:
        raw_text = await _fetch_filing_text(filing["rcept_no"])
        documents.append(
            normalize_dart_document(
                stock_code=stock_code,
                report_nm=filing["report_nm"],
                rcept_no=filing["rcept_no"],
                rcept_dt=filing["rcept_dt"],
                raw_text=raw_text,
            )
        )
    return documents
