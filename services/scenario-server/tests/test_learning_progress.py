from __future__ import annotations

from copy import deepcopy
import unittest
from unittest.mock import patch

from config import EVALUATOR_VERSION
from data.app_repository import AppRepository
from data.store import MemoryStore
from play.final_evaluation_service import build_scenario_evaluation
from play.learning_progress import enrich_evaluation, enrich_learning_history
from routes.mypage import get_evaluation, list_evaluations


def pattern(code: str, turns: list[int]) -> dict:
    return {
        "pattern_code": code,
        "label": code,
        "occurrence_count": len(turns),
        "evidence_turns": turns,
        "classification": "REPEATED_PATTERN" if len(turns) >= 2 else "OBSERVATION",
        "recommendation": "다음 시도에서 위험과 근거를 확인하세요.",
    }


def evaluation(number: int, *, score=3, patterns=None, user="learner", scenario="sample", version=1, evaluator=EVALUATOR_VERSION) -> dict:
    metrics = {f"M{i}": score for i in range(1, 6)}
    return {
        "evaluation_id": f"evaluation-{user}-{scenario}-{number}",
        "session_id": f"session-{user}-{scenario}-{number}",
        "user_id": user,
        "scenario_id": scenario,
        "scenario_version": version,
        "evaluator_version": evaluator,
        "evaluation_coverage": {
            "evaluator_versions": [evaluator],
            "snapshot_turns": [1, 2, 3],
        },
        "completed_at": f"2026-09-{number:02d}T12:00:00Z",
        "decision_evaluation": {
            "overall_score": score,
            "metric_averages": metrics,
            "timeline": [{"turn_no": turn, "turn_score": score, "metrics": metrics} for turn in range(1, 4)],
        },
        "behavior_patterns": patterns or [],
        "portfolio_analysis": {"cumulative_return_pct": 5},
        "feedback": {"summary": "기존 종합평가"},
    }


class LearningProgressTest(unittest.TestCase):
    def setUp(self) -> None:
        self.store = MemoryStore()
        self.repository = AppRepository(self.store)
        for scenario in ("sample", "other"):
            for version in (1, 2):
                self.store.insert_one("scenarios", {
                    "scenario_id": scenario,
                    "version": version,
                    "is_published": True,
                    "turn_schedule": [{"turn_no": n, "market_date": f"2026-08-0{n}"} for n in range(1, 4)],
                    "final_valuation": {"market_date": "2026-08-04"},
                })

    def test_first_attempt_is_baseline_and_source_is_unchanged(self) -> None:
        current = evaluation(1)
        original = deepcopy(current)
        progress = enrich_evaluation(self.repository, current)["learning_progress"]
        self.assertEqual(progress["attempt_no"], 1)
        self.assertEqual(progress["status"], "FIRST_ATTEMPT")
        self.assertIsNone(progress["score_delta"])
        self.assertIsNone(progress["previous_evaluation_id"])
        self.assertEqual(current, original)

    def test_repeated_reduced_absent_and_new_patterns_keep_turn_evidence(self) -> None:
        first = evaluation(1, patterns=[pattern("RISK_NEGLECT", [1, 2, 3]), pattern("LOW_CASH_BUFFER", [2])])
        current = evaluation(2, score=4, patterns=[pattern("RISK_NEGLECT", [2]), pattern("THEME_CONFUSION", [3])])
        self.repository.save_scenario_evaluation(first)
        result = enrich_evaluation(self.repository, current)
        progress = result["learning_progress"]
        self.assertEqual(progress["status"], "COMPARABLE")
        self.assertEqual(progress["attempt_no"], 2)
        self.assertEqual(progress["previous_evaluation_id"], first["evaluation_id"])
        self.assertEqual(progress["score_delta"], 1)
        self.assertEqual(progress["score_delta_pct_points"], 20)
        self.assertEqual([p["pattern_code"] for p in progress["repeated_patterns"]], ["RISK_NEGLECT"])
        self.assertEqual({p["pattern_code"] for p in progress["improved_patterns"]}, {"RISK_NEGLECT", "LOW_CASH_BUFFER"})
        self.assertEqual([p["pattern_code"] for p in progress["new_patterns"]], ["THEME_CONFUSION"])
        repeated = progress["repeated_patterns"][0]
        self.assertEqual(repeated["previous_evidence_turns"], [1, 2, 3])
        self.assertEqual(repeated["current_evidence_turns"], [2])
        self.assertEqual(progress["metric_changes"][0]["delta"], 1)
        self.assertEqual(result["decision_evaluation"], current["decision_evaluation"])
        self.assertNotIn("learning_progress", self.repository.get_scenario_evaluation(first["evaluation_id"]))

    def test_same_scenario_and_user_are_required_and_future_is_not_baseline(self) -> None:
        values = [evaluation(3), evaluation(2, user="someone-else"), evaluation(2, scenario="other"), evaluation(1)]
        results = enrich_learning_history(self.repository, values)
        self.assertEqual([item["evaluation_id"] for item in results], [item["evaluation_id"] for item in values])
        self.assertEqual(results[0]["learning_progress"]["attempt_no"], 2)
        self.assertEqual(results[0]["learning_progress"]["previous_evaluation_id"], values[-1]["evaluation_id"])
        for result in results[1:]:
            self.assertEqual(result["learning_progress"]["status"], "FIRST_ATTEMPT")

    def test_version_changes_do_not_report_improvement_or_skip_previous_attempt(self) -> None:
        for current in (evaluation(3, version=2), evaluation(3, evaluator="new-evaluator")):
            with self.subTest(current=current["evaluator_version"], version=current["scenario_version"]):
                older_compatible = {**evaluation(1), "scenario_version": current["scenario_version"], "evaluator_version": current["evaluator_version"]}
                previous = evaluation(2)
                progress = enrich_learning_history(self.repository, [older_compatible, previous, current])[-1]["learning_progress"]
                self.assertEqual(progress["status"], "VERSION_MISMATCH")
                self.assertEqual(progress["previous_evaluation_id"], previous["evaluation_id"])
                self.assertIsNone(progress["score_delta"])
                self.assertEqual(progress["improved_patterns"], [])

    def test_missing_or_partial_evidence_and_unknown_or_mixed_versions_are_not_compared(self) -> None:
        variants = []
        missing_version = evaluation(1)
        missing_version.pop("evaluator_version")
        variants.append(missing_version)
        variants.extend(evaluation(1, evaluator=value) for value in ("", "UNKNOWN", " "))
        missing_patterns = evaluation(1)
        missing_patterns.pop("behavior_patterns")
        variants.append(missing_patterns)
        partial = evaluation(1)
        partial["decision_evaluation"]["timeline"].pop()
        variants.append(partial)
        mixed = evaluation(1)
        mixed["evaluation_coverage"] = {"evaluator_versions": [EVALUATOR_VERSION, "old-version"]}
        variants.append(mixed)
        for previous in variants:
            with self.subTest(previous=previous):
                progress = enrich_learning_history(self.repository, [previous, evaluation(2)])[-1]["learning_progress"]
                self.assertEqual(progress["status"], "INSUFFICIENT_DATA")
                self.assertIsNone(progress["score_delta"])

    def test_portfolio_mistake_absence_requires_full_snapshot_coverage(self) -> None:
        previous = evaluation(1, patterns=[pattern("LOW_CASH_BUFFER", [2])])
        current = evaluation(2)
        self.assertEqual(
            enrich_learning_history(self.repository, [previous, current])[-1]["learning_progress"]["status"],
            "COMPARABLE",
        )
        current["evaluation_coverage"]["snapshot_turns"] = [1, 3]
        progress = enrich_learning_history(self.repository, [previous, current])[-1]["learning_progress"]
        self.assertEqual(progress["status"], "INSUFFICIENT_DATA")
        self.assertEqual(progress["improved_patterns"], [])
        current = evaluation(2)
        previous.pop("evaluation_coverage")
        progress = enrich_learning_history(self.repository, [previous, current])[-1]["learning_progress"]
        self.assertEqual(progress["status"], "INSUFFICIENT_DATA")

    def test_legacy_decision_patterns_can_compare_with_complete_turn_evidence(self) -> None:
        previous = evaluation(1, patterns=[pattern("RISK_NEGLECT", [2])])
        current = evaluation(2)
        for item in (previous, current):
            item.pop("evaluation_coverage")
        progress = enrich_learning_history(self.repository, [previous, current])[-1]["learning_progress"]
        self.assertEqual(progress["status"], "COMPARABLE")
        self.assertEqual(progress["improved_patterns"][0]["pattern_code"], "RISK_NEGLECT")

    def test_duplicate_session_does_not_inflate_attempt_count(self) -> None:
        first = evaluation(1)
        duplicate = {**first, "evaluation_id": "duplicate"}
        progress = enrich_learning_history(self.repository, [first, duplicate, evaluation(2)])[-1]["learning_progress"]
        self.assertEqual(progress["attempt_no"], 2)

    def test_final_evaluation_contains_saved_comparison_without_changing_score(self) -> None:
        first = evaluation(1, patterns=[pattern("RISK_NEGLECT", [1, 2, 3])])
        self.repository.save_scenario_evaluation(first)
        current = evaluation(2)
        session = {**current, "initial_cash": 1000}
        for turn in range(1, 4):
            self.repository.save_turn_evaluation({
                "evaluation_id": f"turn-{turn}",
                "session_id": session["session_id"],
                "turn_no": turn,
                "evaluator_version": EVALUATOR_VERSION,
                "scorecard": {"turn_score": 4, "metrics": [{"metric": f"M{i}", "score": 4} for i in range(1, 6)]},
            })
        result = build_scenario_evaluation(self.repository, session, current["completed_at"])
        self.assertEqual(result["decision_evaluation"]["overall_score"], 4)
        self.assertIn("3턴 판단 과정", result["feedback"]["summary"])
        self.assertEqual(result["learning_progress"]["status"], "COMPARABLE")
        self.assertEqual(result["learning_progress"]["improved_patterns"][0]["current_occurrence_count"], 0)
        self.repository.save_scenario_evaluation(result)
        self.assertEqual(self.repository.get_scenario_evaluation(result["evaluation_id"])["learning_progress"], result["learning_progress"])

    def test_list_and_detail_enrich_legacy_results_and_protect_other_user(self) -> None:
        for item in (evaluation(1), evaluation(2, score=4), evaluation(3, user="someone-else")):
            self.repository.save_scenario_evaluation(item)
        with patch("routes.mypage.AppRepository", return_value=self.repository):
            listing = list_evaluations("learner")["data"]
            self.assertEqual(len(listing), 2)
            self.assertEqual(listing[0]["learning_progress"]["attempt_no"], 2)
            self.assertEqual(listing[0]["metric_averages"]["M3"], 4)
            detail = get_evaluation("learner", evaluation(2)["evaluation_id"])["data"]
            self.assertEqual(detail["learning_progress"], listing[0]["learning_progress"])
            denied = get_evaluation("learner", evaluation(3, user="someone-else")["evaluation_id"])
            self.assertEqual(denied.status_code, 404)


if __name__ == "__main__":
    unittest.main()
