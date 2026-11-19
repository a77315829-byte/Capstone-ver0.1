import asyncio
from unittest.mock import AsyncMock, Mock, patch

from app.main import health


def test_health_checks_database_instead_of_only_process_liveness():
    database = Mock(command=AsyncMock(return_value={"ok": 1}))
    with patch("app.main.get_database", return_value=database):
        result = asyncio.run(health())
    assert result["status"] == "ok" and result["database"] == "connected"
    assert len(result["monitoring"]["always_symbols"]) == 5
    database.command.assert_awaited_once_with("ping")


def test_health_reports_database_failure_without_leaking_connection_details():
    with patch("app.main.get_database", side_effect=RuntimeError("private connection details")):
        result = asyncio.run(health())
    assert result == {"status": "degraded", "database": "unavailable", "fallback_available": True}
