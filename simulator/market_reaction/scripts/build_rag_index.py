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


def _document_to_chunks(document: dict, heading_pattern: str) -> List[str]:
    """정규화된 문서 하나(document['content'])를 청크 텍스트 목록으로 나눈다."""
    chunk_texts: List[str] = []
    for _heading, body in split_into_sections(document["content"], heading_pattern):
        chunk_texts.extend(split_into_chunks(body, DEFAULT_MAX_CHARS))
    return chunk_texts


async def _collect_documents() -> List[Tuple[dict, str]]:
    """(정규화된 문서, 해당 소스의 heading_pattern) 목록을 수집한다."""
    documents: List[Tuple[dict, str]] = []

    corp_code_map = await fetch_corp_code_map()
    for stock_code in KR_STOCKS:
        corp_code = corp_code_map.get(stock_code)
        if not corp_code:
            print(f"[skip] DART corp_code not found for {stock_code}")
            continue
        for doc in await fetch_dart_documents(stock_code, corp_code):
            documents.append((doc, DART_HEADING_PATTERN))

    ticker_cik_map = await fetch_ticker_cik_map()
    for ticker in US_TICKERS:
        cik = ticker_cik_map.get(ticker)
        if not cik:
            print(f"[skip] EDGAR CIK not found for {ticker}")
            continue
        for doc in await fetch_edgar_documents(ticker, cik):
            documents.append((doc, EDGAR_HEADING_PATTERN))

    return documents


async def build_index() -> None:
    documents = await _collect_documents()

    chunks_by_stock: Dict[str, List[rag_index.Chunk]] = {}
    vectors_by_stock: Dict[str, List[List[float]]] = {}
    dart_doc_count = edgar_doc_count = 0

    for document, heading_pattern in documents:
        stock_code = document["stock_code"]
        if document["market"] == "KR":
            dart_doc_count += 1
        else:
            edgar_doc_count += 1

        chunks_by_stock.setdefault(stock_code, [])
        vectors_by_stock.setdefault(stock_code, [])

        for text in _document_to_chunks(document, heading_pattern):
            vector = await embed_text(text)
            vector_id = len(vectors_by_stock[stock_code])
            chunks_by_stock[stock_code].append(
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
            )
            vectors_by_stock[stock_code].append(vector)

    index_dir = Path(settings.rag_index_dir)
    index_dir.mkdir(parents=True, exist_ok=True)

    embedding_dim = 0
    for stock_code, vectors in vectors_by_stock.items():
        if not vectors:
            continue
        embedding_dim = len(vectors[0])
        index = rag_index.build_index(vectors)
        rag_index.save_index(index, index_dir / f"{stock_code}.faiss")

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
    print(f"인덱스 생성 완료: {len(chunks_by_stock)}개 종목, {total_chunks}개 청크")


if __name__ == "__main__":
    asyncio.run(build_index())
