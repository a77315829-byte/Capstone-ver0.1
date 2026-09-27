"""평가, 피드백 계획, 렌더링 사이의 내부 데이터 계약."""
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
import re
from typing import Any

from data.models import (
    CardStatus,
    MetricResult,
    QuestionScore,
    TrapResult,
    UserDecision,
)


@dataclass(frozen=True)
class EvaluationInput:
    """한 번의 평가에 필요한 원본 입력 묶음.

    기존 ``score_turn(decision, rubric)`` 호출자는 엔진 어댑터가 이 타입으로
    변환한다. 이후 shadow 평가에서는 snapshot/bundle 식별자를 함께 채운다.
    """

    decision: UserDecision
    rubric: Mapping[str, Any]
    visible_claim_ids: tuple[str, ...] = ()
    input_snapshot_hash: str = ""
    evaluator_bundle_id: str = ""

    @property
    def scenario_id(self) -> str:
        return self.decision.scenario_id

    @property
    def turn_no(self) -> int:
        return self.decision.turn_no


@dataclass(frozen=True)
class Evidence:
    """사용자 원문에서 검증된 요인 근거 한 건.

    현재 규칙 평가기는 이 계약을 채우지 않는다. 향후 자체 extractor가 원문
    span을 반환할 때 사용하며, span을 확인할 수 없는 값을 만들어 내지 않는다.
    """

    evidence_id: str
    question_id: str
    text: str
    factor_id: str
    start: int
    end: int
    scope: str = "UNKNOWN"
    direction: str = "UNSPECIFIED"
    entity_id: str = ""
    claim_id: str = ""
    negated: bool = False
    uncertainty: str = "UNSPECIFIED"
    confidence: float = 1.0
    source: str = "MODEL"

    def __post_init__(self) -> None:
        if not self.evidence_id.strip() or not self.question_id.strip():
            raise ValueError("evidence_id와 question_id가 필요합니다.")
        if not self.text:
            raise ValueError("evidence text가 비어 있습니다.")
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", self.factor_id):
            raise ValueError("factor_id는 대문자 영숫자와 밑줄만 사용할 수 있습니다.")
        if self.start < 0 or self.end <= self.start:
            raise ValueError("evidence span은 0 이상의 유효한 반개구간이어야 합니다.")
        if self.end - self.start != len(self.text):
            raise ValueError("evidence span 길이와 text 길이가 일치해야 합니다.")
        if self.scope not in {"MACRO", "INDUSTRY", "ENTITY", "PORTFOLIO", "UNKNOWN"}:
            raise ValueError("지원하지 않는 evidence scope입니다.")
        if self.direction not in {
            "POSITIVE",
            "NEGATIVE",
            "NEUTRAL",
            "MIXED",
            "UNSPECIFIED",
        }:
            raise ValueError("지원하지 않는 evidence direction입니다.")
        if self.uncertainty not in {
            "ASSERTED",
            "PREDICTED",
            "POSSIBLE",
            "UNSPECIFIED",
        }:
            raise ValueError("지원하지 않는 evidence uncertainty입니다.")
        if self.source not in {"MODEL", "RULE", "HUMAN"}:
            raise ValueError("지원하지 않는 evidence source입니다.")
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("evidence confidence는 0과 1 사이여야 합니다.")


@dataclass(frozen=True)
class RelationEvidence:
    """두 검증 근거 사이의 인과·영향 관계."""

    relation_id: str
    subject_evidence_id: str
    relation: str
    object_evidence_id: str
    evidence_text: str = ""
    confidence: float = 1.0
    source: str = "MODEL"

    def __post_init__(self) -> None:
        if not self.relation_id.strip():
            raise ValueError("relation_id가 필요합니다.")
        if not self.subject_evidence_id.strip() or not self.object_evidence_id.strip():
            raise ValueError("relation의 subject/object evidence ID가 필요합니다.")
        if self.subject_evidence_id == self.object_evidence_id:
            raise ValueError("relation의 subject와 object는 달라야 합니다.")
        if self.relation not in {
            "CAUSES",
            "INCREASES",
            "DECREASES",
            "MITIGATES",
            "CONTRADICTS",
            "SUPPORTS",
            "ASSOCIATED_WITH",
        }:
            raise ValueError("지원하지 않는 relation type입니다.")
        if self.source not in {"MODEL", "RULE", "HUMAN"}:
            raise ValueError("지원하지 않는 relation source입니다.")
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("relation confidence는 0과 1 사이여야 합니다.")


@dataclass
class ScoreResult:
    """문장 표현이 포함되지 않은 평가 결과."""

    scenario_id: str
    turn_no: int
    status: CardStatus
    metrics: list[MetricResult] = field(default_factory=list)
    traps: list[TrapResult] = field(default_factory=list)
    turn_score: float = 0.0
    rationale_analysis: dict[str, Any] = field(default_factory=dict)
    question_scores: list[QuestionScore] = field(default_factory=list)
    evidence: list[Evidence] = field(default_factory=list)
    relations: list[RelationEvidence] = field(default_factory=list)
    message: str = ""


@dataclass(frozen=True)
class FeedbackPlan:
    """렌더러가 표현해야 할 검증된 피드백 재료."""

    good_points: tuple[str, ...] = ()
    missed_points: tuple[str, ...] = ()
    reference_guidance: str = ""
    score_summary: str = ""
    turn_context: str = ""
    triggered_trap_ids: tuple[str, ...] = ()

    @property
    def allowed_fact_ids(self) -> set[str]:
        fact_ids = {f"good:{index}" for index, _ in enumerate(self.good_points)}
        fact_ids.update(
            f"missed:{index}" for index, _ in enumerate(self.missed_points)
        )
        if self.reference_guidance:
            fact_ids.add("reference_guidance")
        if self.score_summary:
            fact_ids.add("score_summary")
        if self.turn_context:
            fact_ids.add("turn_context")
        return fact_ids


@dataclass(frozen=True)
class RenderedFeedback:
    """화면에 전달할 피드백과 내부 검증용 출처 식별자."""

    good_points: tuple[str, ...]
    missed_points: tuple[str, ...]
    explanation: str
    renderer: str
    cited_fact_ids: tuple[str, ...] = ()

    def to_legacy_dict(self) -> dict[str, Any]:
        """기존 API·Mongo 문서의 피드백 모양을 유지한다."""
        return {
            "good_points": list(self.good_points),
            "missed_points": list(self.missed_points),
            "explanation": self.explanation,
        }
