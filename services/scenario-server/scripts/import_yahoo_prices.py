"""Yahoo Finance 차트 API의 실제 KRX 과거 일봉을 MongoDB에 적재한다.

KIS 키가 없는 로컬 개발 환경을 위한 보조 수단이다. KOSPI·ETF는 ``.KS``,
KOSDAQ은 ``.KQ`` 심볼을 사용하며 응답 원본의 OHLCV만 저장한다.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from config import SCHEMA_VERSION
from data.app_repository import AppRepository
from data.store import get_store


BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart"


def to_epoch(date_text: str) -> int:
    value = datetime.strptime(date_text, "%Y%m%d").replace(tzinfo=timezone.utc)
    return int(value.timestamp())


def yahoo_symbol(asset: dict) -> str:
    suffix = ".KQ" if str(asset.get("market", "")).upper() == "KOSDAQ" else ".KS"
    return f"{asset['asset_id']}{suffix}"


def request_chart(symbol: str, start_date: str, end_date: str) -> dict:
    # Yahoo의 period2는 미포함이므로 사용자가 요청한 종료일 다음 날을 보낸다.
    inclusive_end = datetime.strptime(end_date, "%Y%m%d") + timedelta(days=1)
    query = urlencode(
        {
            "period1": to_epoch(start_date),
            "period2": int(inclusive_end.replace(tzinfo=timezone.utc).timestamp()),
            "interval": "1d",
            "events": "history",
            "includeAdjustedClose": "true",
        }
    )
    request = Request(
        f"{BASE_URL}/{symbol}?{query}",
        headers={"User-Agent": "Mozilla/5.0 Anttitude-Scenario-Server/1.0"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Yahoo Finance HTTP 오류 {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Yahoo Finance 연결 실패: {exc.reason}") from exc
    error = payload.get("chart", {}).get("error")
    if error:
        raise RuntimeError(f"Yahoo Finance 조회 실패: {error}")
    return payload


def normalize_chart(asset_id: str, payload: dict) -> list[dict]:
    results = payload.get("chart", {}).get("result") or []
    if not results:
        return []
    result = results[0]
    timestamps = result.get("timestamp") or []
    quotes = (result.get("indicators", {}).get("quote") or [{}])[0]
    documents = []
    for index, timestamp in enumerate(timestamps):
        values = {
            key: (quotes.get(key) or [None] * len(timestamps))[index]
            for key in ("open", "high", "low", "close", "volume")
        }
        if any(values[key] is None for key in ("open", "high", "low", "close")):
            continue
        close = int(round(float(values["close"])))
        if close <= 0:
            continue
        documents.append(
            {
                "schema_version": SCHEMA_VERSION,
                "asset_id": asset_id,
                "trade_date": datetime.fromtimestamp(
                    int(timestamp), timezone.utc
                ).strftime("%Y-%m-%d"),
                "open": int(round(float(values["open"]))),
                "high": int(round(float(values["high"]))),
                "low": int(round(float(values["low"]))),
                "close": close,
                "volume": int(values["volume"] or 0),
                "source": "YAHOO_FINANCE_CHART",
                "adjusted_price": False,
            }
        )
    return documents


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Yahoo Finance의 실제 KRX 과거 일봉을 MongoDB에 적재합니다."
    )
    parser.add_argument("--scenario", default="growth_rate_hike_2022")
    parser.add_argument("--start", default="20211201", help="YYYYMMDD")
    parser.add_argument("--end", default="20221229", help="YYYYMMDD")
    parser.add_argument("--delay", type=float, default=0.2)
    args = parser.parse_args()

    store = get_store()
    store.ping()
    store.ensure_indexes()
    repository = AppRepository(store)
    scenario = repository.get_scenario(args.scenario)
    total = 0
    for index, asset_id in enumerate(scenario["asset_ids"], 1):
        asset = repository.get_asset(asset_id)
        symbol = yahoo_symbol(asset)
        documents = normalize_chart(
            asset_id,
            request_chart(symbol, args.start, args.end),
        )
        for document in documents:
            store.replace_one(
                "daily_prices",
                {"asset_id": asset_id, "trade_date": document["trade_date"]},
                document,
                upsert=True,
            )
        total += len(documents)
        print(f"[{index}/{len(scenario['asset_ids'])}] {asset_id} ({symbol}): {len(documents)}건")
        time.sleep(args.delay)
    print(json.dumps({"status": "ok", "imported": total}, ensure_ascii=False))


if __name__ == "__main__":
    main()
