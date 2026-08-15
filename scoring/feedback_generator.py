"""규칙 채점 재료를 사용자용 피드백으로 조립한다."""
from __future__ import annotations

import config
from scoring.gemini_client import generate_json


_PROMPT = """너는 투자 교육 서비스의 피드백 작성자다.
아래에 제공된 채점 재료만 사용해 학습자용 해설을 작성하라.
재료에 없는 사건, 종목 정보, 수치 또는 사실을 지어내지 마라.

[이번 턴 상황]
{turn_context}

[잘 본 점]
{good_summary}

[놓친 점 또는 걸린 함정]
{missed_summary}

[AI 모범 판단]
{ai_baseline}

[점수 요약]
{score_summary}

[작성 규칙]
- 3~4문장으로 작성한다.
- 잘한 점이 있으면 먼저 언급한다.
- 놓친 점을 구체적으로 설명한다.
- 마지막 문장은 다음 판단에서 확인할 사항을 안내한다.
- 잘한 점이 없으면 억지로 칭찬하지 않는다.
- 제공된 재료 밖의 내용을 추가하지 않는다.

반드시 아래 JSON 객체 하나만 출력하라.
{{"explanation": "<한국어 피드백>"}}"""


def _fallback_explanation(material: dict) -> str:
    """LLM 없이 규칙 재료만으로 만드는 결정론적 피드백."""
    good = material.get("good_points", [])
    missed = material.get("missed_points", [])
    baseline = str(material.get("ai_baseline", "")).strip()
    sentences = []

    if good:
        sentences.append(f"잘 본 점은 다음과 같습니다. {good[0]}")
    else:
        sentences.append("이번 판단에서는 기준표의 핵심 요인을 충분히 짚지 못했습니다.")

    if missed:
        sentences.append(f"보완할 점은 다음과 같습니다. {missed[0]}")
    elif good:
        sentences.append("규칙 채점에서 추가로 확인된 주요 누락이나 함정은 없습니다.")

    if baseline:
        sentences.append(f"다음 판단에서는 다음 기준을 참고해 보세요. {baseline}")
    else:
        sentences.append("다음 판단에서는 상황의 핵심 요인과 위험을 함께 확인해 보세요.")

    return " ".join(sentences)


def generate_feedback(
    material: dict,
    turn_context: str,
    *,
    use_llm: bool = True,
) -> dict:
    """잘 본 점, 놓친 점, 해설을 같은 형식으로 반환한다."""
    good = list(material.get("good_points", []))
    missed = list(material.get("missed_points", []))
    fallback = _fallback_explanation(material)

    # 빈 서술 테스트나 호출 제한 상황에서는 LLM을 아예 사용하지 않는다.
    if not use_llm:
        return {
            "good_points": good,
            "missed_points": missed,
            "explanation": fallback,
        }

    prompt = _PROMPT.format(
        turn_context=turn_context,
        good_summary="\n".join(f"- {item}" for item in good) or "(없음)",
        missed_summary="\n".join(f"- {item}" for item in missed) or "(없음)",
        ai_baseline=material.get("ai_baseline", ""),
        score_summary=material.get("score_summary", ""),
    )

    result = generate_json(
        prompt,
        config.FEEDBACK_MODELS,
        temperature=0.3,
        required_keys=("explanation",),
    )

    if not result.ok or result.data is None:
        explanation = fallback
    else:
        value = result.data.get("explanation")
        if isinstance(value, str) and value.strip():
            explanation = value.strip()
        else:
            explanation = fallback

    return {
        "good_points": good,
        "missed_points": missed,
        "explanation": explanation,
    }
