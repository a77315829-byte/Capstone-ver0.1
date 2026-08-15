"""서버(uvicorn)를 띄우지 않고 파이프라인을 직접 호출해 테스트하는 CLI 스크립트.
요인 조회 -> 스코어링 -> GPT-4o 서술 생성까지 전체 흐름을 한 번에 확인할 수 있다.
(실제 KIS 웹소켓 연동 전, 로컬 개발 단계에서 쓰는 용도)

실행 예시 (프로젝트 루트에서):
  python -m scripts.run_local judge --symbol 011070
  python -m scripts.run_local compare --symbol 011070 --user-judge 매수
"""
import argparse
import asyncio
import json

from app.pipeline import run_judgment_pipeline
from app.history.repository import get_latest_judgment
from app.narrative.generator import generate_comparison

# 실제 KIS 연동 전 테스트용 샘플 시세 데이터.
# 값을 바꿔가며 판단(매수/매도/관망)이 어떻게 달라지는지 확인할 수 있다.
SAMPLE_MARKET_DATA = {
    "foreign_net_flow_flipped_negative": True,
    "foreign_net_flow": 500000,
    "rsi_14": 67,
    "sector_index_change_pct": -1.5,
}


async def run_judge(symbol: str):
    result = await run_judgment_pipeline(symbol, SAMPLE_MARKET_DATA)
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


async def run_compare(symbol: str, user_judge: str):
    doc = await get_latest_judgment(symbol)
    if doc is None:
        print("먼저 judge 모드로 AI 판단을 한 번 생성해야 합니다.")
        return
    explanation = await generate_comparison(user_judge, doc["judge"], doc["factors"])
    print(json.dumps({
        "user_judge": user_judge,
        "ai_judge": doc["judge"],
        "explanation": explanation,
    }, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description="서버 없이 AI 판단 파이프라인 테스트")
    subparsers = parser.add_subparsers(dest="mode", required=True)

    judge_parser = subparsers.add_parser("judge", help="AI 판단 생성 (샘플 시세 데이터 사용)")
    judge_parser.add_argument("--symbol", required=True)

    compare_parser = subparsers.add_parser("compare", help="사용자 판단과 AI 판단 비교")
    compare_parser.add_argument("--symbol", required=True)
    compare_parser.add_argument("--user-judge", required=True, choices=["매수", "매도", "관망"])

    args = parser.parse_args()

    if args.mode == "judge":
        asyncio.run(run_judge(args.symbol))
    elif args.mode == "compare":
        asyncio.run(run_compare(args.symbol, args.user_judge))


if __name__ == "__main__":
    main()
