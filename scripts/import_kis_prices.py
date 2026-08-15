"""KIS 국내주식 기간별 시세 API로 시나리오 20종목의 일봉을 적재한다.

공식 API: 국내주식기간별시세(일/주/월/년), FHKST03010100.
토큰과 앱 비밀값은 .env에서만 읽으며 출력하지 않는다.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta
import json
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from config import KIS_APP_KEY, KIS_APP_SECRET, KIS_ENV, SCHEMA_VERSION
from data.app_repository import AppRepository
from data.store import get_store


REAL_BASE_URL = "https://openapi.koreainvestment.com:9443"
DEMO_BASE_URL = "https://openapivts.koreainvestment.com:29443"
PRICE_PATH = "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"
TOKEN_PATH = "/oauth2/tokenP"


def http_json(request: Request, timeout: int = 20) -> dict:
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"KIS HTTP 오류 {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"KIS 연결 실패: {exc.reason}") from exc


def issue_token(base_url: str) -> str:
    if not KIS_APP_KEY or not KIS_APP_SECRET:
        raise RuntimeError(".env에 KIS_APP_KEY와 KIS_APP_SECRET을 입력하세요.")
    body = json.dumps(
        {
            "grant_type": "client_credentials",
            "appkey": KIS_APP_KEY,
            "appsecret": KIS_APP_SECRET,
        }
    ).encode("utf-8")
    request = Request(
        base_url + TOKEN_PATH,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "text/plain"},
        method="POST",
    )
    response = http_json(request)
    token = response.get("access_token")
    if not token:
        raise RuntimeError(f"KIS 토큰 발급 실패: {response.get('error_description', '응답 확인 필요')}")
    return str(token)


def request_prices(
    base_url: str,
    token: str,
    asset_id: str,
    start_date: str,
    end_date: str,
) -> list[dict]:
    query = urlencode(
        {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": asset_id,
            "FID_INPUT_DATE_1": start_date,
            "FID_INPUT_DATE_2": end_date,
            "FID_PERIOD_DIV_CODE": "D",
            "FID_ORG_ADJ_PRC": "0",
        }
    )
    request = Request(
        f"{base_url}{PRICE_PATH}?{query}",
        headers={
            "authorization": f"Bearer {token}",
            "appkey": KIS_APP_KEY,
            "appsecret": KIS_APP_SECRET,
            "tr_id": "FHKST03010100",
            "custtype": "P",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="GET",
    )
    response = http_json(request)
    if str(response.get("rt_cd")) != "0":
        raise RuntimeError(
            f"{asset_id} 시세 조회 실패: {response.get('msg_cd')} {response.get('msg1')}"
        )
    return list(response.get("output2") or [])


def normalize_row(asset_id: str, row: dict) -> dict | None:
    date = str(row.get("stck_bsop_date", ""))
    close = str(row.get("stck_clpr", "0"))
    if len(date) != 8 or not close or int(close) <= 0:
        return None
    return {
        "schema_version": SCHEMA_VERSION,
        "asset_id": asset_id,
        "trade_date": f"{date[:4]}-{date[4:6]}-{date[6:8]}",
        "open": int(row.get("stck_oprc", 0)),
        "high": int(row.get("stck_hgpr", 0)),
        "low": int(row.get("stck_lwpr", 0)),
        "close": int(close),
        "volume": int(row.get("acml_vol", 0)),
        "source": "KIS",
        "adjusted_price": True,
    }


def collect_asset(
    asset_id: str,
    start_date: str,
    end_date: str,
    *,
    base_url: str,
    token: str,
    delay: float,
) -> list[dict]:
    start = datetime.strptime(start_date, "%Y%m%d").date()
    cursor_end = datetime.strptime(end_date, "%Y%m%d").date()
    documents: dict[str, dict] = {}
    while cursor_end >= start:
        rows = request_prices(
            base_url,
            token,
            asset_id,
            start.strftime("%Y%m%d"),
            cursor_end.strftime("%Y%m%d"),
        )
        normalized = [item for row in rows if (item := normalize_row(asset_id, row))]
        for item in normalized:
            if item["trade_date"].replace("-", "") >= start_date:
                documents[item["trade_date"]] = item
        if not normalized:
            break
        earliest = min(
            datetime.strptime(item["trade_date"], "%Y-%m-%d").date()
            for item in normalized
        )
        if earliest <= start:
            break
        cursor_end = earliest - timedelta(days=1)
        time.sleep(delay)
    return [documents[key] for key in sorted(documents)]


def main() -> None:
    parser = argparse.ArgumentParser(description="KIS 과거 일봉을 MongoDB에 적재합니다.")
    parser.add_argument("--scenario", default="semiconductor")
    parser.add_argument("--start", default="20231101", help="YYYYMMDD")
    parser.add_argument("--end", default="20240719", help="YYYYMMDD")
    parser.add_argument("--delay", type=float, default=0.15)
    args = parser.parse_args()
    if KIS_ENV not in {"real", "demo"}:
        raise RuntimeError("KIS_ENV는 real 또는 demo여야 합니다.")
    store = get_store()
    store.ping()
    store.ensure_indexes()
    repository = AppRepository(store)
    scenario = repository.get_scenario(args.scenario)
    base_url = REAL_BASE_URL if KIS_ENV == "real" else DEMO_BASE_URL
    token = issue_token(base_url)
    total = 0
    for index, asset_id in enumerate(scenario["asset_ids"], 1):
        documents = collect_asset(
            asset_id,
            args.start,
            args.end,
            base_url=base_url,
            token=token,
            delay=args.delay,
        )
        for document in documents:
            store.replace_one(
                "daily_prices",
                {"asset_id": asset_id, "trade_date": document["trade_date"]},
                document,
                upsert=True,
            )
        total += len(documents)
        print(f"[{index}/{len(scenario['asset_ids'])}] {asset_id}: {len(documents)}건")
        time.sleep(args.delay)
    print(json.dumps({"status": "ok", "imported": total}, ensure_ascii=False))


if __name__ == "__main__":
    main()
