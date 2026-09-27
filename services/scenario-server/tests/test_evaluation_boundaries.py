from __future__ import annotations

import json
from pathlib import Path
import unittest
from unittest.mock import patch

from data.models import Action, CardStatus, Holding, QuestionAnswer, UserDecision
from scoring import (
    engine,
    evaluator,
    evidence_validator,
    feedback_renderer,
    output_validator,
)
from scoring.contracts import (
    EvaluationInput,
    Evidence,
    FeedbackPlan,
    RelationEvidence,
    RenderedFeedback,
    ScoreResult,
)


ROOT = Path(__file__).resolve().parents[1]


class EvaluationBoundaryTest(unittest.TestCase):
    def setUp(self) -> None:
        with (ROOT / "data/scenarios/semiconductor/rubric_turn3.json").open(
            encoding="utf-8"
        ) as file:
            self.rubric = json.load(file)
        answers: list[QuestionAnswer] = []
        for question_id in self.rubric["questions_used"]:
            rule = self.rubric["answer_rules"][question_id]
            if rule.get("type") == "free":
                answers.append(
                    QuestionAnswer(
                        question_id,
                        text=(
                            "HBM 수요 증가와 공급 부족은 메모리 가격에 호재지만 "
                            "밸류에이션 부담이 있으므로 소량 분할 매수하겠습니다."
                        ),
                    )
                )
            else:
                answers.append(
                    QuestionAnswer(question_id, selected=[rule["good"][0]])
                )
        self.decision = UserDecision(
            scenario_id="semiconductor",
            turn_no=3,
            holdings=[Holding("000660", Action.BUY, 10)],
            cash_pct=70,
            answers=answers,
        )

    def test_evaluator_returns_score_without_rendered_feedback(self) -> None:
        result = evaluator.evaluate(
            EvaluationInput(decision=self.decision, rubric=self.rubric)
        )
        self.assertIsInstance(result, ScoreResult)
        self.assertEqual(result.status, CardStatus.SCORED)
        self.assertGreater(result.turn_score, 0)
        self.assertFalse(hasattr(result, "feedback"))
        self.assertEqual(result.evidence, [])
        self.assertEqual(result.relations, [])

    def test_engine_preserves_legacy_feedback_shape(self) -> None:
        card = engine.score_turn(self.decision, self.rubric)
        feedback = json.loads(card.feedback)
        self.assertEqual(
            set(feedback),
            {"good_points", "missed_points", "explanation"},
        )
        self.assertIsInstance(feedback["explanation"], str)
        self.assertTrue(feedback["explanation"])

    def test_renderer_failure_falls_back_without_changing_scores(self) -> None:
        expected = evaluator.evaluate(
            EvaluationInput(decision=self.decision, rubric=self.rubric)
        )
        with patch.object(
            feedback_renderer,
            "render",
            side_effect=RuntimeError("renderer failed"),
        ), self.assertLogs("scoring.engine", level="ERROR"):
            card = engine.score_turn(self.decision, self.rubric)

        self.assertEqual(card.turn_score, expected.turn_score)
        self.assertEqual(
            [metric.score for metric in card.metrics],
            [metric.score for metric in expected.metrics],
        )
        self.assertTrue(json.loads(card.feedback)["explanation"])

    def test_output_validator_rejects_unknown_fact_reference(self) -> None:
        plan = FeedbackPlan(good_points=("검증된 장점",))
        rendered = feedback_renderer.render_template(plan)
        rendered = RenderedFeedback(
            good_points=rendered.good_points,
            missed_points=rendered.missed_points,
            explanation=rendered.explanation,
            renderer=rendered.renderer,
            cited_fact_ids=("unknown:0",),
        )
        with self.assertRaises(output_validator.FeedbackValidationError):
            output_validator.validate(plan, rendered)

    def test_output_validator_rejects_extra_claim_with_valid_reference(self) -> None:
        plan = FeedbackPlan(good_points=("검증된 장점",))
        rendered = feedback_renderer.render_template(plan)
        rendered = RenderedFeedback(
            good_points=rendered.good_points,
            missed_points=rendered.missed_points,
            explanation=rendered.explanation + " 검증되지 않은 종목이 상승합니다.",
            renderer=rendered.renderer,
            cited_fact_ids=rendered.cited_fact_ids,
        )
        with self.assertRaises(output_validator.FeedbackValidationError):
            output_validator.validate(plan, rendered)

    def test_evidence_requires_a_valid_source_span(self) -> None:
        with self.assertRaises(ValueError):
            Evidence(
                evidence_id="E1",
                question_id="Q39",
                text="HBM 수요",
                factor_id="HBM_DEMAND",
                start=5,
                end=5,
            )

    def test_evidence_validator_checks_source_and_relation_references(self) -> None:
        answer = next(
            item for item in self.decision.answers if item.question_id == "Q39"
        )
        source_text = str(answer.text)
        first_text = "HBM 수요 증가"
        second_text = "메모리 가격"
        first_start = source_text.index(first_text)
        second_start = source_text.index(second_text)
        evidence = [
            Evidence(
                evidence_id="E1",
                question_id="Q39",
                text=first_text,
                factor_id="HBM_DEMAND",
                start=first_start,
                end=first_start + len(first_text),
                scope="INDUSTRY",
                direction="POSITIVE",
                uncertainty="ASSERTED",
            ),
            Evidence(
                evidence_id="E2",
                question_id="Q39",
                text=second_text,
                factor_id="MEMORY_PRICE",
                start=second_start,
                end=second_start + len(second_text),
                scope="INDUSTRY",
                direction="POSITIVE",
                uncertainty="ASSERTED",
            ),
        ]
        relations = [
            RelationEvidence(
                relation_id="R1",
                subject_evidence_id="E1",
                relation="CAUSES",
                object_evidence_id="E2",
            )
        ]
        evidence_validator.validate(
            EvaluationInput(decision=self.decision, rubric=self.rubric),
            evidence,
            relations,
        )

        invalid = [
            Evidence(
                evidence_id="E3",
                question_id="Q39",
                text=first_text,
                factor_id="NOT_IN_RUBRIC",
                start=first_start,
                end=first_start + len(first_text),
            )
        ]
        with self.assertRaises(evidence_validator.EvidenceValidationError):
            evidence_validator.validate(
                EvaluationInput(decision=self.decision, rubric=self.rubric),
                invalid,
                [],
            )


if __name__ == "__main__":
    unittest.main()
