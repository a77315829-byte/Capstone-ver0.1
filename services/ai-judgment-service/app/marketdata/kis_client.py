"""KIS(한국투자증권) 모의투자 Open API REST 클라이언트. 시세 조회 전용이며
주문 관련 엔드포인트는 다루지 않는다 (.env에 계좌번호가 없어 애초에 불가능하기도 하다).

주의: 이 개발 환경은 아웃바운드 네트워크가 KIS 서버 도메인에서 TLS 핸드셰이크
이후 응답 없이 막혀있어(지역 제한으로 추정) 실제 호출로 필드명을 검증하지 못했다.
아래 tr_id/필드명은 KIS Open API 공식 문서 기준으로 작성한 것이므로,
실사용 전 반드시 scripts/kis_probe.py를 직접 실행해 원시 응답과 대조해야 한다.
"""
from datetime import datetime, timedelta

import httpx

from app.config import settings

TOKEN_PATH = "/oauth2/tokenP"
PRICE_PATH = "/uapi/domestic-stock/v1/quotations/inquire-price"
DAILY_CHART_PATH = "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"
INVESTOR_PATH = "/uapi/domestic-stock/v1/quotations/inquire-investor"

_cached_token: str | None = None
_token_expires_at: datetime | None = None


class KisApiError(RuntimeError):
    """KIS 응답 rt_cd != '0' 이거나 예상한 필드가 없을 때."""


async def _get_access_token(client: httpx.AsyncClient) -> str:
    global _cached_token, _token_expires_at

    if _cached_token and _token_expires_at and datetime.now() < _token_expires_at:
        return _cached_token

    response = await client.post(
        TOKEN_PATH,
        json={
            "grant_type": "client_credentials",
            "appkey": settings.kis_app_key,
            "appsecret": settings.kis_app_secret,
        },
    )
    response.raise_for_status()
    data = response.json()
    if "access_token" not in data:
        raise KisApiError(f"토큰 발급 실패: {data}")

    _cached_token = data["access_token"]
    # 만료 5분 전에 미리 재발급하도록 여유를 둔다. KIS는 토큰 재발급을 자주 하면
    # (대략 1분 내 재요청 시) 에러를 반환하므로 캐싱이 필수.
    expires_in = int(data.get("expires_in", 86400))
    _token_expires_at = datetime.now() + timedelta(seconds=expires_in - 300)
    return _cached_token


def _headers(token: str, tr_id: str) -> dict:
    return {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "appkey": settings.kis_app_key,
        "appsecret": settings.kis_app_secret,
        "tr_id": tr_id,
        "custtype": "P",
    }


async def _get(client: httpx.AsyncClient, path: str, tr_id: str, params: dict) -> dict:
    token = await _get_access_token(client)
    response = await client.get(path, headers=_headers(token, tr_id), params=params)
    response.raise_for_status()
    data = response.json()
    if data.get("rt_cd") != "0":
        raise KisApiError(f"{path} 실패 ({tr_id}): {data.get('msg1')}")
    return data


async def get_current_price(symbol: str) -> float:
    """현재가(원) 조회. tr_id FHKST01010100."""
    async with httpx.AsyncClient(base_url=settings.kis_base_url, timeout=10.0) as client:
        data = await _get(client, PRICE_PATH, "FHKST01010100", {
            "fid_cond_mrkt_div_code": "J",
            "fid_input_iscd": symbol,
        })
    return float(data["output"]["stck_prpr"])


async def get_daily_closes(symbol: str, days: int = 30) -> list[float]:
    """최근 종가 리스트 (RSI-14 계산용). 오래된 날짜 -> 최신 날짜 순으로 반환.
    tr_id FHKST03010100.
    """
    end = datetime.now()
    start = end - timedelta(days=days * 2)  # 주말/휴장일 감안해 넉넉히 조회
    async with httpx.AsyncClient(base_url=settings.kis_base_url, timeout=10.0) as client:
        data = await _get(client, DAILY_CHART_PATH, "FHKST03010100", {
            "fid_cond_mrkt_div_code": "J",
            "fid_input_iscd": symbol,
            "fid_input_date_1": start.strftime("%Y%m%d"),
            "fid_input_date_2": end.strftime("%Y%m%d"),
            "fid_period_div_code": "D",
            "fid_org_adj_prc": "1",
        })
    rows = sorted(data.get("output2", []), key=lambda r: r["stck_bsop_date"])
    return [float(r["stck_clpr"]) for r in rows][-days:]


async def get_foreign_daily_net_buy(symbol: str, days: int = 5) -> list[float]:
    """최근 며칠간 외국인 순매수 수량. 오래된 날짜 -> 최신 날짜 순으로 반환.
    tr_id FHKST01010900.
    """
    async with httpx.AsyncClient(base_url=settings.kis_base_url, timeout=10.0) as client:
        data = await _get(client, INVESTOR_PATH, "FHKST01010900", {
            "fid_cond_mrkt_div_code": "J",
            "fid_input_iscd": symbol,
        })
    rows = sorted(data.get("output", []), key=lambda r: r["stck_bsop_date"])
    return [float(r["frgn_ntby_qty"]) for r in rows][-days:]
