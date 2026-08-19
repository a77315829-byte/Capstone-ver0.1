from __future__ import annotations

import unittest
from unittest.mock import patch

import config
from data.app_repository import AppRepository
from data.store import MemoryStore
from play.session_service import ScenarioSessionService
from scripts.seed_database import seed_scenario


TURN_DATES = [
    "2023-03-10",
    "2023-03-13",
    "2023-03-16",
    "2023-03-28",
    "2023-04-07",
]

ACTUAL_CLOSES = {
    "105560": [49_700, 50_300, 48_050, 47_900, 47_000],
    "055550": [35_800, 36_050, 34_450, 35_950, 34_900],
    "086790": [42_250, 42_700, 40_650, 40_750, 40_800],
    "091170": [6_310, 6_375, 6_150, 6_225, 6_185],
    "069500": [31_430, 31_685, 31_220, 32_035, 32_825],
    "261240": [11_915, 11_705, 11_815, 11_715, 11_885],
    "132030": [11_995, 12_290, 12_540, 12_775, 13_165],
    "114260": [56_810, 57_370, 57_480, 57_705, 57_835],
    "017670": [46_600, 46_500, 47_200, 48_500, 47_600],
}


class SvbScenarioTest(unittest.TestCase):
    def setUp(self) -> None:
        gemini_key_patch = patch.object(config, "GEMINI_API_KEY", "")
        gemini_key_patch.start()
        self.addCleanup(gemini_key_patch.stop)

        self.store = MemoryStore()
        seed_scenario("svb_bank_run_2023", store=self.store)
        self.repository = AppRepository(self.store)
        scenario = self.repository.get_scenario("svb_bank_run_2023")
        for asset_id in scenario["asset_ids"]:
            for date_index, trade_date in enumerate(TURN_DATES):
                close = ACTUAL_CLOSES[asset_id][date_index]
                self.store.replace_one(
                    "daily_prices",
                    {"asset_id": asset_id, "trade_date": trade_date},
                    {
                        "schema_version": 1,
                        "asset_id": asset_id,
                        "trade_date": trade_date,
                        "open": close,
                        "high": close + 100,
                        "low": max(1, close - 100),
                        "close": close,
                        "volume": 1_000_000 + date_index,
                        "source": "TEST_FIXTURE",
                    },
                    upsert=True,
                )
        self.service = ScenarioSessionService(self.repository)

    def test_initial_bank_positions_and_four_turn_completion(self) -> None:
        session = self.service.start_session("svb-user", "svb_bank_run_2023")
        session_id = session["session_id"]
        stored = self.repository.get_session(session_id)
        self.assertEqual(stored["initial_cash"], 3_000_000)
        self.assertEqual(stored["initial_value"], 7_724_500)
        self.assertEqual(
            {item["asset_id"]: item["quantity"] for item in stored["positions"]},
            {"105560": 40, "055550": 50, "091170": 150},
        )

        result = None
        for expected_turn in range(1, 5):
            view = self.service.get_turn_view(session_id)
            self.assertEqual(view["progress"]["current_turn"], expected_turn)
            self.assertEqual(view["progress"]["market_date"], TURN_DATES[expected_turn - 1])
            self.assertEqual(len(view["news"]), 2)
            answers = []
            for question in view["questions"]:
                answers.append(
                    {
                        "question_id": question["question_id"],
                        "selected": []
                        if question.get("type") == "free"
                        else [question["options"][0]],
                        "text": "위험과 정책 대응을 함께 확인하며 관망하겠습니다."
                        if question.get("type") == "free"
                        else "",
                    }
                )
            result = self.service.submit_turn(session_id, answers)

        self.assertIsNotNone(result)
        self.assertEqual(result["session"]["status"], "COMPLETED")
        evaluation = self.service.get_evaluation(session_id)
        self.assertEqual(len(evaluation["decision_evaluation"]["timeline"]), 4)
        self.assertEqual(evaluation["portfolio_analysis"]["initial_value"], 7_724_500)

    def test_balanced_svb_reasoning_scores_well(self) -> None:
        rationales = [
            (
                "금리 상승은 은행 보유채권 평가손실에 부담이고 거액 법인 예금이 집중된 "
                "SVB의 뱅크런을 키웠다. 국내 은행의 자본과 유동성 규제는 다르므로 전염 "
                "가능성을 확인하며 이번 턴은 관망하겠다."
            ),
            (
                "은행 파산은 악재지만 예금 전액 보호와 긴급 유동성 공급은 뱅크런을 "
                "완화한다. 다만 다른 은행으로 전염될 가능성이 남고 예금자 보호가 주주 "
                "보호는 아니므로 관망하겠다."
            ),
            (
                "SVB와 크레디트스위스는 실패 원인이 다르지만 금융주 투자심리 악화와 "
                "전염 위험은 공통이다. 중앙은행 유동성 지원과 국내 은행 건전성이 완화 "
                "요인이므로 원인을 구분하며 관망하겠다."
            ),
            (
                "SVB 인수와 시장 안정은 긍정적이지만 신용 긴축과 높은 금리 부담은 남아 "
                "있다. 모든 위험이 해소됐다고 단정하지 않고 은행 실적과 예금 흐름을 "
                "확인하며 관망하겠다."
            ),
        ]
        session = self.service.start_session("svb-balanced", "svb_bank_run_2023")
        session_id = session["session_id"]
        turn_scores = []
        for turn_index in range(4):
            view = self.service.get_turn_view(session_id)
            rubric = self.repository.get_rubric("svb_bank_run_2023", 1, turn_index + 1)
            answers = []
            for question in view["questions"]:
                rule = rubric["answer_rules"][question["question_id"]]
                answers.append(
                    {
                        "question_id": question["question_id"],
                        "selected": []
                        if question.get("type") == "free"
                        else [rule["good"][0]],
                        "text": rationales[turn_index]
                        if question.get("type") == "free"
                        else "",
                    }
                )
            result = self.service.submit_turn(session_id, answers)
            turn_scores.append(result["turn_evaluation"]["scorecard"]["turn_score"])

        self.assertGreaterEqual(min(turn_scores), 3.5, turn_scores)
        evaluation = self.service.get_evaluation(session_id)
        averages = evaluation["decision_evaluation"]["metric_averages"]
        for metric_id in ("M1", "M2", "M3", "M4", "M5"):
            self.assertGreaterEqual(averages[metric_id], 3.5, metric_id)


if __name__ == "__main__":
    unittest.main()
