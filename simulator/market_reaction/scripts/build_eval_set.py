"""RAG 평가용 정답 세트 빌드 스크립트 (수동 실행 전용).

이벤트는 DART 주요사항보고서(pblntf_ty="B")를 쓴다 — 법령이 "주요사항"으로 규정한
공시라 자의적 선별이 아니고, 접수일과 종목이 확정되어 있다. RAG 인덱스에 들어 있는
정기공시(pblntf_ty="A")와 종류가 달라 이벤트 자체가 검색되는 누출도 없다.

정답 라벨은 공시 직전 거래일 종가 -> 직후 거래일 종가의 KOSPI 대비 초과수익률이다.
시장 전체 등락에 오염되지 않도록 지수를 차감하고, +-band(기본 0.5%p) 밴드 밖일 때만
positive/negative 로 본다.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple


def pick_trading_days(dates: List[str], event_date: str) -> Optional[Tuple[str, str]]:
    """(기준일, 비교일) = (공시일 이전 마지막 거래일, 공시일 직후 첫 거래일).

    공시가 장 마감 후나 휴장일에 접수되는 경우를 함께 처리하기 위해 이렇게 잡는다 —
    어느 쪽이든 "공시를 모르는 마지막 종가"와 "공시를 아는 첫 종가"가 된다.
    둘 중 하나라도 없으면 None.
    """
    before = [d for d in dates if d <= event_date]
    after = [d for d in dates if d > event_date]
    if not before or not after:
        return None
    return max(before), min(after)


def compute_label(
    stock_prices: Dict[str, float],
    index_prices: Dict[str, float],
    event_date: str,
    band: float = 0.5,
) -> Optional[dict]:
    """초과수익률 기반 3-way 라벨. 가격이 모자라면 None 을 반환한다.

    거래일 달력은 종목 시세를 기준으로 삼고, 지수에 그 두 날짜가 모두 있을 때만
    라벨을 만든다. 교집합으로 날짜를 고르면 지수에 구멍이 있을 때 하루 수익률 대신
    여러 날 수익률을 조용히 계산해 라벨이 오염되기 때문이다.
    """
    days = pick_trading_days(sorted(stock_prices), event_date)
    if days is None:
        return None
    base, nxt = days
    if base not in index_prices or nxt not in index_prices:
        return None

    def _ret(series: Dict[str, float]) -> float:
        return (series[nxt] - series[base]) / series[base] * 100.0

    stock_return = _ret(stock_prices)
    index_return = _ret(index_prices)
    excess = stock_return - index_return

    if excess > band:
        label = "positive"
    elif excess < -band:
        label = "negative"
    else:
        label = "neutral"

    return {
        "label": label,
        "base_date": base,
        "next_date": nxt,
        "stock_return": stock_return,
        "index_return": index_return,
        "excess_return": excess,
    }


# --------------------------------------------------------------------------
# 이하 수집 계층 (외부 API I/O). 순수 로직은 위쪽에 있고 여기서는 조립만 한다.
# --------------------------------------------------------------------------

import argparse  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import time  # noqa: E402
import urllib.parse  # noqa: E402
import urllib.request  # noqa: E402
from datetime import datetime, timedelta  # noqa: E402
from pathlib import Path  # noqa: E402

DART_LIST_URL = "https://opendart.fss.or.kr/api/list.json"
KIS_ITEM_PATH = "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"
KIS_INDEX_PATH = "/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice"
KOSPI_ISCD = "0001"

# RAG 인덱스에 들어 있는 한국 20종목 (scripts/build_rag_index.py 의 KR_STOCKS 와 동일)
KR_STOCKS = [
    "005930", "000660", "373220", "207940", "005380", "000270", "068270", "005490",
    "035420", "035720", "051910", "006400", "105560", "055550", "012330", "028260",
    "066570", "003670", "034730", "015760",
]


def _http_json(
    url: str, headers: Optional[dict] = None, timeout: int = 30, retries: int = 4
) -> dict:
    """KIS 는 호출이 몰리면 HTTP 500 을 돌려주므로 지수 백오프로 재시도한다."""
    delay = 1.0
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers or {})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(delay)
            delay *= 2
    raise RuntimeError("unreachable")


def fetch_events(dart_key: str, corp_code: str, bgn: str, end: str) -> List[dict]:
    """주요사항보고서 목록을 [{date, title}] 로 반환한다."""
    params = {
        "crtfc_key": dart_key, "corp_code": corp_code, "bgn_de": bgn, "end_de": end,
        "pblntf_ty": "B", "page_count": "100",
    }
    data = _http_json(f"{DART_LIST_URL}?{urllib.parse.urlencode(params)}")
    if data.get("status") != "000":
        return []
    return [
        {
            "date": it["rcept_dt"],
            "title": it["report_nm"].strip(),
            "rcept_no": it["rcept_no"],
        }
        for it in data.get("list", [])
    ]


async def fetch_event_bodies(events: List[dict], concurrency: int = 3) -> None:
    """각 이벤트의 공시 본문을 받아 event["body"] 에 채운다(실패하면 빈 문자열).

    제목만으로는 방향을 가르는 정보(취득목적·금액 등)가 빠진다. 본문은 3,000자 내외라
    프롬프트에 그대로 넣을 수 있다.
    """
    import asyncio

    from app.services.dart_source import _fetch_filing_text

    semaphore = asyncio.Semaphore(concurrency)

    async def _one(ev: dict) -> None:
        async with semaphore:
            try:
                raw = await _fetch_filing_text(ev["rcept_no"])
            except Exception:
                raw = ""
        ev["body"] = " ".join((raw or "").split())

    await asyncio.gather(*(_one(ev) for ev in events))


def _kis_get(base: str, token: str, key: str, secret: str, path: str, tr_id: str, params: dict) -> dict:
    url = f"{base}{path}?{urllib.parse.urlencode(params)}"
    return _http_json(url, headers={
        "authorization": f"Bearer {token}", "appkey": key, "appsecret": secret,
        "tr_id": tr_id, "custtype": "P",
    })


def _date_windows(bgn: str, end: str, days: int = 100) -> List[Tuple[str, str]]:
    """KIS 일봉 API 가 한 번에 100건까지만 주므로 기간을 쪼갠다."""
    start = datetime.strptime(bgn, "%Y%m%d")
    stop = datetime.strptime(end, "%Y%m%d")
    out = []
    while start <= stop:
        chunk_end = min(start + timedelta(days=days), stop)
        out.append((start.strftime("%Y%m%d"), chunk_end.strftime("%Y%m%d")))
        start = chunk_end + timedelta(days=1)
    return out


def fetch_daily_closes(base, token, key, secret, code, bgn, end) -> Dict[str, float]:
    closes: Dict[str, float] = {}
    for w_bgn, w_end in _date_windows(bgn, end):
        data = _kis_get(base, token, key, secret, KIS_ITEM_PATH, "FHKST03010100", {
            "FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": code,
            "FID_INPUT_DATE_1": w_bgn, "FID_INPUT_DATE_2": w_end,
            "FID_PERIOD_DIV_CODE": "D", "FID_ORG_ADJ_PRC": "0",
        })
        for row in data.get("output2") or []:
            d, c = row.get("stck_bsop_date"), row.get("stck_clpr")
            if d and c:
                closes[d] = float(c)
        time.sleep(0.5)
    return closes


def fetch_index_closes(base, token, key, secret, bgn, end) -> Dict[str, float]:
    closes: Dict[str, float] = {}
    # 지수 API 는 호출당 50행까지만 반환한다(종목 API 는 100행). 윈도우를 좁히지 않으면
    # 구간마다 오래된 거래일이 잘려 나가 지수 시계열에 구멍이 생긴다.
    for w_bgn, w_end in _date_windows(bgn, end, days=60):
        data = _kis_get(base, token, key, secret, KIS_INDEX_PATH, "FHKUP03500100", {
            "FID_COND_MRKT_DIV_CODE": "U", "FID_INPUT_ISCD": KOSPI_ISCD,
            "FID_INPUT_DATE_1": w_bgn, "FID_INPUT_DATE_2": w_end,
            "FID_PERIOD_DIV_CODE": "D",
        })
        for row in data.get("output2") or []:
            d, c = row.get("stck_bsop_date"), row.get("bstp_nmix_prpr")
            if d and c:
                closes[d] = float(c)
        time.sleep(0.5)
    return closes


def get_kis_token(base: str, key: str, secret: str) -> str:
    req = urllib.request.Request(
        f"{base}/oauth2/tokenP",
        data=json.dumps({
            "grant_type": "client_credentials", "appkey": key, "appsecret": secret,
        }).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))["access_token"]


def main() -> None:
    import asyncio
    from dotenv import load_dotenv

    from app.services.dart_source import fetch_corp_code_map

    parser = argparse.ArgumentParser()
    parser.add_argument("--bgn", default="20250101")
    parser.add_argument("--end", default="20260930")
    parser.add_argument("--band", type=float, default=0.5)
    parser.add_argument("--out", default="data/eval_set.json")
    parser.add_argument(
        "--with-body", action="store_true", help="공시 본문도 함께 수집한다(건당 1회 추가 호출)"
    )
    parser.add_argument("--token-cache", default=None, help="KIS 토큰 캐시 JSON 경로")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[3]
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    load_dotenv(root / "server" / ".env")

    dart_key = os.getenv("DART_API_KEY") or os.getenv("STOTRA_DART_API_KEY")
    kis_key = os.getenv("STOTRA_KIS_APP_KEY")
    kis_secret = os.getenv("STOTRA_KIS_APP_SECRET")
    kis_base = os.getenv("STOTRA_KIS_BASE_URL", "https://openapi.koreainvestment.com:9443")
    if not (dart_key and kis_key and kis_secret):
        raise SystemExit("DART_API_KEY / STOTRA_KIS_APP_KEY / STOTRA_KIS_APP_SECRET 필요")

    token = None
    if args.token_cache and Path(args.token_cache).exists():
        token = json.loads(Path(args.token_cache).read_text()).get("token")
    if not token:
        token = get_kis_token(kis_base, kis_key, kis_secret)
        if args.token_cache:
            Path(args.token_cache).write_text(json.dumps({"token": token}))

    print("KOSPI 지수 수집 중...", flush=True)
    index_closes = fetch_index_closes(kis_base, token, kis_key, kis_secret, args.bgn, args.end)
    print(f"  거래일 {len(index_closes)}일", flush=True)

    corp_map = asyncio.run(fetch_corp_code_map())

    cases: List[dict] = []
    skipped = 0
    for i, code in enumerate(KR_STOCKS, 1):
        corp_code = corp_map.get(code)
        if not corp_code:
            print(f"[{i}/{len(KR_STOCKS)}] {code}: corp_code 없음, skip", flush=True)
            continue
        events = fetch_events(dart_key, corp_code, args.bgn, args.end)
        if args.with_body and events:
            asyncio.run(fetch_event_bodies(events))
        closes = fetch_daily_closes(kis_base, token, kis_key, kis_secret, code, args.bgn, args.end)
        made = 0
        for ev in events:
            labeled = compute_label(closes, index_closes, ev["date"], band=args.band)
            if labeled is None:
                skipped += 1
                continue
            cases.append({
                "stock_code": code, "event_date": ev["date"], "event_title": ev["title"],
                "event_body": ev.get("body", ""),
                **labeled,
            })
            made += 1
        print(f"[{i}/{len(KR_STOCKS)}] {code}: 공시 {len(events)}건 → 케이스 {made}건 "
              f"(거래일 {len(closes)}일)", flush=True)
        time.sleep(0.2)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({
        "period": [args.bgn, args.end], "band": args.band,
        "label_definition": "공시 직전 거래일 종가 → 직후 거래일 종가, KOSPI 대비 초과수익률",
        "cases": cases,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    from collections import Counter
    dist = Counter(c["label"] for c in cases)
    print(f"\n완료: {out_path}  케이스 {len(cases)}건 (가격부족 skip {skipped}건)")
    print(f"  라벨 분포: {dict(dist)}")


if __name__ == "__main__":
    main()
