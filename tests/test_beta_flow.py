from __future__ import annotations

import unittest
from unittest.mock import patch

import config
from data.app_repository import AppRepository
from data.store import MemoryStore
from play.session_service import ScenarioSessionService
from scripts.seed_database import seed_scenario


TURN_DATES = [
    "2024-02-01",
    "2024-02-02",
    "2024-02-22",
    "2024-03-19",
    "2024-04-19",
    "2024-05-23",
    "2024-07-01",
    "2024-07-19",
]


class BetaFlowTest(unittest.TestCase):
    def setUp(self) -> None:
        gemini_key_patch = patch.object(config, "GEMINI_API_KEY", "")
        gemini_key_patch.start()
        self.addCleanup(gemini_key_patch.stop)
        self.store = MemoryStore()
        seed_scenario("semiconductor", store=self.store)
        self.repository = AppRepository(self.store)
        scenario = self.repository.get_scenario("semiconductor")
        for asset_index, asset_id in enumerate(scenario["asset_ids"]):
            base_price = 10_000 + asset_index * 1_000
            if asset_id == "000660":
                base_price = 100_000
            for date_index, trade_date in enumerate(TURN_DATES):
                close = base_price + date_index * (2_000 if asset_id == "000660" else 100)
                document = {
                    "schema_version": 1,
                    "asset_id": asset_id,
                    "trade_date": trade_date,
                    "open": close - 100,
                    "high": close + 200,
                    "low": close - 200,
                    "close": close,
                    "volume": 1_000_000 + date_index,
                    "source": "TEST_FIXTURE",
                }
                self.store.replace_one(
                    "daily_prices",
                    {"asset_id": asset_id, "trade_date": trade_date},
                    document,
                    upsert=True,
                )
        self.service = ScenarioSessionService(self.repository)

    @staticmethod
    def answers_for(questions: list[dict]) -> list[dict]:
        answers = []
        for question in questions:
            if question.get("type") == "free":
                answers.append(
                    {
                        "question_id": question["question_id"],
                        "selected": [],
                        "text": "호재와 위험을 함께 고려해 비중을 조절했다.",
                    }
                )
            else:
                answers.append(
                    {
                        "question_id": question["question_id"],
                        "selected": [question["options"][0]],
                        "text": "",
                    }
                )
        return answers

    def test_six_turns_create_mypage_evaluation(self) -> None:
        session = self.service.start_session("user-1", "semiconductor")
        session_id = session["session_id"]
        first_view = self.service.get_turn_view(session_id)
        self.assertEqual(first_view["progress"]["market_date"], "2024-02-02")
        self.assertEqual(len(first_view["assets"]), 20)
        self.assertTrue(first_view["assets"][0]["data_available"])

        order_result = self.service.place_order(
            session_id,
            asset_id="000660",
            side="BUY",
            quantity=10,
        )
        self.assertEqual(order_result["order"]["status"], "FILLED")

        result = None
        for expected_turn in range(1, 7):
            view = self.service.get_turn_view(session_id)
            self.assertEqual(view["progress"]["current_turn"], expected_turn)
            result = self.service.submit_turn(
                session_id,
                self.answers_for(view["questions"]),
            )

        self.assertIsNotNone(result)
        self.assertEqual(result["session"]["status"], "COMPLETED")
        self.assertIsNotNone(result["final_evaluation"])
        final = self.service.get_evaluation(session_id)
        self.assertEqual(final["user_id"], "user-1")
        self.assertEqual(len(final["decision_evaluation"]["timeline"]), 6)
        self.assertIn("cumulative_return_pct", final["portfolio_analysis"])
        profile = self.repository.get_user_profile("user-1")
        self.assertEqual(profile["completed_scenario_count"], 1)
        summaries = self.repository.list_user_evaluations("user-1")
        self.assertEqual(len(summaries), 1)

    def test_order_rejects_insufficient_cash(self) -> None:
        session = self.service.start_session("user-2", "semiconductor")
        with self.assertRaisesRegex(Exception, "보유현금"):
            self.service.place_order(
                session["session_id"],
                asset_id="000660",
                side="BUY",
                quantity=1_000_000,
            )

    def test_sell_keeps_realized_profit_after_position_is_closed(self) -> None:
        session = self.service.start_session("user-3", "semiconductor")
        session_id = session["session_id"]
        self.service.place_order(
            session_id,
            asset_id="000660",
            side="BUY",
            quantity=1,
        )
        buy_session = self.repository.get_session(session_id)
        # 같은 턴 종가 매도라 실현손익은 0이지만, 전량 매도 뒤에도 자산별 장부가 유지되어야 한다.
        sell_result = self.service.place_order(
            session_id,
            asset_id="000660",
            side="SELL",
            quantity=1,
        )
        sold_session = self.repository.get_session(session_id)
        self.assertEqual(sold_session["positions"], [])
        self.assertIn("000660", sold_session["realized_pnl_by_asset"])
        self.assertEqual(
            sold_session["cash"],
            buy_session["cash"] + sell_result["order"]["amount"],
        )


if __name__ == "__main__":
    unittest.main()
