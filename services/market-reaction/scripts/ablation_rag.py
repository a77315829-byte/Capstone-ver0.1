"""RAG ablation 실험 스크립트 (수동 실행 전용).

"RAG가 실제로 분석 결과를 바꾸는가"를 정량 확인한다. 동일한 뉴스를 사업 구조가 반대인
두 종목에 각각 넣고, RAG on/off 두 조건으로 돌려 결과를 비교한다.

측정 단계:
  level a — ②단계(analyze_external_context)만. LLM 호출 1회/런. 기전(mechanism) 증거:
            impact_direction / impact_strength / positive_factors / negative_factors 가
            검색 문서 유무로 달라지는지.
  level b — 전체 파이프라인(run_market_reaction_simulation). LLM 호출 약 9회/런. 결과
            (outcome) 증거: 최종 market_pressure(매수/매도/관망 %)까지 달라지는지.

재현성: LLM 표본 변동을 줄이기 위해 OLLAMA_TEMPERATURE 를 0 으로 강제한다(아래 import
순서 주의 — app.config 보다 먼저 설정해야 적용된다). 그래도 완전 결정론은 아니므로
--trials 로 반복해 안정성을 함께 본다.

사전 준비: .env (MongoDB/임베딩 설정), Ollama 실행 + llama3.1:8b / bge-m3 pull.

실행 (simulator/market_reaction 디렉터리에서):
    python -m scripts.ablation_rag --level a --trials 2
    python -m scripts.ablation_rag --level b --trials 1
"""

from __future__ import annotations

import os

# app.config(pydantic-settings) 보다 먼저 설정해야 .env 의 0.3 을 덮어쓴다.
# OS 환경변수가 .env 보다 우선하므로 이 한 줄로 temperature 가 0 으로 고정된다.
os.environ["OLLAMA_TEMPERATURE"] = "0"

import argparse  # noqa: E402
import asyncio  # noqa: E402
import json  # noqa: E402
import time  # noqa: E402
from pathlib import Path  # noqa: E402
from typing import Any, Dict, List  # noqa: E402

from app.config import settings  # noqa: E402
from app.core import external_context as ec  # noqa: E402
from app.schemas.request import SelectedStock, SimulationRequest  # noqa: E402
from app.service import SimulationRejectedError, run_market_reaction_simulation  # noqa: E402

# 동일 뉴스 / 사업 구조가 반대인 두 종목. expected 는 사전 가설(채점 기준이 아니라 해석용).
CASES: List[Dict[str, Any]] = [
    {
        "id": "fx_won_weak",
        "news": (
            "원/달러 환율이 장중 1,480원을 돌파하며 연고점을 경신했다. "
            "시장에서는 원화 약세가 당분간 이어질 것으로 보는 시각이 우세하다."
        ),
        "stocks": [
            ("005380", "현대차", "해외 매출 비중 높음 → 원화 약세는 채산성 개선(호재 예상)"),
            ("015760", "한국전력", "연료(LNG·석탄) 수입 의존 → 원화 약세는 원가 상승(악재 예상)"),
        ],
    },
    {
        "id": "rate_hike",
        "news": (
            "한국은행이 기준금리를 0.50%p 인상했다. 총재는 물가 흐름에 따라 "
            "추가 인상 가능성도 열어두겠다고 밝혔다."
        ),
        "stocks": [
            ("105560", "KB금융", "예대마진 확대 → 호재 예상"),
            ("373220", "LG에너지솔루션", "대규모 설비투자 차입 비용 상승 → 악재 예상"),
        ],
    },
]


def _make_request(code: str, name: str, news: str) -> SimulationRequest:
    # stock_data 를 주지 않아 시세는 stub 으로 고정된다 — RAG 외의 변수를 줄이기 위함.
    return SimulationRequest(
        user_id="ablation",
        selected_stock=SelectedStock(code=code, name=name),
        input_text=news,
    )


class _RagOff:
    """RAG 검색만 비활성화하는 컨텍스트 매니저(검색 결과를 빈 리스트로 고정)."""

    def __enter__(self):
        self._original = ec.retrieve_relevant_documents

        async def _empty(stock_code: str, query_text: str):
            return []

        ec.retrieve_relevant_documents = _empty
        return self

    def __exit__(self, *exc):
        ec.retrieve_relevant_documents = self._original
        return False


async def _run_level_a(req: SimulationRequest) -> Dict[str, Any]:
    ext, fb, rag_sources = await ec.analyze_external_context(req)
    return {
        "impact_direction": ext.impact_direction.value,
        "impact_strength": ext.impact_strength.value,
        "event_type": ext.event_type.value if hasattr(ext.event_type, "value") else str(ext.event_type),
        "positive_factors": ext.positive_factors,
        "negative_factors": ext.negative_factors,
        "uncertainty_factors": ext.uncertainty_factors,
        "fallback_modules": fb,
        "rag_source_count": len(rag_sources),
        "rag_source_titles": [s.title for s in rag_sources],
    }


async def _run_level_b(req: SimulationRequest) -> Dict[str, Any]:
    try:
        resp = await run_market_reaction_simulation(req)
    except SimulationRejectedError as exc:
        return {"rejected": True, "reason_code": exc.reason_code}
    return {
        "rejected": False,
        "impact_direction": resp.impact_analysis.impact_direction.value,
        "impact_strength": resp.impact_analysis.impact_strength.value,
        "market_pressure": {
            "buy": resp.market_pressure.buy,
            "sell": resp.market_pressure.sell,
            "hold": resp.market_pressure.hold,
            "dominant": resp.market_pressure.dominant.value,
        },
        "sentiment": resp.market_sentiment.code.value,
        "analysis_confidence": resp.analysis_confidence.score,
        "fallback_modules": resp.meta.fallback_modules,
        "rag_source_count": len(resp.meta.rag_sources),
        "rag_source_titles": [s.title for s in resp.meta.rag_sources],
        "agent_directions": [a.reaction_direction.value for a in resp.agent_reactions],
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", choices=["a", "b"], default="a")
    parser.add_argument("--trials", type=int, default=1)
    parser.add_argument(
        "--out", default=None, help="결과 JSON 경로 (기본: data/ablation_rag_<level>.json)"
    )
    args = parser.parse_args()

    runner = _run_level_a if args.level == "a" else _run_level_b
    out_path = Path(args.out or f"data/ablation_rag_{args.level}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    results: List[Dict[str, Any]] = []
    total = sum(len(c["stocks"]) for c in CASES) * 2 * args.trials
    done = 0
    t_start = time.time()

    for case in CASES:
        for code, name, expected in case["stocks"]:
            for condition in ("rag_on", "rag_off"):
                for trial in range(1, args.trials + 1):
                    req = _make_request(code, name, case["news"])
                    t0 = time.time()
                    if condition == "rag_off":
                        with _RagOff():
                            out = await runner(req)
                    else:
                        out = await runner(req)
                    elapsed = round(time.time() - t0, 1)
                    done += 1
                    results.append(
                        {
                            "case_id": case["id"],
                            "stock_code": code,
                            "stock_name": name,
                            "expected": expected,
                            "condition": condition,
                            "trial": trial,
                            "elapsed_sec": elapsed,
                            **out,
                        }
                    )
                    print(
                        f"[{done}/{total}] {case['id']} {name} {condition} t{trial} "
                        f"→ {out.get('impact_direction')} / "
                        f"{out.get('market_pressure', {}).get('buy', '-') if args.level == 'b' else ''} "
                        f"(rag={out.get('rag_source_count')}, fb={out.get('fallback_modules')}, {elapsed}s)",
                        flush=True,
                    )
                    # 중간 실패에도 지금까지 결과는 남도록 매 런마다 저장
                    out_path.write_text(
                        json.dumps(
                            {
                                "level": args.level,
                                "trials": args.trials,
                                "llm_model": settings.ollama_model,
                                "llm_temperature": settings.ollama_temperature,
                                "embedding_model": settings.ollama_embedding_model,
                                "results": results,
                            },
                            ensure_ascii=False,
                            indent=2,
                        ),
                        encoding="utf-8",
                    )

    print(f"\n완료: {out_path} ({round(time.time() - t_start, 1)}s, temperature={settings.ollama_temperature})")


if __name__ == "__main__":
    asyncio.run(main())
