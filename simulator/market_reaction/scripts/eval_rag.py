"""정답 세트로 RAG on/off 판정 정확도를 측정한다 (수동 실행 전용).

scripts/build_eval_set.py 가 만든 data/eval_set.json 의 각 케이스에 대해 ②단계
(analyze_external_context)를 RAG on/off 로 실행하고, 산출된 impact_direction 을
정답 라벨(KOSPI 대비 초과수익률 3-way)과 비교한다.

미래 정보 누출 방지: 검색 기준일을 공시 접수일로 고정해 그 이전 공시만 근거로 쓴다.

실행 (simulator/market_reaction 디렉터리에서):
    python -m scripts.eval_rag --limit 20        # 빠른 확인
    python -m scripts.eval_rag                   # 전체
"""

from __future__ import annotations

import os

# app.config 보다 먼저 설정해야 .env 의 temperature 를 덮어쓴다.
os.environ["OLLAMA_TEMPERATURE"] = "0"

import argparse  # noqa: E402
import asyncio  # noqa: E402
import collections  # noqa: E402
import json  # noqa: E402
import time  # noqa: E402
from pathlib import Path  # noqa: E402
from typing import List  # noqa: E402

from app.config import settings  # noqa: E402
from app.core import external_context as ec  # noqa: E402
from app.schemas.request import SelectedStock, SimulationRequest  # noqa: E402

STOCK_NAMES = {
    "005930": "삼성전자", "000660": "SK하이닉스", "373220": "LG에너지솔루션",
    "207940": "삼성바이오로직스", "005380": "현대차", "000270": "기아",
    "068270": "셀트리온", "005490": "POSCO홀딩스", "035420": "NAVER",
    "035720": "카카오", "051910": "LG화학", "006400": "삼성SDI",
    "105560": "KB금융", "055550": "신한지주", "012330": "현대모비스",
    "028260": "삼성물산", "066570": "LG전자", "003670": "포스코퓨처엠",
    "034730": "SK", "015760": "한국전력",
}


class _RagOff:
    """RAG 검색만 비활성화한다(그 외 경로는 동일)."""

    def __enter__(self):
        self._original = ec.retrieve_relevant_documents

        async def _empty(stock_code, query_text, published_before=None):
            return []

        ec.retrieve_relevant_documents = _empty
        return self

    def __exit__(self, *exc):
        ec.retrieve_relevant_documents = self._original
        return False


def _iso(yyyymmdd: str) -> str:
    return f"{yyyymmdd[:4]}-{yyyymmdd[4:6]}-{yyyymmdd[6:]}"


# 공시 본문은 3,000자 내외라 그대로 넣어도 프롬프트에 부담이 없다.
_BODY_CHAR_LIMIT = 3000


def build_input_text(case: dict, stock_name: str) -> str:
    """평가 입력 텍스트를 만든다. 본문이 있으면 본문을, 없으면 제목만 쓴다.

    제목만 쓰면 방향을 가르는 정보가 빠진다 — 자기주식취득은 교과서적으로 호재지만
    취득목적이 '임직원 주식보상' 이면 향후 유통물량 증가를 뜻해 성격이 다르다.
    이 정보는 제목이 아니라 본문에만 있다.
    """
    body = (case.get("event_body") or "").strip()
    if body:
        return f"{stock_name} 공시: {case['event_title']}\n\n{body[:_BODY_CHAR_LIMIT]}"
    return f"{stock_name} 공시: {case['event_title']}"


def _make_request(case: dict) -> SimulationRequest:
    name = STOCK_NAMES.get(case["stock_code"], case["stock_code"])
    return SimulationRequest(
        user_id="eval",
        selected_stock=SelectedStock(code=case["stock_code"], name=name),
        input_text=build_input_text(case, name),
    )


def _summarize(rows: List[dict], label: str) -> dict:
    n = len(rows)
    if n == 0:
        return {}
    correct = sum(1 for r in rows if r["predicted"] == r["truth"])
    # 방향성 정확도: 정답이 neutral 이 아닌 케이스만, 반대 방향으로 틀렸는지
    directional = [r for r in rows if r["truth"] in ("positive", "negative")]
    dir_correct = sum(1 for r in directional if r["predicted"] == r["truth"])
    flipped = sum(
        1 for r in directional
        if r["predicted"] in ("positive", "negative") and r["predicted"] != r["truth"]
    )
    pred_dist = collections.Counter(r["predicted"] for r in rows)
    print(f"\n### {label}  (n={n})")
    print(f"  전체 정확도       : {correct}/{n} = {correct/n*100:.1f}%")
    print(f"  방향 케이스 정확도 : {dir_correct}/{len(directional)} = "
          f"{dir_correct/len(directional)*100:.1f}%" if directional else "")
    print(f"  반대로 예측       : {flipped}/{len(directional)}" if directional else "")
    print(f"  예측 분포         : {dict(pred_dist)}")
    return {
        "n": n, "accuracy": correct / n, "correct": correct,
        "directional_accuracy": dir_correct / len(directional) if directional else None,
        "flipped": flipped, "prediction_distribution": dict(pred_dist),
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-set", default="data/eval_set.json")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--out", default="data/eval_rag_result.json")
    parser.add_argument(
        "--top-k", type=int, default=None,
        help="검색 청크 수 override. 입력이 충실할 때 검색이 결정적 정보를 희석하는지 확인용.",
    )
    args = parser.parse_args()

    if args.top_k is not None:
        from app.services import document_retrieval
        document_retrieval._TOP_K = args.top_k
        print(f"검색 청크 수 override: top_k={args.top_k}", flush=True)

    data = json.loads(Path(args.eval_set).read_text(encoding="utf-8"))
    cases = data["cases"][: args.limit] if args.limit else data["cases"]

    truth_dist = collections.Counter(c["label"] for c in cases)
    majority = max(truth_dist.values()) / len(cases)
    print(f"케이스 {len(cases)}건 | 정답 분포 {dict(truth_dist)} | "
          f"다수클래스 기준선 {majority*100:.1f}%", flush=True)

    rows: List[dict] = []
    t0 = time.time()
    for i, case in enumerate(cases, 1):
        req = _make_request(case)
        cutoff = _iso(case["event_date"])
        for condition in ("rag_on", "rag_off"):
            if condition == "rag_off":
                with _RagOff():
                    ext, fb, sources = await ec.analyze_external_context(req, published_before=cutoff)
            else:
                ext, fb, sources = await ec.analyze_external_context(req, published_before=cutoff)
            rows.append({
                "stock_code": case["stock_code"], "event_date": case["event_date"],
                "event_title": case["event_title"], "condition": condition,
                "predicted": ext.impact_direction.value, "truth": case["label"],
                "excess_return": case["excess_return"],
                "rag_source_count": len(sources), "fallback_modules": fb,
            })
        if i % 10 == 0 or i == len(cases):
            print(f"  [{i}/{len(cases)}] {time.time()-t0:.0f}s 경과", flush=True)
            Path(args.out).write_text(
                json.dumps({"model": settings.ollama_model, "rows": rows},
                           ensure_ascii=False, indent=2), encoding="utf-8")

    on = [r for r in rows if r["condition"] == "rag_on"]
    off = [r for r in rows if r["condition"] == "rag_off"]
    fb_count = sum(1 for r in rows if r["fallback_modules"])
    print(f"\nfallback 발생: {fb_count}/{len(rows)}건")
    summary = {"rag_on": _summarize(on, "RAG ON"), "rag_off": _summarize(off, "RAG OFF")}

    Path(args.out).write_text(json.dumps({
        "model": settings.ollama_model, "temperature": settings.ollama_temperature,
        "majority_baseline": majority, "summary": summary, "rows": rows,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n완료: {args.out} ({time.time()-t0:.0f}s)")


if __name__ == "__main__":
    asyncio.run(main())
