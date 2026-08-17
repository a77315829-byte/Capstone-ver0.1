"""자유서술을 M1~M5 전 축의 근거로 분석하는 결정론적 채점기.

외부 LLM은 사용하지 않는다. 현재 턴 기준표의 요인과 로컬 별칭 사전을 이용해
언급 요인, 방향 해석, 위험/완화 균형, 실제 행동과의 일치, 논리 연결을 분석한다.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import json
from pathlib import Path
import re
from typing import Any

from data.models import MetricId, MetricResult, Penalty
from scoring.action_scorer import derive_action_score


INSUFFICIENT = "INSUFFICIENT"
WEAK = "WEAK"
SUFFICIENT = "SUFFICIENT"

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
_POSITIVE_TERMS = (
    "호재", "긍정", "상승", "증가", "확대", "개선", "수혜", "반등",
    "강세", "회복", "안정", "탄탄", "유입", "지속",
)
_NEGATIVE_TERMS = (
    "악재", "부정", "하락", "감소", "위축", "위험", "부담", "조정",
    "불확실", "우려", "과열", "고평가", "급락", "지연", "이탈",
)
_UNCERTAINTY_TERMS = (
    "불확실", "가능성", "수도 있", "수 있다", "경우", "확인 필요",
    "지켜봐", "다만", "하지만", "반면", "그러나",
)
_CAUSAL_TERMS = (
    "때문", "따라서", "그러므로", "이로 인해", "그 결과", "영향",
    "근거", "로 인해", "라서", "므로", "이므로", "으므로",
)
_CONTRAST_TERMS = ("하지만", "다만", "반면", "그러나", "동시에")
_NEGATION_TERMS = ("피하", "자제", "않", "아니", "금지", "말아", "과도", "과잉")


@dataclass
class RationaleEvaluation:
    metrics: dict[str, MetricResult]
    analysis: dict[str, Any]


@lru_cache(maxsize=1)
def _load_alias_catalog() -> dict[str, dict[str, list[str]]]:
    with (_DATA_DIR / "factor_aliases.json").open(encoding="utf-8") as file:
        value = json.load(file)
    return value if isinstance(value, dict) else {}


def _clamp(value: float) -> float:
    return round(max(1.0, min(5.0, value)), 2)


def _input_quality(text: str) -> tuple[str, int, int]:
    tokens = re.findall(r"[가-힣A-Za-z]+", text.lower())
    meaningful_count = sum(len(token) for token in tokens)
    unique_chars = set("".join(tokens))
    if meaningful_count < 8 or len(tokens) < 3 or len(unique_chars) < 5:
        return INSUFFICIENT, meaningful_count, len(tokens)
    if meaningful_count < 20 or len(tokens) < 5:
        return WEAK, meaningful_count, len(tokens)
    return SUFFICIENT, meaningful_count, len(tokens)


def _factor_label(factor: dict) -> str:
    note = str(factor.get("note", "")).strip()
    if note:
        return re.split(r"[.(（]", note, maxsplit=1)[0].strip()
    return str(factor.get("factor_id", ""))


def _matched_aliases(text: str, aliases: list[str]) -> list[str]:
    return [alias for alias in aliases if alias.lower() in text]


def _contexts_for_aliases(text: str, aliases: list[str]) -> str:
    clauses = [part.strip() for part in re.split(r"[.!?\n,;]+", text) if part.strip()]
    matched = [
        clause
        for clause in clauses
        if any(alias.lower() in clause for alias in aliases)
    ]
    return " ".join(matched) if matched else text


def _interpret_factor(
    text: str,
    factor: dict,
    catalog_entry: dict[str, list[str]],
    aliases: list[str],
) -> str:
    context = _contexts_for_aliases(text, aliases)
    correct_terms = [str(value).lower() for value in catalog_entry.get("correct_terms", [])]
    wrong_terms = [str(value).lower() for value in catalog_entry.get("wrong_terms", [])]

    # "전량 매도는 피한다"처럼 함정을 명시적으로 부정한 문장은 올바른 인식이다.
    if any(term in context for term in correct_terms):
        return "correct"
    if any(term in context for term in wrong_terms):
        return "wrong"

    positive = any(term in context for term in _POSITIVE_TERMS)
    negative = any(term in context for term in _NEGATIVE_TERMS)
    direction = factor.get("direction")
    if direction == "호재":
        if positive:
            return "correct"
        if negative and not positive:
            return "wrong"
    elif direction == "악재":
        if negative:
            return "correct"
        if positive and not negative:
            return "wrong"
    return "unspecified"


def _is_negated_action(text: str, start: int, phrase: str) -> bool:
    # 한국어 행동 부정은 대개 "매도는 피한다", "매수하지 않는다"처럼
    # 행동 표현 뒤에 온다. 앞 문장의 "피하고"가 다음 행동까지 오염시키지 않게 한다.
    suffix = text[start + len(phrase): start + len(phrase) + 14]
    return any(term in suffix for term in _NEGATION_TERMS)


def infer_rationale_action(text: str) -> tuple[float | None, str | None]:
    """자유서술의 행동 결론을 논문식 -3~+2 강도로 변환한다."""
    patterns: list[tuple[float, str, int, tuple[str, ...]]] = [
        (2.0, "공격적 매수", 5, ("전량 매수", "대부분 매수", "몰빵", "집중 매수")),
        (-3.0, "전량 매도", 5, ("전량 매도", "모두 매도", "전부 매도")),
        (0.5, "제한적 매수", 4, ("소량 매수", "일부 매수", "분할 매수", "단계적 매수", "선별 매수", "재진입")),
        (-1.0, "일부 축소", 4, ("일부 매도", "부분 매도", "비중 축소", "차익 실현", "차익실현", "현금 확보")),
        (0.0, "관망/유지", 3, ("관망", "보유 유지", "보유분 유지", "보유분은 유지", "기다리", "지켜보", "매수 보류")),
        (1.0, "매수", 2, ("추가 매수", "비중 확대", "매수하", "매수할", "매수한다")),
        (-2.0, "매도", 2, ("손절", "매도하", "매도할", "매도한다")),
    ]
    matches: list[tuple[int, int, float, str, str]] = []
    for score, label, priority, phrases in patterns:
        for phrase in phrases:
            start = text.rfind(phrase)
            if start < 0 or _is_negated_action(text, start, phrase):
                continue
            matches.append((start, priority, score, label, phrase))
    if not matches:
        return None, None
    # "분할 매수하고"에서는 구체 표현(분할 매수)과 일반 표현(매수하)이
    # 몇 글자 차이로 함께 잡힌다. 같은 행동 구간이면 구체 표현을 우선한다.
    last_start = max(item[0] for item in matches)
    same_action_matches = [item for item in matches if last_start - item[0] <= 5]
    _, _, score, label, _ = max(
        same_action_matches,
        key=lambda item: (item[1], item[0]),
    )
    return score, label


def _insufficient_penalty() -> Penalty:
    return Penalty(
        amount=0.0,
        cause="INSUFFICIENT_RATIONALE",
        evidence="자유서술이 너무 짧거나 의미 있는 투자 판단 근거를 포함하지 않음",
    )


def evaluate_rationale(
    free_text: str,
    rubric: dict,
    holdings: list,
) -> RationaleEvaluation:
    text = " ".join(str(free_text or "").lower().split())
    quality, meaningful_count, token_count = _input_quality(text)
    catalog = _load_alias_catalog()
    factors = list(rubric.get("factors", []))
    factor_by_id = {str(item.get("factor_id")): item for item in factors}

    mentioned: list[str] = []
    correct: list[str] = []
    wrong: list[str] = []
    unspecified: list[str] = []
    trap_factors: list[str] = []

    for factor in factors:
        factor_id = str(factor.get("factor_id", ""))
        entry = catalog.get(factor_id, {})
        aliases = [str(value).lower() for value in entry.get("aliases", [])]
        hits = _matched_aliases(text, aliases)
        if not hits:
            continue
        mentioned.append(factor_id)
        interpretation = _interpret_factor(text, factor, entry, hits)
        if interpretation == "correct":
            correct.append(factor_id)
        elif interpretation == "wrong":
            wrong.append(factor_id)
        else:
            unspecified.append(factor_id)
        if factor.get("importance") == "상관없음" and interpretation != "correct":
            trap_factors.append(factor_id)

    required_ids = [
        str(item.get("factor_id"))
        for item in factors
        if item.get("importance") == "상"
    ]
    supporting_ids = [
        str(item.get("factor_id"))
        for item in factors
        if item.get("importance") == "중"
    ]
    risk_ids = [
        str(item.get("factor_id"))
        for item in factors
        if item.get("direction") == "악재" and item.get("importance") in {"상", "중"}
    ]
    mitigating_ids = [
        str(item.get("factor_id"))
        for item in factors
        if item.get("direction") == "호재" and item.get("importance") in {"상", "중"}
    ]
    required_hits = [factor_id for factor_id in required_ids if factor_id in mentioned]
    supporting_hits = [factor_id for factor_id in supporting_ids if factor_id in mentioned]
    risk_hits = [factor_id for factor_id in risk_ids if factor_id in mentioned]
    mitigating_hits = [factor_id for factor_id in mitigating_ids if factor_id in mentioned]
    has_uncertainty = any(term in text for term in _UNCERTAINTY_TERMS)
    has_causal_link = any(term in text for term in _CAUSAL_TERMS)
    has_contrast = any(term in text for term in _CONTRAST_TERMS)

    rationale_action_score, rationale_action_label = infer_rationale_action(text)
    actual_action_score = derive_action_score(holdings)

    # M1: 자유서술에서 시나리오 핵심 요인을 얼마나 식별했는가.
    m1_penalties: list[Penalty] = []
    if quality == INSUFFICIENT:
        m1_score = 1.0
        m1_penalties.append(_insufficient_penalty())
    else:
        coverage = len(required_hits) / max(1, len(required_ids))
        m1_score = 1.0 + 3.5 * coverage + 0.5 * min(1, len(supporting_hits))
        m1_score -= 0.5 * len(trap_factors)
        if quality == WEAK:
            m1_score = min(m1_score, 3.5)
        missing_ids = [factor_id for factor_id in required_ids if factor_id not in mentioned]
        if missing_ids:
            labels = [_factor_label(factor_by_id[factor_id]) for factor_id in missing_ids]
            m1_penalties.append(Penalty(
                amount=0.0,
                cause="MISSING_KEY_FACTORS",
                evidence=f"자유서술에서 빠진 핵심 요인: {', '.join(labels)}",
            ))
        if trap_factors:
            labels = [_factor_label(factor_by_id[factor_id]) for factor_id in trap_factors]
            m1_penalties.append(Penalty(
                amount=0.0,
                cause="IRRELEVANT_OR_TRAP_FACTOR",
                evidence=f"핵심 근거로 보기 어려운 요인에 의존함: {', '.join(labels)}",
            ))
    m1 = MetricResult(
        metric=MetricId.M1,
        score=_clamp(m1_score),
        penalties=m1_penalties,
        reason=f"자유서술 핵심 요인 {len(required_hits)}/{len(required_ids)}개 식별",
    )

    # M2: 언급한 요인의 영향 방향을 올바르게 해석했는가.
    m2_penalties: list[Penalty] = []
    if quality == INSUFFICIENT:
        m2_score = 1.0
        m2_penalties.append(_insufficient_penalty())
    elif not mentioned:
        m2_score = 1.5
        m2_penalties.append(Penalty(
            amount=0.0,
            cause="NO_INTERPRETABLE_FACTOR",
            evidence="자유서술에 영향 방향을 평가할 구체적인 요인이 없음",
        ))
    else:
        m2_score = 2.0 + 0.75 * len(correct)
        if len(correct) >= 2:
            m2_score += 0.75
        m2_score -= 1.5 * len(wrong)
        m2_score -= 0.75 * len(trap_factors)
        if quality == WEAK:
            m2_score = min(m2_score, 3.5)
        if wrong:
            labels = [_factor_label(factor_by_id[factor_id]) for factor_id in wrong]
            m2_penalties.append(Penalty(
                amount=0.0,
                cause="MISINTERPRETED_DIRECTION",
                evidence=f"영향 방향을 기준표와 다르게 해석한 요인: {', '.join(labels)}",
            ))
        if unspecified:
            labels = [_factor_label(factor_by_id[factor_id]) for factor_id in unspecified]
            m2_penalties.append(Penalty(
                amount=0.0,
                cause="UNEXPLAINED_DIRECTION",
                evidence=f"영향 방향 설명이 부족한 요인: {', '.join(labels)}",
            ))
    m2 = MetricResult(
        metric=MetricId.M2,
        score=_clamp(m2_score),
        penalties=m2_penalties,
        reason=f"방향 해석: 적절 {len(correct)}개, 오류 {len(wrong)}개",
    )

    # M3: 위험 요인과 완화/호재, 불확실성을 함께 봤는가.
    m3_penalties: list[Penalty] = []
    if quality == INSUFFICIENT:
        m3_score = 1.0
        m3_penalties.append(_insufficient_penalty())
    elif risk_hits and mitigating_hits and has_uncertainty:
        m3_score = 5.0
    elif risk_hits and mitigating_hits:
        m3_score = 4.2
    elif risk_hits and has_uncertainty:
        m3_score = 3.5
    elif risk_hits:
        m3_score = 3.0
    elif has_uncertainty:
        m3_score = 2.5
    else:
        m3_score = 1.5
    if quality == WEAK:
        m3_score = min(m3_score, 3.5)
    if quality != INSUFFICIENT and not risk_hits:
        m3_penalties.append(Penalty(
            amount=0.0,
            cause="RISK_NEGLECT",
            evidence="자유서술에서 이번 턴의 주요 위험 요인을 확인하지 못함",
        ))
    if quality != INSUFFICIENT and (not risk_hits or not mitigating_hits):
        m3_penalties.append(Penalty(
            amount=0.0,
            cause="NO_COUNTER_SCENARIO",
            evidence="호재와 위험을 함께 비교하는 반대 시나리오가 부족함",
        ))
    m3 = MetricResult(
        metric=MetricId.M3,
        score=_clamp(m3_score),
        penalties=m3_penalties,
        reason=f"위험 요인 {len(risk_hits)}개, 완화·호재 요인 {len(mitigating_hits)}개 인식",
    )

    # M4: 자유서술에서 내린 행동 결론과 실제 주문 방향/강도를 비교한다.
    m4_penalties: list[Penalty] = []
    if quality == INSUFFICIENT:
        m4_score = 1.0
        m4_penalties.append(_insufficient_penalty())
    elif rationale_action_score is None:
        m4_score = 2.0
        m4_penalties.append(Penalty(
            amount=0.0,
            cause="MISSING_ACTION_CONCLUSION",
            evidence="자유서술에 매수·매도·관망 등 행동 결론이 명시되지 않음",
        ))
    else:
        gap = abs(rationale_action_score - actual_action_score)
        if gap <= 0.5:
            m4_score = 5.0
        elif gap <= 1.0:
            m4_score = 4.0
        elif gap <= 2.0:
            m4_score = 2.5
        else:
            m4_score = 1.0
        if gap > 1.0:
            m4_penalties.append(Penalty(
                amount=0.0,
                cause="ACTION_REASONING_MISMATCH",
                evidence=(
                    f"서술한 행동 강도({rationale_action_score})와 실제 행동 강도"
                    f"({actual_action_score})가 일치하지 않음"
                ),
            ))
        if not mentioned:
            m4_score = min(m4_score, 2.5)
            m4_penalties.append(Penalty(
                amount=0.0,
                cause="ACTION_WITHOUT_EVIDENCE",
                evidence="행동 결론을 뒷받침하는 구체적인 사건·영향 요인이 없음",
            ))
        m4_score -= 0.5 * len(wrong)
        if quality == WEAK:
            m4_score = min(m4_score, 3.5)
    m4 = MetricResult(
        metric=MetricId.M4,
        score=_clamp(m4_score),
        penalties=m4_penalties,
        reason=(
            f"서술 행동={rationale_action_label or '확인 불가'}, "
            f"실제 행동 강도={actual_action_score}"
        ),
    )

    # M5: 원인→영향→행동 연결과 균형을 결정론적으로 평가한다.
    m5_penalties: list[Penalty] = []
    if quality == INSUFFICIENT:
        m5_score = 1.0
        m5_penalties.append(_insufficient_penalty())
    else:
        m5_score = 1.5
        if meaningful_count >= 20:
            m5_score += 0.6
        if meaningful_count >= 45:
            m5_score += 0.4
        if has_causal_link:
            m5_score += 0.8
        else:
            m5_penalties.append(Penalty(
                amount=0.0,
                cause="CAUSE_EFFECT_GAP",
                evidence="사건이 어떤 영향을 주고 왜 행동으로 이어지는지 연결 설명이 부족함",
            ))
        if rationale_action_score is not None:
            m5_score += 0.6
        else:
            m5_penalties.append(Penalty(
                amount=0.0,
                cause="CONCLUSION_JUMP",
                evidence="자유서술에서 최종 행동 결론을 확인하기 어려움",
            ))
        if len(mentioned) >= 2:
            m5_score += 0.5
        if (risk_hits and mitigating_hits) or has_contrast:
            m5_score += 0.5
        m5_score -= 0.75 * len(wrong)
        if quality == WEAK:
            m5_score = min(m5_score, 3.0)
    m5 = MetricResult(
        metric=MetricId.M5,
        score=_clamp(m5_score),
        penalties=m5_penalties,
        reason=(
            f"원인-영향 연결={'있음' if has_causal_link else '부족'}, "
            f"행동 결론={'있음' if rationale_action_score is not None else '부족'}"
        ),
    )

    analysis = {
        "version": "rationale-rule-v1",
        "quality": quality,
        "meaningful_character_count": meaningful_count,
        "token_count": token_count,
        "mentioned_factors": mentioned,
        "correctly_interpreted_factors": correct,
        "misinterpreted_factors": wrong,
        "direction_unspecified_factors": unspecified,
        "risk_factors": risk_hits,
        "mitigating_factors": mitigating_hits,
        "trap_factors": trap_factors,
        "has_uncertainty": has_uncertainty,
        "has_causal_link": has_causal_link,
        "inferred_action": rationale_action_label,
        "inferred_action_score": rationale_action_score,
        "actual_action_score": actual_action_score,
    }
    return RationaleEvaluation(
        metrics={
            "M1": m1,
            "M2": m2,
            "M3": m3,
            "M4": m4,
            "M5": m5,
        },
        analysis=analysis,
    )
