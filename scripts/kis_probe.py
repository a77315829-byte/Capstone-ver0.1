"""KIS 응답 필드를 실제로 확인하기 위한 진단 스크립트.

app/marketdata/kis_client.py는 이 개발 환경에서 KIS 서버로 직접 검증하지 못했다
(아웃바운드가 TLS 핸드셰이크 이후 응답 없이 막혀있음 - 지역 제한으로 추정).
이 스크립트를 실제 네트워크가 되는 환경(로컬 PC 등)에서 실행해 원시 JSON을 눈으로
확인하고, kis_client.py가 읽는 필드명(stck_prpr, stck_clpr, frgn_ntby_qty 등)이
실제 응답과 일치하는지 대조해야 한다. 다르면 kis_client.py의 필드명만 고치면 된다.

실행: python -m scripts.kis_probe
"""
import asyncio
import json

from app.marketdata import kis_client

SYMBOL = "011070"  # LG이노텍


async def main():
    print("=== 현재가 조회 (inquire-price) ===")
    try:
        async with kis_client.httpx.AsyncClient(base_url=kis_client.settings.kis_base_url, timeout=10.0) as client:
            token = await kis_client._get_access_token(client)
            print(f"토큰 발급 성공 (길이 {len(token)})")

            price_data = await kis_client._get(client, kis_client.PRICE_PATH, "FHKST01010100", {
                "fid_cond_mrkt_div_code": "J", "fid_input_iscd": SYMBOL,
            })
            print(json.dumps(price_data, ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"실패: {e!r}")
        print("(개발 샌드박스에서는 KIS 서버로 아웃바운드 자체가 막혀있어 여기서 항상 실패했다. "
              "실제 네트워크가 되는 PC/서버에서 실행해야 검증 가능하다.)")
        return

    print("\n=== 일별 시세 (inquire-daily-itemchartprice) ===")
    try:
        closes = await kis_client.get_daily_closes(SYMBOL, days=20)
        print(f"종가 {len(closes)}개: {closes}")
    except Exception as e:
        print(f"실패: {e}")

    print("\n=== 투자자매매동향 (inquire-investor) ===")
    try:
        foreign_flow = await kis_client.get_foreign_daily_net_buy(SYMBOL, days=5)
        print(f"외국인 순매수 {len(foreign_flow)}개: {foreign_flow}")
    except Exception as e:
        print(f"실패: {e}")


if __name__ == "__main__":
    asyncio.run(main())
