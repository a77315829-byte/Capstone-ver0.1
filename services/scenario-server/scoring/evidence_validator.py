"""Extractor 출력이 실제 입력과 현재 rubric 경계를 지키는지 검사한다."""
from __future__ import annotations

from collections.abc import Iterable

from scoring.contracts import EvaluationInput, Evidence, RelationEvidence


class EvidenceValidationError(ValueError):
    pass


def validate(
    evaluation_input: EvaluationInput,
    evidence: Iterable[Evidence],
    relations: Iterable[RelationEvidence],
) -> None:
    """원문 span, factor/entity, 가시성, relation 참조를 실패 시 차단한다."""
    source_texts = {
        answer.question_id: str(answer.text or "")
        for answer in evaluation_input.decision.answers
    }
    allowed_factor_ids = {
        str(item.get("factor_id", ""))
        for item in evaluation_input.rubric.get("factors", [])
        if item.get("factor_id")
    }
    allowed_entity_ids = {
        str(item.get("asset_id", ""))
        for item in evaluation_input.rubric.get("assets", [])
        if item.get("asset_id")
    }
    visible_claim_ids = set(evaluation_input.visible_claim_ids)

    evidence_by_id: dict[str, Evidence] = {}
    for item in evidence:
        if item.evidence_id in evidence_by_id:
            raise EvidenceValidationError(
                f"중복 evidence_id입니다: {item.evidence_id}"
            )
        source_text = source_texts.get(item.question_id)
        if source_text is None:
            raise EvidenceValidationError(
                f"입력에 없는 question_id입니다: {item.question_id}"
            )
        if item.end > len(source_text) or source_text[item.start:item.end] != item.text:
            raise EvidenceValidationError(
                f"원문 span과 evidence text가 일치하지 않습니다: {item.evidence_id}"
            )
        if allowed_factor_ids and item.factor_id not in allowed_factor_ids:
            raise EvidenceValidationError(
                f"rubric에 없는 factor_id입니다: {item.factor_id}"
            )
        if item.entity_id and item.entity_id not in allowed_entity_ids:
            raise EvidenceValidationError(
                f"rubric에 없는 entity_id입니다: {item.entity_id}"
            )
        if item.claim_id and item.claim_id not in visible_claim_ids:
            raise EvidenceValidationError(
                f"현재 턴에서 볼 수 없는 claim_id입니다: {item.claim_id}"
            )
        evidence_by_id[item.evidence_id] = item

    relation_ids: set[str] = set()
    for relation in relations:
        if relation.relation_id in relation_ids:
            raise EvidenceValidationError(
                f"중복 relation_id입니다: {relation.relation_id}"
            )
        relation_ids.add(relation.relation_id)
        if relation.subject_evidence_id not in evidence_by_id:
            raise EvidenceValidationError(
                "relation subject가 검증된 evidence를 참조하지 않습니다: "
                f"{relation.subject_evidence_id}"
            )
        if relation.object_evidence_id not in evidence_by_id:
            raise EvidenceValidationError(
                "relation object가 검증된 evidence를 참조하지 않습니다: "
                f"{relation.object_evidence_id}"
            )
