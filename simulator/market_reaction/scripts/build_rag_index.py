"""RAG 인덱스 빌드 스크립트 (수동 실행 전용).

DART(한국 20종목)/SEC EDGAR(미국 20종목) 공시를 수집·정규화·청킹·임베딩해
종목별 FAISS 인덱스와 공용 메타데이터/매니페스트를 settings.rag_index_dir 밑에 생성한다.

사전 준비: .env 에 DART_API_KEY 설정, Ollama 실행(임베딩 모델 pull 되어 있어야 함:
`ollama pull nomic-embed-text`).

실행 (simulator/market_reaction 디렉터리에서):
    python -m scripts.build_rag_index
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

from app.config import settings
from app.core.chunking import DEFAULT_MAX_CHARS, split_into_chunks, split_into_sections
from app.services import rag_index
from app.services.dart_source import DART_HEADING_PATTERN, fetch_corp_code_map, fetch_dart_documents
from app.services.edgar_source import (
    EDGAR_HEADING_PATTERN,
    fetch_edgar_documents,
    fetch_ticker_cik_map,
)
from app.services.embeddings import embed_text

KR_STOCKS = [
    "005930", "000660", "373220", "207940", "005380", "000270", "068270", "005490",
    "035420", "035720", "051910", "006400", "105560", "055550", "012330", "028260",
    "066570", "003670", "034730", "015760",
]
US_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "UNH",
    "JNJ", "WMT", "MA", "PG", "HD", "XOM", "CVX", "KO", "PEP", "AVGO",
]


MIN_CHUNK_CHARS = 100
_DEGENERATE_MIN_LINES = 3
_DEGENERATE_UNIQUE_RATIO = 0.5


def _is_degenerate(text: str) -> bool:
    """표를 텍스트로 펼치면서 같은 각주/문구가 줄마다 반복된 "퇴화된" 텍스트인지 판별한다.

    예: "종속기업 채권에 대하여 인식된 손실충당금은 없습니다..." 같은 각주가 표 행마다
    반복돼 한 청크 안에 동일 문장이 수십 번 들어가는 경우(실측: 전체 청크의 17%가
    이런 식으로 반복됨). 이런 텍스트는 임베딩 공간에서 다양한 질의와 두루 유사도가
    높게 나오는 "hub"가 되어 검색 결과를 오염시킨다(실측: 무관한 질의 4개에 매번
    똑같은 반복 청크가 1~2위로 나옴). 줄 단위로 봐서 서로 다른 줄의 비율이 낮으면
    (기본: 3줄 이상이면서 그중 절반 미만이 서로 다르면) 퇴화된 텍스트로 간주한다.
    """
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if len(lines) < _DEGENERATE_MIN_LINES:
        return False
    return len(set(lines)) / len(lines) < _DEGENERATE_UNIQUE_RATIO


def _document_to_chunks(document: dict, heading_pattern: str) -> List[str]:
    """정규화된 문서 하나(document['content'])를 청크 텍스트 목록으로 나눈다.

    MIN_CHUNK_CHARS 미만인 청크와 _is_degenerate 인 청크는 버린다. nomic-embed-text
    임베딩은 아주 짧은 텍스트(안건 목록 한 줄, "선임되었습니다" 같은 문장 조각 등)에
    코사인 유사도를 비정상적으로 높게 주는 경향이 있어(실측: 무관한 9~66자 청크가
    0.87~0.95, 실제 관련 있는 1200자 청크가 0.72) 검색 결과가 짧고 무의미한 조각들로
    뒤덮이는 문제가 있었고, 반복 텍스트(_is_degenerate)도 같은 이유로 검색 결과를
    오염시켰다. 둘 다 애초에 인덱싱하지 않으면 이 편향을 피할 수 있다.

    퇴화된 문단은 split_into_chunks 로 최종 청크를 만들기 전, 문단(빈 줄 구분) 단위로
    먼저 걸러낸다 — 그렇지 않으면 짧은 반복 문단이 주변의 정상적인 문단과 함께
    하나의 청크로 뭉쳐져 최종 청크 단위 판정에서는 "반복 비율"이 희석돼 걸러지지
    않는 경우가 있었다(실측 확인).
    """
    chunk_texts: List[str] = []
    for _heading, body in split_into_sections(document["content"], heading_pattern):
        paragraphs = [p for p in re.split(r"\n\s*\n", body.strip()) if p.strip()]
        clean_body = "\n\n".join(p for p in paragraphs if not _is_degenerate(p))
        for chunk in split_into_chunks(clean_body, DEFAULT_MAX_CHARS):
            if len(chunk) >= MIN_CHUNK_CHARS and not _is_degenerate(chunk):
                chunk_texts.append(chunk)
    return chunk_texts


async def _collect_documents() -> List[Tuple[dict, str]]:
    """(정규화된 문서, 해당 소스의 heading_pattern) 목록을 수집한다.

    진행 상황을 종목 단위로 즉시 출력한다(flush=True — stdout이 파일로 리다이렉트되면
    버퍼링돼서 flush 없이는 프로세스가 끝날 때까지 아무것도 안 보일 수 있다).
    """
    documents: List[Tuple[dict, str]] = []

    corp_code_map = await fetch_corp_code_map()
    for i, stock_code in enumerate(KR_STOCKS, 1):
        corp_code = corp_code_map.get(stock_code)
        if not corp_code:
            print(f"[DART {i}/{len(KR_STOCKS)}] {stock_code}: corp_code 없음, skip", flush=True)
            continue
        docs = await fetch_dart_documents(stock_code, corp_code)
        print(f"[DART {i}/{len(KR_STOCKS)}] {stock_code}: 공시 {len(docs)}건 수집", flush=True)
        for doc in docs:
            documents.append((doc, DART_HEADING_PATTERN))

    ticker_cik_map = await fetch_ticker_cik_map()
    for i, ticker in enumerate(US_TICKERS, 1):
        cik = ticker_cik_map.get(ticker)
        if not cik:
            print(f"[EDGAR {i}/{len(US_TICKERS)}] {ticker}: CIK 없음, skip", flush=True)
            continue
        docs = await fetch_edgar_documents(ticker, cik)
        print(f"[EDGAR {i}/{len(US_TICKERS)}] {ticker}: 공시 {len(docs)}건 수집", flush=True)
        for doc in docs:
            documents.append((doc, EDGAR_HEADING_PATTERN))

    return documents


_EMBED_CONCURRENCY = 8


async def _embed_texts(texts: List[str]) -> List[List[float]]:
    """청크 텍스트 목록을 동시에(최대 _EMBED_CONCURRENCY개) 임베딩한다.

    Ollama는 로컬 호출이라 서버 부하 걱정 없이 동시성을 높일 수 있다. 반환 순서는
    입력 순서와 동일하게 보존된다(vector_id 매핑에 필요).
    """
    semaphore = asyncio.Semaphore(_EMBED_CONCURRENCY)

    async def _one(text: str) -> List[float]:
        async with semaphore:
            return await embed_text(text)

    return list(await asyncio.gather(*(_one(t) for t in texts)))


async def build_index() -> None:
    documents = await _collect_documents()
    dart_doc_count = sum(1 for doc, _ in documents if doc["market"] == "KR")
    edgar_doc_count = len(documents) - dart_doc_count
    print(f"문서 수집 완료: {len(documents)}건. 종목별 청킹+임베딩 시작...", flush=True)

    documents_by_stock: Dict[str, List[Tuple[dict, str]]] = {}
    for document, heading_pattern in documents:
        documents_by_stock.setdefault(document["stock_code"], []).append(
            (document, heading_pattern)
        )

    index_dir = Path(settings.rag_index_dir)
    index_dir.mkdir(parents=True, exist_ok=True)

    chunks_by_stock: Dict[str, List[rag_index.Chunk]] = {}
    embedding_dim = 0
    total_chunks_done = 0

    for stock_code, stock_documents in documents_by_stock.items():
        chunk_texts: List[str] = []
        chunk_documents: List[dict] = []
        for document, heading_pattern in stock_documents:
            for text in _document_to_chunks(document, heading_pattern):
                chunk_texts.append(text)
                chunk_documents.append(document)

        vectors = await _embed_texts(chunk_texts)
        if vectors:
            embedding_dim = len(vectors[0])
            index = rag_index.build_index(vectors)
            rag_index.save_index(index, index_dir / f"{stock_code}.faiss")

        chunks_by_stock[stock_code] = [
            rag_index.Chunk(
                chunk_id=f"{stock_code}:{vector_id}",
                vector_id=vector_id,
                stock_code=stock_code,
                title=document["title"],
                source_type=document["source_type"],
                published_at=document["published_at"],
                url=document["url"],
                text=text,
            )
            for vector_id, (text, document) in enumerate(zip(chunk_texts, chunk_documents))
        ]
        total_chunks_done += len(chunk_texts)
        print(
            f"[임베딩] {stock_code}: {len(chunk_texts)}청크 완료 (누적 {total_chunks_done})",
            flush=True,
        )

    rag_index.save_metadata(chunks_by_stock, index_dir / "rag_metadata.json")
    rag_index.save_manifest(
        index_dir / "rag_manifest.json",
        embedding_model=settings.ollama_embedding_model,
        embedding_dim=embedding_dim,
        created_at=datetime.now(timezone.utc).isoformat(),
        counts={
            "dart_documents": dart_doc_count,
            "edgar_documents": edgar_doc_count,
            "stocks": len(chunks_by_stock),
            "chunks": sum(len(c) for c in chunks_by_stock.values()),
        },
    )
    total_chunks = sum(len(c) for c in chunks_by_stock.values())
    print(f"인덱스 생성 완료: {len(chunks_by_stock)}개 종목, {total_chunks}개 청크", flush=True)


if __name__ == "__main__":
    asyncio.run(build_index())
