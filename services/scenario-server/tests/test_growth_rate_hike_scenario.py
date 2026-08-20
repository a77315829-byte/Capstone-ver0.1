from __future__ import annotations

import unittest
from unittest.mock import patch

import config
from data.app_repository import AppRepository
from data.store import MemoryStore
from play.session_service import ScenarioSessionService
from scripts.import_yahoo_prices import normalize_chart, yahoo_symbol
from scripts.seed_database import seed_scenario


TURN_DATES = [
    "2022-01-06",
    "2022-05-06",
    "2022-06-16",
    "2022-09-22",
    "2022-11-11",
    "2022-12-29",
]

ACTUAL_CLOSES = {
    "035420": [338_500, 272_000, 240_000, 206_500, 193_500, 177_500],
    "035720": [100_000, 84_300, 72_300, 61_300, 58_700, 53_100],
}


class GrowthRateHikeScenarioTest(unittest.TestCase):
    def setUp(self) -> None:
        gemini_key_patch = patch.object(config, "GEMINI_API_KEY", "")
        gemini_key_patch.start()
        self.addCleanup(gemini_key_patch.stop)

        self.store = MemoryStore()
        seed_scenario("growth_rate_hike_2022", store=self.store)
        self.repository = AppRepository(self.store)
        scenario = self.repository.get_scenario("growth_rate_hike_2022")
        for asset_index, asset_id in enumerate(scenario["asset_ids"]):
            closes = ACTUAL_CLOSES.get(
                asset_id,
                [50_000 + asset_index * 1_000 - date_index * 500 for date_index in range(6)],
            )
            for date_index, trade_date in enumerate(TURN_DATES):
                close = closes[date_index]
                self.store.replace_one(
                    "daily_prices",
                    {"asset_id": asset_id, "trade_date": trade_date},
                    {
                        "schema_version": 1,
                        "asset_id": asset_id,
                        "trade_date": trade_date,
                        "open": close,
                        "high": close + 500,
                        "low": max(1, close - 500),
                        "close": close,
                        "volume": 1_000_000 + date_index,
                        "source": "TEST_FIXTURE",
                    },
                    upsert=True,
                )
        self.service = ScenarioSessionService(self.repository)

    @staticmethod
    def answers_for(questions: list[dict]) -> list[dict]:
        result = []
        for question in questions:
            if question.get("type") == "free":
                result.append(
                    {
                        "question_id": question["question_id"],
                        "selected": [],
                        "text": (
                            "금리 상승은 성장주의 할인율과 수급에 부담이지만 가격에 "
                            "일부 반영됐으므로 현금을 남기고 단계적으로 분산하겠습니다."
                        ),
                    }
                )
            else:
                result.append(
                    {
                        "question_id": question["question_id"],
                        "selected": [question["options"][0]],
                        "text": "",
                    }
                )
        return result

    def test_initial_positions_are_valued_separately_from_cash(self) -> None:
        scenario_list = self.service.list_scenarios()
        self.assertEqual(scenario_list[0]["event_period"], "2022년 1월~12월")
        self.assertEqual(len(scenario_list[0]["initial_positions"]), 2)

        public_session = self.service.start_session("growth-user", "growth_rate_hike_2022")
        session = self.repository.get_session(public_session["session_id"])
        self.assertEqual(session["initial_cash"], 4_000_000)
        self.assertEqual(session["cash"], 4_000_000)
        self.assertEqual(session["initial_value"], 8_208_000)
        self.assertEqual(
            {item["asset_id"]: item["quantity"] for item in session["positions"]},
            {"035420": 8, "035720": 15},
        )

        view = self.service.get_turn_view(public_session["session_id"])
        portfolio = view["portfolio"]
        self.assertEqual(portfolio["total_value"], 8_208_000)
        self.assertEqual(portfolio["profit_loss"], 0)
        self.assertEqual(portfolio["cumulative_return_pct"], 0.0)
        averages = {
            item["asset_id"]: item["avg_price"] for item in portfolio["positions"]
        }
        self.assertEqual(averages, {"035420": 400_000.0, "035720": 125_000.0})

    def test_five_turn_scenario_completes(self) -> None:
        session = self.service.start_session("growth-complete", "growth_rate_hike_2022")
        session_id = session["session_id"]
        result = None
        for expected_turn in range(1, 6):
            view = self.service.get_turn_view(session_id)
            self.assertEqual(view["progress"]["current_turn"], expected_turn)
            self.assertEqual(view["progress"]["market_date"], TURN_DATES[expected_turn - 1])
            self.assertEqual(len(view["news"]), 2)
            result = self.service.submit_turn(
                session_id,
                self.answers_for(view["questions"]),
            )

        self.assertIsNotNone(result)
        self.assertEqual(result["session"]["status"], "COMPLETED")
        evaluation = self.service.get_evaluation(session_id)
        self.assertEqual(len(evaluation["decision_evaluation"]["timeline"]), 5)
        self.assertEqual(evaluation["portfolio_analysis"]["initial_value"], 8_208_000)

    def test_balanced_decisions_receive_a_strong_evaluation(self) -> None:
        rationales = [
            (
                "연준의 조기 긴축으로 금리와 할인율이 오르면 NAVER와 카카오의 "
                "가치평가와 수급이 악화될 수 있다. 정책 기간이 불확실하므로 물타기하지 "
                "않고 현금을 유지하며 이번 턴은 관망하겠다."
            ),
            (
                "빅스텝과 국채금리 상승은 기술주 자금 이탈과 변동성을 키운다. 가격이 "
                "내렸다는 이유만으로 추가 매수하지 않고 실적과 수급 개선을 확인하며 "
                "성장주 집중 축소 조건을 정하되 이번 턴은 관망하겠다."
            ),
            (
                "자이언트스텝은 악재지만 예상에 부합해 불확실성 해소 반등이 나왔다. "
                "추가 인상과 물가 위험이 남아 하루 반등을 추세 전환으로 단정하지 않고 "
                "현금과 분산 구조를 유지하며 관망하겠다."
            ),
            (
                "높아진 최종금리와 환율은 외국인 수급과 성장주 실적에 부담이다. 다만 "
                "신저가에 일부 악재가 반영됐으므로 전량 투매나 저가매수 대신 목표 비중에 "
                "맞춘 분할 리밸런싱 조건을 세우고 이번 턴은 관망하겠다."
            ),
            (
                "CPI 둔화는 금리 인상 속도와 성장주 할인율에 긍정적이지만 하루 급등으로 "
                "호재가 일부 반영됐다. 경기와 실적 위험이 남아 현금을 두고 시장 ETF에만 "
                "단계적 참여 조건을 확인하며 이번 턴은 관망하겠다."
            ),
        ]
        session = self.service.start_session("growth-balanced", "growth_rate_hike_2022")
        session_id = session["session_id"]
        turn_scores = []
        for turn_index in range(5):
            view = self.service.get_turn_view(session_id)
            rubric = self.repository.get_rubric(
                "growth_rate_hike_2022",
                1,
                turn_index + 1,
            )
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


class YahooPriceImporterTest(unittest.TestCase):
    def test_symbol_and_chart_normalization(self) -> None:
        self.assertEqual(
            yahoo_symbol({"asset_id": "035420", "market": "KOSPI"}),
            "035420.KS",
        )
        self.assertEqual(
            yahoo_symbol({"asset_id": "035720", "market": "KOSDAQ"}),
            "035720.KQ",
        )
        payload = {
            "chart": {
                "result": [
                    {
                        "timestamp": [1641427200],
                        "indicators": {
                            "quote": [
                                {
                                    "open": [340000.0],
                                    "high": [342500.0],
                                    "low": [337000.0],
                                    "close": [338500.0],
                                    "volume": [1280916],
                                }
                            ]
                        },
                    }
                ]
            }
        }
        documents = normalize_chart("035420", payload)
        self.assertEqual(documents[0]["trade_date"], "2022-01-06")
        self.assertEqual(documents[0]["close"], 338_500)
        self.assertEqual(documents[0]["source"], "YAHOO_FINANCE_CHART")


if __name__ == "__main__":
    unittest.main()
