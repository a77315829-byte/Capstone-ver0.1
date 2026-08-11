"""시세 stub / 실시간 시세 병합 테스트."""

from datetime import datetime, timezone

from app.schemas.analysis import CurrentStockContext, DataSource
from app.schemas.request import ExternalStockData, SelectedStock
from app.services.stock_data import get_stock_context, get_stock_context_stub


def test_samsung_stub():
    ctx = get_stock_context_stub(SelectedStock(code="005930", name="삼성전자"))
    assert isinstance(ctx, CurrentStockContext)
    assert ctx.code == "005930"
    assert ctx.name == "삼성전자"
    assert ctx.industry == "반도체"
    assert ctx.current_price == 78600
    assert ctx.data_source == DataSource.STUB
    assert ctx.is_realtime is False
    assert ctx.observed_at is None


def test_skhynix_stub():
    ctx = get_stock_context_stub(SelectedStock(code="000660", name="SK하이닉스"))
    assert ctx.code == "000660"
    assert ctx.name == "SK하이닉스"
    assert ctx.current_price == 178000
    assert ctx.data_source == DataSource.STUB
    assert ctx.is_realtime is False
    assert ctx.observed_at is None


def test_unknown_stock_uses_default_stub():
    ctx = get_stock_context_stub(SelectedStock(code="999999", name="테스트종목"))
    assert isinstance(ctx, CurrentStockContext)
    assert ctx.code == "999999"
    assert ctx.industry == "기타"
    assert ctx.current_price == 50000
    assert ctx.volume_trend == "stable"
    assert ctx.data_source == DataSource.STUB
    assert ctx.is_realtime is False
    assert ctx.observed_at is None


def test_stub_is_never_realtime():
    for code in ("005930", "000660", "111111"):
        ctx = get_stock_context_stub(SelectedStock(code=code, name="x"))
        assert ctx.data_source == DataSource.STUB
        assert ctx.is_realtime is False
        assert ctx.observed_at is None


def test_get_stock_context_without_external_data_uses_stub():
    ctx = get_stock_context(SelectedStock(code="005930", name="삼성전자"), None)
    assert ctx.data_source == DataSource.STUB
    assert ctx.is_realtime is False
    assert ctx.current_price == 78600


def test_get_stock_context_with_external_data_uses_realtime_price():
    observed_at = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    external = ExternalStockData(
        current_price=81000, daily_change_rate=3.1, observed_at=observed_at
    )
    ctx = get_stock_context(SelectedStock(code="005930", name="삼성전자"), external)
    assert ctx.data_source == DataSource.EXTERNAL_API
    assert ctx.is_realtime is True
    assert ctx.current_price == 81000
    assert ctx.daily_change_rate == 3.1
    assert ctx.observed_at == observed_at
    # 산업/이름은 stub 매핑을 그대로 사용
    assert ctx.industry == "반도체"
    assert ctx.name == "삼성전자"
    # volume_trend/market_cap_trillion 을 안 주면 stub 값을 유지한다
    assert ctx.volume_trend == "increasing"
    assert ctx.market_cap_trillion == 470.0


def test_get_stock_context_overrides_volume_trend_and_market_cap_when_given():
    external = ExternalStockData(
        current_price=81000,
        daily_change_rate=3.1,
        volume_trend="decreasing",
        market_cap_trillion=490.5,
    )
    ctx = get_stock_context(SelectedStock(code="005930", name="삼성전자"), external)
    assert ctx.volume_trend == "decreasing"
    assert ctx.market_cap_trillion == 490.5


def test_get_stock_context_falls_back_to_stub_when_price_missing():
    external = ExternalStockData(current_price=None, daily_change_rate=None)
    ctx = get_stock_context(SelectedStock(code="005930", name="삼성전자"), external)
    assert ctx.data_source == DataSource.STUB
    assert ctx.is_realtime is False
