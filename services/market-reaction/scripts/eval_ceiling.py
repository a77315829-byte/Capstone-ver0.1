"""정답 세트의 상한선/기준선을 계산한다 (분석 전용, 제품 경로와 무관).

'우리 시스템의 정확도가 낮은 것이 모델 문제인가, 과제가 원래 예측 불가능해서인가'
를 가르기 위한 측정이다. LLM 을 호출하지 않으며 data/eval_set.json 만 읽는다.

실행 (services/market-reaction 디렉터리에서):
    python -m scripts.eval_ceiling
"""

from __future__ import annotations

import argparse
import collections
import json
import re
from pathlib import Path

# 데이터를 보지 않고 재무이론으로 미리 정한 매핑(과적합 아님).
# 자사주 매입/무상증자는 주주환원·유통물량 축소로 호재, 자사주 처분/유상증자/감자/
# 희석증권 발행은 유통물량 증가·희석으로 악재, 구조 변경(분할·합병·양수도)은 방향이
# 사전에 정해지지 않으므로 중립으로 둔다.
THEORY_RULE = {
    "자기주식취득결정": "positive",
    "자기주식취득신탁계약체결결정": "positive",
    "무상증자결정": "positive",
    "해외증권시장주권등상장": "positive",
    "해외증권시장주권등상장결정": "positive",
    "자기주식처분결정": "negative",
    "자기주식취득신탁계약해지결정": "negative",
    "유상증자결정": "negative",
    "감자결정": "negative",
    "전환사채권발행결정": "negative",
    "교환사채권발행결정": "negative",
    "상각형조건부자본증권발행결정": "negative",
    "해외증권시장주권등상장폐지": "negative",
    "회사분할결정": "neutral",
    "회사합병결정": "neutral",
    "영업양수결정": "neutral",
    "타법인주식및출자증권양수결정": "neutral",
    "타법인주식및출자증권양도결정": "neutral",
}


def disclosure_kind(title: str) -> str:
    """'[기재정정]주요사항보고서(유상증자결정)' → '유상증자결정'."""
    stripped = re.sub(r"^\[[^\]]*\]", "", title).strip()
    match = re.search(r"주요사항보고서\((.*)\)", stripped)
    return match.group(1) if match else stripped


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-set", default="data/eval_set.json")
    args = parser.parse_args()

    cases = json.loads(Path(args.eval_set).read_text(encoding="utf-8"))["cases"]
    n = len(cases)
    truth = collections.Counter(c["label"] for c in cases)

    majority = max(truth.values()) / n
    prior_random = sum((v / n) ** 2 for v in truth.values())
    theory = sum(
        1 for c in cases if THEORY_RULE.get(disclosure_kind(c["event_title"])) == c["label"]
    ) / n

    by_kind = collections.defaultdict(collections.Counter)
    for c in cases:
        by_kind[disclosure_kind(c["event_title"])][c["label"]] += 1
    oracle_kind = sum(max(d.values()) for d in by_kind.values()) / n

    by_pair = collections.defaultdict(collections.Counter)
    for c in cases:
        by_pair[(disclosure_kind(c["event_title"]), c["stock_code"])][c["label"]] += 1
    oracle_pair = sum(max(d.values()) for d in by_pair.values()) / n

    print(f"케이스 {n}건 | 정답 {dict(truth)}\n")
    for name, value in [
        ("사전확률 무작위 (하한)", prior_random),
        ("다수클래스 '무조건 악재'", majority),
        ("이론 기반 규칙 (데이터 미참조)", theory),
        ("오라클: 공시종류 룩업 (상한, 과적합)", oracle_kind),
        ("오라클: 종류×종목 룩업 (심한 과적합)", oracle_pair),
    ]:
        print(f"  {name:38} {value * 100:6.1f}%")


if __name__ == "__main__":
    main()
