from __future__ import annotations

import json
from pathlib import Path
import unittest
from unittest.mock import patch

import config
from data.models import Action, Holding, QuestionAnswer, UserDecision
from scoring import engine, rationale_scorer


ROOT = Path(__file__).resolve().parents[1]


class RationaleScoringTest(unittest.TestCase):
    def setUp(self) -> None:
        gemini_key_patch = patch.object(config, "GEMINI_API_KEY", "")
        gemini_key_patch.start()
        self.addCleanup(gemini_key_patch.stop)
        with (ROOT / "data/scenarios/semiconductor/rubric_turn3.json").open(
            encoding="utf-8"
        ) as file:
            self.rubric = json.load(file)

    def _answers(self, free_text: str) -> list[QuestionAnswer]:
        result = []
        for question_id in self.rubric["questions_used"]:
            rule = self.rubric["answer_rules"][question_id]
            if rule.get("type") == "free":
                result.append(QuestionAnswer(question_id, text=free_text))
            else:
                good = list(rule.get("good", []))
                self.assertTrue(good, f"{question_id}에 good 선택지가 필요합니다")
                result.append(QuestionAnswer(question_id, selected=[good[0]]))
        return result

    def _score(self, free_text: str, holdings: list[Holding] | None = None):
        decision = UserDecision(
            scenario_id="semiconductor",
            turn_no=3,
            holdings=holdings
            if holdings is not None
            else [Holding("000660", Action.BUY, 10)],
            cash_pct=70,
            answers=self._answers(free_text),
        )
        return engine.score_turn(decision, self.rubric)

    @staticmethod
    def _metric_map(card) -> dict[str, float]:
        return {metric.metric.value: metric.score for metric in card.metrics}

    def test_one_character_rationale_caps_every_judgment_metric(self) -> None:
        card = self._score("1")
        metrics = self._metric_map(card)
        for metric_id in ("M1", "M2", "M3", "M4", "M5"):
            self.assertLessEqual(metrics[metric_id], 2.0, metric_id)
        self.assertEqual(card.rationale_analysis["quality"], "INSUFFICIENT")
        self.assertEqual(card.rationale_analysis["mentioned_factors"], [])

    def test_good_rationale_improves_m1_through_m5(self) -> None:
        good_text = (
            "HBM 수요 급증과 공급 부족에 따른 메모리 가격 상승은 실적에 호재입니다. "
            "하지만 이미 많이 올라 밸류에이션 부담과 과열 위험이 있으므로 "
            "SK하이닉스를 소량 분할 매수하고 현금을 유지하겠습니다."
        )
        poor = self._metric_map(self._score("1"))
        good_card = self._score(good_text)
        good = self._metric_map(good_card)

        for metric_id in ("M1", "M2", "M3", "M4", "M5"):
            self.assertGreater(good[metric_id], poor[metric_id], metric_id)
        self.assertGreaterEqual(good["M1"], 4.0)
        self.assertGreaterEqual(good["M3"], 4.0)
        self.assertGreaterEqual(good["M4"], 4.0)
        self.assertIn("HBM_DEMAND", good_card.rationale_analysis["mentioned_factors"])
        self.assertIn("VALUATION", good_card.rationale_analysis["risk_factors"])
        self.assertEqual(good_card.rationale_analysis["inferred_action_score"], 0.5)

    def test_rationale_action_mismatch_lowers_m4(self) -> None:
        mismatch_text = (
            "HBM 수요가 늘어나는 점은 호재지만 과열 위험이 있으므로 "
            "보유 종목을 무조건 전량 매도한다."
        )
        card = self._score(mismatch_text)
        metrics = self._metric_map(card)
        self.assertLess(metrics["M4"], 3.0)
        m4 = next(metric for metric in card.metrics if metric.metric.value == "M4")
        self.assertIn(
            "ACTION_REASONING_MISMATCH",
            {penalty.cause for penalty in m4.penalties},
        )

    def test_all_six_turns_recognize_balanced_rationales(self) -> None:
        cases = {
            1: (
                "AI 서버 투자 확대는 기대감과 수급에 호재지만 아직 실적이 없어 "
                "불확실하므로 대표주를 소량 분할 매수하겠습니다.",
                [Holding("000660", Action.BUY, 10)],
            ),
            2: (
                "엔비디아 실적 호조는 AI 수요 확인에 긍정적이지만 주가가 이미 "
                "급등해 추격매수와 고점 위험이 있으므로 보유분은 유지하고 관망하겠습니다.",
                [Holding("000660", Action.HOLD, 10)],
            ),
            3: (
                "HBM 수요 급증과 공급 부족에 따른 메모리 가격 상승은 호재지만 "
                "밸류에이션 부담과 과열 위험이 있으므로 소량 분할 매수하겠습니다.",
                [Holding("000660", Action.BUY, 10)],
            ),
            4: (
                "금리 인하 지연은 유동성을 위축시키고 기술주 조정 위험을 키우지만 "
                "HBM 수요는 여전하므로 전량 매도는 피하고 일부 비중 축소하겠습니다.",
                [Holding("000660", Action.PARTIAL_SELL, 15)],
            ),
            5: (
                "고평가와 변동성 확대는 급락 위험을 키우지만 HBM 수요 펀더멘털은 "
                "여전하므로 전량 매도 대신 일부 차익 실현하겠습니다.",
                [Holding("000660", Action.PARTIAL_SELL, 15)],
            ),
            6: (
                "AI 투자 지속과 펀더멘털 기반 선별 반등은 호재지만 재조정 가능성이 "
                "있으므로 핵심주만 소량 분할 매수하겠습니다.",
                [Holding("000660", Action.BUY, 10)],
            ),
        }
        for turn_no, (text, holdings) in cases.items():
            with self.subTest(turn_no=turn_no):
                with (
                    ROOT
                    / f"data/scenarios/semiconductor/rubric_turn{turn_no}.json"
                ).open(encoding="utf-8") as file:
                    rubric = json.load(file)
                result = rationale_scorer.evaluate_rationale(text, rubric, holdings)
                self.assertEqual(result.analysis["quality"], "SUFFICIENT")
                self.assertGreaterEqual(result.metrics["M1"].score, 4.0)
                self.assertGreaterEqual(result.metrics["M2"].score, 4.0)
                self.assertGreaterEqual(result.metrics["M3"].score, 4.0)
                self.assertGreaterEqual(result.metrics["M4"].score, 4.0)
                self.assertGreaterEqual(result.metrics["M5"].score, 4.0)


if __name__ == "__main__":
    unittest.main()
