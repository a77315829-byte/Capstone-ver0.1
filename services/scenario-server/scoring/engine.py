"""기존 API 계약을 유지하는 턴 평가 오케스트레이터.

점수 계산, 피드백 내용 선택, 문장 표현을 서로 다른 모듈에 위임한다.
현재 피드백은 외부 API 없이 결정론적 템플릿으로 렌더링한다.
"""
from __future__ import annotations

import json
import logging

from data.models import CardStatus, Scorecard, UserDecision
from scoring import (
    evaluator,
    feedback_planner,
    feedback_renderer,
    output_validator,
)
from scoring.contracts import EvaluationInput


logger = logging.getLogger(__name__)


def score_turn(decision: UserDecision, rubric: dict) -> Scorecard:
    """기존 ``UserDecision + rubric -> Scorecard`` 계약을 보존한다."""
    evaluation_input = EvaluationInput(decision=decision, rubric=rubric)
    score_result = evaluator.evaluate(evaluation_input)

    if score_result.status != CardStatus.SCORED:
        return Scorecard(
            scenario_id=score_result.scenario_id,
            turn_no=score_result.turn_no,
            status=score_result.status,
            metrics=score_result.metrics,
            traps=score_result.traps,
            turn_score=score_result.turn_score,
            feedback=score_result.message,
            rationale_analysis=score_result.rationale_analysis,
        )

    feedback_plan = feedback_planner.build(evaluation_input, score_result)
    try:
        rendered_feedback = feedback_renderer.render(feedback_plan)
        output_validator.validate(feedback_plan, rendered_feedback)
    except Exception:
        logger.exception("피드백 렌더링 검증 실패; 템플릿으로 복구합니다.")
        rendered_feedback = feedback_renderer.render_template(feedback_plan)
        output_validator.validate(feedback_plan, rendered_feedback)

    return Scorecard(
        scenario_id=score_result.scenario_id,
        turn_no=score_result.turn_no,
        status=score_result.status,
        metrics=score_result.metrics,
        traps=score_result.traps,
        turn_score=score_result.turn_score,
        feedback=json.dumps(
            rendered_feedback.to_legacy_dict(),
            ensure_ascii=False,
        ),
        rationale_analysis=score_result.rationale_analysis,
    )
