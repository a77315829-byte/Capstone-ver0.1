"""시세 stub / 실시간 시세 병합.

기본은 고정 stub 데이터이며, 외부 API 호출을 하지 않는다.
Node backend(KIS 연동)가 SimulationRequest.stock_data 로 실시간 값을 전달하면
필드별로 있는 값만 stub 위에 덮어쓰고 data_source="external_api", is_realtime=True 로
표시한다(예: KIS 가 시가총액을 못 주면 volume_trend/market_cap_trillion 은 stub 값 유지).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Optional

from ..schemas.analysis import CurrentStockContext, DataSource
from ..schemas.request import ExternalStockData, SelectedStock

# 종목코드별 stub (docs/test_fixtures.json 의 stock_stub_data 기반)
_STUB_STOCKS: Dict[str, dict] = {
    "005930": {
        "name": "삼성전자",
        "industry": "반도체",
        "current_price": 78600,
        "daily_change_rate": -1.5,
        "volume_trend": "increasing",
        "market_cap_trillion": 470.0,
    },
    "000660": {
        "name": "SK하이닉스",
        "industry": "반도체",
        "current_price": 178000,
        "daily_change_rate": 2.3,
        "volume_trend": "increasing",
        "market_cap_trillion": 130.0,
    },
}

# 알 수 없는 종목용 기본 stub
_DEFAULT_STUB = {
    "industry": "기타",
    "current_price": 50000,
    "daily_change_rate": 0.0,
    "volume_trend": "stable",
    "market_cap_trillion": 10.0,
}


def get_stock_context_stub(selected_stock: SelectedStock) -> CurrentStockContext:
    """선택 종목의 현재 상태 stub 을 반환한다.

    알려진 종목(005930, 000660)은 고정 stub, 그 외에는 default stub 을 사용한다.
    항상 data_source="stub", is_realtime=False, observed_at=None.
    """
    stub = _STUB_STOCKS.get(selected_stock.code)

    if stub is not None:
        name = stub["name"]
        industry = stub["industry"]
        current_price = stub["current_price"]
        daily_change_rate = stub["daily_change_rate"]
        volume_trend = stub["volume_trend"]
        market_cap_trillion = stub["market_cap_trillion"]
    else:
        name = selected_stock.name
        industry = _DEFAULT_STUB["industry"]
        current_price = _DEFAULT_STUB["current_price"]
        daily_change_rate = _DEFAULT_STUB["daily_change_rate"]
        volume_trend = _DEFAULT_STUB["volume_trend"]
        market_cap_trillion = _DEFAULT_STUB["market_cap_trillion"]

    return CurrentStockContext(
        code=selected_stock.code,
        name=name,
        industry=industry,
        current_price=current_price,
        daily_change_rate=daily_change_rate,
        volume_trend=volume_trend,
        market_cap_trillion=market_cap_trillion,
        data_source=DataSource.STUB,
        is_realtime=False,
        observed_at=None,
    )


def get_stock_context(
    selected_stock: SelectedStock,
    external: Optional[ExternalStockData],
) -> CurrentStockContext:
    """external 에 실시간 현재가가 있으면 그 값으로 덮어쓰고, 없으면 stub 을 그대로 반환한다."""
    stub = get_stock_context_stub(selected_stock)
    if external is None or external.current_price is None:
        return stub

    update = {
        "current_price": external.current_price,
        "daily_change_rate": external.daily_change_rate,
        "data_source": DataSource.EXTERNAL_API,
        "is_realtime": True,
        "observed_at": external.observed_at or datetime.now(timezone.utc),
    }
    if external.volume_trend is not None:
        update["volume_trend"] = external.volume_trend
    if external.market_cap_trillion is not None:
        update["market_cap_trillion"] = external.market_cap_trillion

    return stub.model_copy(update=update)
