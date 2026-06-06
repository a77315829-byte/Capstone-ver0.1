"""시세 stub 테스트."""

from app.schemas.analysis import CurrentStockContext, DataSource
from app.schemas.request import SelectedStock
from app.services.stock_data import get_stock_context_stub


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
