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

    def test_gibberish_rationale_cannot_create_high_final_m4(self) -> None:
        session = self.service.start_session("user-gibberish", "semiconductor")
        session_id = session["session_id"]
        result = None
        for _ in range(1, 7):
            view = self.service.get_turn_view(session_id)
            answers = self.answers_for(view["questions"])
            for answer in answers:
                if answer["text"]:
                    answer["text"] = "1"
            result = self.service.submit_turn(session_id, answers)

        self.assertIsNotNone(result)
        final = self.service.get_evaluation(session_id)
        averages = final["decision_evaluation"]["metric_averages"]
        for metric_id in ("M1", "M2", "M3", "M4", "M5"):
            self.assertLessEqual(averages[metric_id], 2.0, metric_id)
        evaluations = self.repository.list_turn_evaluations(session_id)
        first_actions = evaluations[0]["scorecard"]["feedback"]["next_actions"]
        self.assertEqual(first_actions[0]["guidance_code"], "AVOID_EMPTY_RATIONALE")
        second_reviews = evaluations[1]["scorecard"]["feedback"][
            "previous_guidance_review"
        ]
        self.assertEqual(second_reviews[0]["status"], "REPEATED")
        self.assertGreaterEqual(final["coaching_progress"]["repeated_count"], 5)
        self.assertIn("같은 문제가 반복", final["feedback"]["coaching_summary"])

    def test_previous_guidance_is_shown_and_followed_next_turn(self) -> None:
        session = self.service.start_session("user-coaching", "semiconductor")
        session_id = session["session_id"]
        first_view = self.service.get_turn_view(session_id)
        first_answers = self.answers_for(first_view["questions"])
        for answer in first_answers:
            if answer["text"]:
                answer["text"] = "1"
        self.service.submit_turn(session_id, first_answers)

        second_view = self.service.get_turn_view(session_id)
        reminders = second_view["coaching"]["reminders"]
        self.assertEqual(reminders[0]["guidance_code"], "AVOID_EMPTY_RATIONALE")

        second_answers = self.answers_for(second_view["questions"])
        for answer in second_answers:
            if answer["text"]:
                answer["text"] = (
                    "엔비디아 실적 호조는 AI 수요 확인에 긍정적이지만 주가가 이미 "
                    "급등해 추격매수 위험이 있으므로 보유 없이 관망하겠습니다."
                )
        result = self.service.submit_turn(session_id, second_answers)
        reviews = result["turn_evaluation"]["scorecard"]["feedback"][
            "previous_guidance_review"
        ]
        empty_rationale_review = next(
            item
            for item in reviews
            if item["guidance_code"] == "AVOID_EMPTY_RATIONALE"
        )
        self.assertEqual(empty_rationale_review["status"], "FOLLOWED")
        self.assertIn("조언을 이번 판단에 반영", result["turn_evaluation"]["scorecard"]["feedback"]["explanation"])


if __name__ == "__main__":
    unittest.main()
