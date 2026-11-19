import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.config import settings, Settings
from app.tracking import registry, refresh
from app.marketdata import cold_start, poller
from app.triggers import event_listener


@pytest.fixture(autouse=True)
def isolated_state(monkeypatch):
    monkeypatch.setattr(registry, "_subscriptions", {})
    monkeypatch.setattr(refresh, "_tasks", {})
    monkeypatch.setattr(refresh, "_next_attempt", {})
    monkeypatch.setattr(refresh, "_ready", set())
    monkeypatch.setattr(refresh, "_generation_slot", asyncio.Semaphore(1))
    monkeypatch.setattr(cold_start, "_locks", {})
    monkeypatch.setattr(event_listener, "_last_state", {})
    monkeypatch.setattr(event_listener, "_last_run_at", {})
    monkeypatch.setattr(settings, "always_watch_symbols", ["005930", "000660", "005380", "035420", "035720"])
    monkeypatch.setattr(settings, "krx_closed_dates", "2026-12-25:휴장")


def test_fixed_five_survive_close_and_expired_dynamic_subscription(monkeypatch):
    registry.subscribe("005930")
    registry.subscribe("011070")
    registry.unsubscribe("005930")
    assert "005930" in registry.active_symbols() and "011070" in registry.active_symbols()
    monkeypatch.setattr(registry.time, "time", lambda: 10**12)
    assert registry.active_symbols() == settings.always_watch_symbols


def test_symbols_must_be_domestic_and_polling_bounded():
    with pytest.raises(ValueError):
        Settings(_env_file=None, always_watch_symbols=["AAPL"])
    with pytest.raises(ValueError):
        Settings(_env_file=None, poll_interval_sec=0)


@pytest.mark.parametrize("stamp,expected", [
    ("2026-11-17T00:00:00+00:00", True),
    ("2026-11-17T06:29:59+00:00", True),
    ("2026-11-17T06:30:00+00:00", False),
    ("2026-11-16T23:59:59+00:00", False),
    ("2026-11-21T01:00:00+00:00", False),
    ("2026-12-25T01:00:00+00:00", False),
])
def test_market_clock_uses_kst_weekends_and_configured_holidays(stamp, expected):
    assert poller.market_is_open(datetime.fromisoformat(stamp)) is expected


def test_startup_prepares_five_without_browser_but_closed_market_does_not_poll():
    with patch.object(poller, "request_refresh") as request, patch.object(poller, "market_is_open", return_value=False), patch.object(poller, "poll_symbol", new_callable=AsyncMock) as poll:
        asyncio.run(poller.poll_once())
        assert [call.args[0] for call in request.call_args_list] == settings.always_watch_symbols
        poll.assert_not_awaited()


def test_regular_session_polls_fixed_and_dynamic_symbols():
    registry.subscribe("011070")
    with patch.object(poller, "request_refresh"), patch.object(poller, "market_is_open", return_value=True), patch.object(poller, "poll_symbol", new_callable=AsyncMock) as poll:
        asyncio.run(poller.poll_once())
        assert poll.await_count == 6


def test_single_flight_and_global_serial_execution():
    async def scenario():
        entered = asyncio.Event()
        release = asyncio.Event()
        running = 0
        maximum = 0
        async def generate(symbol, **kwargs):
            nonlocal running, maximum
            running += 1
            maximum = max(maximum, running)
            entered.set()
            await release.wait()
            running -= 1
        with patch.object(cold_start, "cold_start", side_effect=generate) as generate_mock:
            refresh.request_refresh("005930")
            refresh.request_refresh("005930")
            refresh.request_refresh("000660")
            await entered.wait()
            assert generate_mock.call_count == 1
            release.set()
            await asyncio.gather(*list(refresh._tasks.values()))
            assert generate_mock.call_count == 2 and maximum == 1
            assert set(refresh.prepared_symbols()) == {"005930", "000660"}
    asyncio.run(scenario())


def test_failed_generation_is_backed_off_and_retryable(monkeypatch):
    async def scenario():
        with patch.object(cold_start, "cold_start", side_effect=RuntimeError("unavailable")):
            refresh.request_refresh("005930")
            await asyncio.gather(*list(refresh._tasks.values()))
            assert not refresh.request_refresh("005930")
            assert "005930" not in refresh.prepared_symbols()
        refresh._next_attempt["005930"] = 0
        with patch.object(cold_start, "cold_start", new_callable=AsyncMock):
            assert refresh.request_refresh("005930")
            await asyncio.gather(*list(refresh._tasks.values()))
            assert "005930" in refresh.prepared_symbols()
    asyncio.run(scenario())


def test_recent_db_result_blocks_regeneration_even_after_restart():
    existing = {"time": datetime.now(timezone.utc).isoformat(), "market_data": {"price": 100}}
    with patch.object(cold_start, "get_latest_judgment", new=AsyncMock(return_value=existing)), patch.object(cold_start, "run_judgment_pipeline", new_callable=AsyncMock) as generate, patch.object(poller, "build_tick", new_callable=AsyncMock) as build:
        assert asyncio.run(cold_start.cold_start("005930")) == existing
        generate.assert_not_awaited()
        build.assert_not_awaited()


def test_identical_data_does_not_create_repeated_history():
    tick = {"price": 100, "volume_ratio": 3, "golden_cross": True}
    existing = {"time": "2020-01-01T00:00:00+00:00", "market_data": tick}
    with patch.object(cold_start, "get_latest_judgment", new=AsyncMock(return_value=existing)), patch.object(cold_start, "run_judgment_pipeline", new_callable=AsyncMock) as generate:
        assert asyncio.run(cold_start.cold_start("005930", tick)) == existing
        generate.assert_not_awaited()


def test_unchanged_static_signals_do_not_retrigger_and_gradual_price_change_does():
    async def scenario():
        event_listener.seed_state("005930", {"price": 100, "volume_ratio": 3, "golden_cross": True})
        with patch.object(refresh, "request_refresh") as request:
            for price in [100, 100.2, 100.4]:
                await event_listener.on_market_tick("005930", {"price": price, "volume_ratio": 3, "golden_cross": True})
            request.assert_not_called()
            await event_listener.on_market_tick("005930", {"price": 100.6, "volume_ratio": 3, "golden_cross": True})
            assert request.call_count == 1
    asyncio.run(scenario())


def test_cached_http_result_available_while_background_ai_is_blocked(monkeypatch):
    from app.main import app
    from app.api.routes import judgment
    monkeypatch.setenv("EXHIBITION_SERVICE_KEY", "background-test-only")
    async def scenario():
        release = asyncio.Event()
        existing = {"symbol":"005930", "time":"2026-11-01T00:00:00+00:00", "judge":"관망", "confidence":60,
                    "probabilities":{"매수":20,"매도":20,"관망":60}, "reason":"기존 저장된 결과", "factors":[]}
        async def generate(*args, **kwargs):
            await release.wait()
            existing["time"] = "2026-11-17T00:00:00+00:00"
            existing["reason"] = "갱신된 결과"
        with patch.object(cold_start, "cold_start", side_effect=generate), patch.object(judgment, "get_latest_judgment", new=AsyncMock(side_effect=lambda symbol: existing)):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url="http://test",headers={"x-service-key":"background-test-only"}) as client:
                watch = await asyncio.wait_for(client.post('/judgment/005930/watch'), timeout=1)
                assert watch.status_code == 200 and watch.json()["refreshing"]
                response = await asyncio.wait_for(client.get('/judgment/005930'), timeout=1)
                assert response.json()["summary"] == "기존 저장된 결과"
                assert response.json()["refreshing"]
                close = await client.delete('/judgment/005930/watch')
                assert close.json()["status"] == "always_watched"
                release.set()
                await asyncio.gather(*list(refresh._tasks.values()))
                response = await client.get('/judgment/005930')
                assert response.json()["summary"] == "갱신된 결과"
                assert not response.json()["refreshing"]
    asyncio.run(scenario())


def test_shutdown_cancels_pending_work():
    async def scenario():
        async def never(*args, **kwargs):
            await asyncio.Event().wait()
        with patch.object(cold_start, "cold_start", side_effect=never):
            refresh.request_refresh("005930")
            await asyncio.sleep(0)
            await refresh.stop_refresh_tasks()
            assert not refresh.refreshing_symbols()
    asyncio.run(scenario())
