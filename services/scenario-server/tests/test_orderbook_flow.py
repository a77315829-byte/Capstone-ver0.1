from __future__ import annotations

import unittest

from data.app_repository import AppRepository
from data.store import MemoryStore
from play.session_service import ScenarioSessionService
from scripts.seed_database import seed_scenario


class OrderbookFlowTest(unittest.TestCase):
    def setUp(self) -> None:
        self.store = MemoryStore()
        seed_scenario("semiconductor", store=self.store)
        self.repository = AppRepository(self.store)
        self.repository.store.replace_one(
            "daily_prices",
            {"asset_id": "000660", "trade_date": "2024-02-02"},
            {
                "schema_version": 1,
                "asset_id": "000660",
                "trade_date": "2024-02-02",
                "open": 9_900,
                "high": 10_200,
                "low": 9_800,
                "close": 10_000,
                "volume": 100_000,
                "source": "TEST_FIXTURE",
            },
            upsert=True,
        )
        self.service = ScenarioSessionService(self.repository)

    def _start(self, user_id: str) -> tuple[str, dict]:
        session = self.service.start_session(user_id, "semiconductor")
        session_id = session["session_id"]
        return session_id, self.service.get_orderbook(session_id, "000660")

    def test_orderbook_is_generated_once_and_has_ten_levels(self) -> None:
        session_id, first = self._start("orderbook-stable")
        second = self.service.get_orderbook(session_id, "000660")

        self.assertTrue(first["is_simulated"])
        self.assertEqual(first["source"], "SIMULATED_FROM_DAILY_OHLCV")
        self.assertEqual(len(first["bids"]), 10)
        self.assertEqual(len(first["asks"]), 10)
        self.assertLess(first["bids"][0]["price"], first["reference_price"])
        self.assertGreater(first["asks"][0]["price"], first["reference_price"])
        self.assertEqual(first["snapshot_id"], second["snapshot_id"])
        snapshots = self.store.find_many("order_book_snapshots", {})
        self.assertEqual(len(snapshots), 1)

    def test_market_order_consumes_levels_and_updates_portfolio(self) -> None:
        session_id, before = self._start("orderbook-market")
        top_quantity = before["asks"][0]["quantity"]
        requested = top_quantity + 2

        result = self.service.place_order(
            session_id,
            asset_id="000660",
            side="BUY",
            quantity=requested,
        )

        order = result["order"]
        self.assertEqual(order["order_type"], "MARKET")
        self.assertEqual(order["status"], "FILLED")
        self.assertEqual(order["filled_quantity"], requested)
        self.assertEqual(len(order["fills"]), 2)
        self.assertEqual(result["portfolio"]["positions"][0]["quantity"], requested)
        self.assertEqual(result["orderbook"]["asks"][0]["quantity"], 0)
        self.assertEqual(
            result["orderbook"]["asks"][1]["quantity"],
            before["asks"][1]["quantity"] - 2,
        )

    def test_liquidity_is_shared_by_snapshot_but_consumed_per_session(self) -> None:
        first_session, first_book = self._start("orderbook-session-a")
        second_session, second_book = self._start("orderbook-session-b")
        self.assertEqual(first_book["snapshot_id"], second_book["snapshot_id"])

        self.service.place_order(
            first_session,
            asset_id="000660",
            side="BUY",
            quantity=2,
        )
        first_after = self.service.get_orderbook(first_session, "000660")
        second_after = self.service.get_orderbook(second_session, "000660")

        self.assertEqual(
            first_after["asks"][0]["quantity"],
            first_book["asks"][0]["quantity"] - 2,
        )
        self.assertEqual(
            second_after["asks"][0]["quantity"],
            second_book["asks"][0]["quantity"],
        )

    def test_non_marketable_limit_order_is_cancelled_without_cash_change(self) -> None:
        session_id, book = self._start("orderbook-limit-cancel")
        before_session = self.repository.get_session(session_id)
        result = self.service.place_order(
            session_id,
            asset_id="000660",
            side="BUY",
            quantity=5,
            order_type="LIMIT",
            limit_price=book["bids"][0]["price"],
        )

        self.assertEqual(result["order"]["status"], "CANCELLED")
        self.assertEqual(result["order"]["filled_quantity"], 0)
        after_session = self.repository.get_session(session_id)
        self.assertEqual(after_session["cash"], before_session["cash"])
        self.assertEqual(after_session["revision"], before_session["revision"])
        turn_view = self.service.get_turn_view(session_id)
        self.assertEqual(turn_view["orders"][0]["status"], "CANCELLED")

    def test_marketable_limit_order_fills_at_best_available_price(self) -> None:
        session_id, book = self._start("orderbook-limit-fill")
        best_ask = book["asks"][0]["price"]
        result = self.service.place_order(
            session_id,
            asset_id="000660",
            side="BUY",
            quantity=5,
            order_type="LIMIT",
            limit_price=best_ask,
        )

        order = result["order"]
        self.assertEqual(order["status"], "FILLED")
        self.assertEqual(order["execution_price"], best_ask)
        self.assertEqual(order["limit_price"], best_ask)

    def test_order_larger_than_visible_depth_is_partially_filled(self) -> None:
        session_id, book = self._start("orderbook-partial")
        visible_ask_quantity = sum(level["quantity"] for level in book["asks"])
        requested = visible_ask_quantity + 10
        result = self.service.place_order(
            session_id,
            asset_id="000660",
            side="BUY",
            quantity=requested,
        )

        order = result["order"]
        self.assertEqual(order["status"], "PARTIALLY_FILLED")
        self.assertEqual(order["filled_quantity"], visible_ask_quantity)
        self.assertEqual(order["cancelled_quantity"], 10)
        self.assertTrue(all(level["quantity"] == 0 for level in result["orderbook"]["asks"]))

    def test_sell_uses_bid_book_and_closes_position(self) -> None:
        session_id, _ = self._start("orderbook-sell")
        self.service.place_order(
            session_id,
            asset_id="000660",
            side="BUY",
            quantity=5,
        )
        sell = self.service.place_order(
            session_id,
            asset_id="000660",
            side="SELL",
            quantity=5,
        )

        self.assertEqual(sell["order"]["status"], "FILLED")
        self.assertEqual(sell["portfolio"]["positions"], [])
        self.assertLess(sell["order"]["realized_pnl"], 0)

    def test_limit_price_must_match_tick_size(self) -> None:
        session_id, _ = self._start("orderbook-invalid-tick")
        with self.assertRaisesRegex(Exception, "호가 단위"):
            self.service.place_order(
                session_id,
                asset_id="000660",
                side="BUY",
                quantity=1,
                order_type="LIMIT",
                limit_price=10_001,
            )


if __name__ == "__main__":
    unittest.main()
