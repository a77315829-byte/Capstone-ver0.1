"""6턴 종료 후 행동 패턴과 포트폴리오를 종합한다."""
from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any
from uuid import uuid4

from config import EVALUATOR_VERSION, SCHEMA_VERSION
from data.app_repository import AppRepository
from scoring import coaching_tracker


METRIC_LABELS = {
    "M1": "핵심요인 식별",
    "M2": "정보 해석",
    "M3": "위험 인식",
    "M4": "행동-근거 정합성",
    "M5": "논리 일관성",
    "PORTFOLIO": "포트폴리오 관리",
}


def _metric_value(metric: Any) -> str:
    return str(getattr(metric, "value", metric))


def _metric_map(evaluation: dict) -> dict[str, float]:
    result = {}
    for item in evaluation.get("scorecard", {}).get("metrics", []):
        result[_metric_value(item.get("metric"))] = float(item.get("score", 0))
    return result


def _portfolio_metrics(
    repository: AppRepository,
    scenario: dict,
    session: dict,
    snapshots: list[dict],
    orders: list[dict],
) -> dict:
    initial_value = int(session.get("initial_cash", 0))
    final = next((item for item in reversed(snapshots) if item.get("kind") == "FINAL"), None)
    if final is None:
        final = snapshots[-1] if snapshots else {"total_value": initial_value, "positions": []}
    final_value = int(final.get("total_value", initial_value))
    cumulative_return = (
        round((final_value / initial_value - 1) * 100, 4) if initial_value else 0.0
    )

    benchmark_id = scenario.get("benchmark_asset_id")
    start_date = scenario["turn_schedule"][0]["market_date"]
    final_date = scenario["final_valuation"]["market_date"]
    benchmark_start = repository.get_latest_price(benchmark_id, start_date) if benchmark_id else None
    benchmark_end = repository.get_latest_price(benchmark_id, final_date) if benchmark_id else None
    benchmark_return = None
    if benchmark_start and benchmark_end and float(benchmark_start.get("close", 0)):
        benchmark_return = round(
            (float(benchmark_end["close"]) / float(benchmark_start["close"]) - 1) * 100,
            4,
        )

    values = [float(item.get("total_value", 0)) for item in snapshots if item.get("total_value")]
    peak = 0.0
    max_drawdown = 0.0
    for value in values:
        peak = max(peak, value)
        if peak:
            max_drawdown = min(max_drawdown, (value / peak - 1) * 100)

    average_value = mean(values) if values else float(initial_value or 1)
    turnover = round(sum(float(item.get("amount", 0)) for item in orders) / average_value * 100, 4)
    analysis_snapshots = [
        item for item in snapshots if item.get("kind") in {"TURN_END", "FINAL"}
    ] or snapshots
    cash_weights = [float(item.get("cash_weight_pct", 0)) for item in analysis_snapshots]
    max_asset_weight = 0.0
    max_hhi = 0.0
    for snapshot in analysis_snapshots:
        weights = [float(item.get("weight_pct", 0)) for item in snapshot.get("positions", [])]
        max_asset_weight = max(max_asset_weight, max(weights, default=0.0))
        hhi = sum((weight / 100) ** 2 for weight in weights)
        max_hhi = max(max_hhi, hhi)

    sector_values: dict[str, int] = defaultdict(int)
    pnl_by_asset = {
        asset_id: int(value)
        for asset_id, value in session.get("realized_pnl_by_asset", {}).items()
    }
    final_position_by_asset = {
        position["asset_id"]: position for position in final.get("positions", [])
    }
    for position in final.get("positions", []):
        sector_values[position.get("industry_label") or "기타"] += int(position.get("market_value", 0))
        pnl_by_asset[position["asset_id"]] = (
            pnl_by_asset.get(position["asset_id"], 0)
            + int(position.get("unrealized_pnl", 0))
        )
    contributions = []
    for asset_id, total_pnl in pnl_by_asset.items():
        position = final_position_by_asset.get(asset_id, {})
        try:
            asset = repository.get_asset(asset_id)
        except Exception:
            asset = {"name": asset_id}
        contributions.append(
            {
                "asset_id": asset_id,
                "name": position.get("name", asset.get("name", asset_id)),
                "total_pnl": total_pnl,
                "weight_pct": position.get("weight_pct", 0),
            }
        )
    contributions.sort(key=lambda item: abs(item["total_pnl"]), reverse=True)
    sector_exposure = [
        {
            "sector": sector,
            "market_value": value,
            "weight_pct": round(value / final_value * 100, 2) if final_value else 0.0,
        }
        for sector, value in sorted(sector_values.items(), key=lambda item: item[1], reverse=True)
    ]

    return {
        "initial_value": initial_value,
        "final_value": final_value,
        "profit_loss": final_value - initial_value,
        "cumulative_return_pct": cumulative_return,
        "benchmark_asset_id": benchmark_id,
        "benchmark_return_pct": benchmark_return,
        "excess_return_pct": (
            round(cumulative_return - benchmark_return, 4)
            if benchmark_return is not None
            else None
        ),
        "max_drawdown_pct": round(max_drawdown, 4),
        "turnover_pct": turnover,
        "average_cash_weight_pct": round(mean(cash_weights), 2) if cash_weights else 100.0,
        "maximum_asset_weight_pct": round(max_asset_weight, 2),
        "concentration_hhi": round(max_hhi, 4),
        "valuation_point_count": len(values),
        "sector_exposure": sector_exposure,
        "asset_contributions": contributions,
    }


def _pattern(
    code: str,
    label: str,
    turns: list[int],
    explanation: str,
    recommendation: str,
) -> dict | None:
    unique_turns = sorted(set(turns))
    if not unique_turns:
        return None
    count = len(unique_turns)
    return {
        "pattern_code": code,
        "label": label,
        "classification": "REPEATED_PATTERN" if count >= 2 else "OBSERVATION",
        "occurrence_count": count,
        "evidence_turns": unique_turns,
        "confidence": round(min(0.95, 0.55 + count * 0.13), 2),
        "explanation": explanation,
        "recommendation": recommendation,
    }


def _behavior_patterns(
    repository: AppRepository,
    scenario: dict,
    evaluations: list[dict],
    snapshots: list[dict],
    orders: list[dict],
) -> list[dict]:
    evidence: dict[str, list[int]] = defaultdict(list)
    for evaluation in evaluations:
        turn_no = int(evaluation["turn_no"])
        metrics = _metric_map(evaluation)
        if metrics.get("M3", 5) < 3:
            evidence["RISK_NEGLECT"].append(turn_no)
        if metrics.get("M4", 5) < 3:
            evidence["ACTION_REASONING_MISMATCH"].append(turn_no)
        penalty_causes = {
            penalty.get("cause")
            for metric in evaluation.get("scorecard", {}).get("metrics", [])
            for penalty in metric.get("penalties", [])
        }
        if "PICKED_TRAP_ASSET" in penalty_causes:
            evidence["THEME_CONFUSION"].append(turn_no)

    for snapshot in snapshots:
        if snapshot.get("kind") != "TURN_END" or snapshot.get("turn_no") is None:
            continue
        turn_no = int(snapshot["turn_no"])
        if float(snapshot.get("cash_weight_pct", 100)) < 10:
            evidence["LOW_CASH_BUFFER"].append(turn_no)
        if max(
            (float(item.get("weight_pct", 0)) for item in snapshot.get("positions", [])),
            default=0,
        ) > 50:
            evidence["OVER_CONCENTRATION"].append(turn_no)

    orders_by_turn: dict[int, list[dict]] = defaultdict(list)
    schedule = {item["turn_no"]: item["market_date"] for item in scenario["turn_schedule"]}
    for order in orders:
        orders_by_turn[int(order["turn_no"])].append(order)
    for turn_no, turn_orders in orders_by_turn.items():
        if len(turn_orders) >= 3:
            evidence["EXCESSIVE_TRADING"].append(turn_no)
        if turn_no <= 1:
            continue
        for order in turn_orders:
            if order.get("side") != "BUY":
                continue
            current = repository.get_latest_price(order["asset_id"], schedule[turn_no])
            previous = repository.get_latest_price(order["asset_id"], schedule[turn_no - 1])
            if current and previous and float(previous.get("close", 0)):
                rise = (float(current["close"]) / float(previous["close"]) - 1) * 100
                if rise >= 10:
                    evidence["CHASE_BUYING"].append(turn_no)
                    break

    definitions = [
        ("CHASE_BUYING", "상승 이후 추격매수", "가격이 크게 오른 다음 턴에 매수한 행동이 관찰됐다.", "최근 상승률과 호재의 선반영 가능성을 함께 확인하세요."),
        ("OVER_CONCENTRATION", "특정 종목 집중", "단일 종목 비중이 50%를 넘은 포트폴리오가 관찰됐다.", "종목별 상한 비중을 정하고 분산 원칙을 사용하세요."),
        ("EXCESSIVE_TRADING", "잦은 매매", "한 턴에 세 건 이상의 주문을 낸 행동이 관찰됐다.", "주문 전에 목표 비중을 정해 불필요한 회전율을 줄이세요."),
        ("LOW_CASH_BUFFER", "낮은 현금 여유", "현금 비중이 10% 미만으로 낮아진 턴이 관찰됐다.", "불확실성이 큰 구간에는 대응 가능한 현금을 남겨두세요."),
        ("RISK_NEGLECT", "위험요인 누락", "위험 인식 점수가 낮은 턴이 관찰됐다.", "매수 근거와 함께 반대 시나리오와 손실 요인을 적어보세요."),
        ("ACTION_REASONING_MISMATCH", "판단과 행동 불일치", "작성한 근거와 실제 행동의 정합성이 낮은 턴이 관찰됐다.", "근거가 가리키는 방향과 주문 강도를 마지막에 다시 비교하세요."),
        ("THEME_CONFUSION", "직접 수혜와 테마 혼동", "함정 종목에 비중을 둔 행동이 관찰됐다.", "뉴스가 기업의 매출과 이익으로 연결되는 직접 경로를 확인하세요."),
    ]
    return [
        value
        for code, label, explanation, recommendation in definitions
        if (value := _pattern(code, label, evidence[code], explanation, recommendation))
    ]


def build_scenario_evaluation(
    repository: AppRepository,
    session: dict,
    completed_at: str,
) -> dict:
    scenario = repository.get_scenario(session["scenario_id"], session["scenario_version"])
    evaluations = repository.list_turn_evaluations(session["session_id"])
    snapshots = repository.list_snapshots(session["session_id"])
    orders = [
        order
        for order in repository.list_orders(session["session_id"])
        if int(order.get("filled_quantity", order.get("quantity", 0)) or 0) > 0
    ]
    metric_values: dict[str, list[float]] = defaultdict(list)
    timeline = []
    for evaluation in evaluations:
        metrics = _metric_map(evaluation)
        for metric, score in metrics.items():
            metric_values[metric].append(score)
        timeline.append(
            {
                "turn_no": evaluation["turn_no"],
                "turn_score": evaluation.get("scorecard", {}).get("turn_score", 0),
                "metrics": metrics,
            }
        )
    metric_averages = {
        metric: round(mean(values), 2)
        for metric, values in metric_values.items()
        if values
    }
    turn_scores = [float(item["turn_score"]) for item in timeline if item["turn_score"]]
    overall_score = round(mean(turn_scores), 2) if turn_scores else 0.0
    patterns = _behavior_patterns(repository, scenario, evaluations, snapshots, orders)
    portfolio = _portfolio_metrics(repository, scenario, session, snapshots, orders)
    coaching_progress = coaching_tracker.summarize_progress(evaluations)
    coaching_summary = coaching_tracker.progress_summary(coaching_progress)
    strengths = [
        f"{METRIC_LABELS.get(metric, metric)}이 안정적입니다({score:.2f}/5)."
        for metric, score in metric_averages.items()
        if score >= 4
    ]
    improvements = [
        f"{METRIC_LABELS.get(metric, metric)}을 우선 보완할 필요가 있습니다({score:.2f}/5)."
        for metric, score in metric_averages.items()
        if score < 3
    ]
    repeated = [item for item in patterns if item["classification"] == "REPEATED_PATTERN"]
    summary_parts = [f"6턴 판단 과정의 평균 점수는 {overall_score:.2f}/5입니다."]
    if repeated:
        summary_parts.append(f"반복 행동으로 '{repeated[0]['label']}'이 확인됐습니다.")
    else:
        summary_parts.append("한 시나리오에서 확정적으로 반복된 행동 패턴은 많지 않았습니다.")
    summary_parts.append(
        f"최종 포트폴리오 수익률은 {portfolio['cumulative_return_pct']:.2f}%이며, 수익률은 판단 점수와 분리해 해석합니다."
    )
    summary_parts.append(coaching_summary)
    next_actions: list[str] = []
    for message in [
        *coaching_progress["unresolved_actions"],
        *(item["recommendation"] for item in repeated),
    ]:
        if message and message not in next_actions:
            next_actions.append(message)
        if len(next_actions) >= 3:
            break
    return {
        "schema_version": SCHEMA_VERSION,
        "evaluation_id": str(uuid4()),
        "user_id": session["user_id"],
        "session_id": session["session_id"],
        "scenario_id": session["scenario_id"],
        "scenario_version": session["scenario_version"],
        "evaluator_version": EVALUATOR_VERSION,
        "completed_at": completed_at,
        "decision_evaluation": {
            "overall_score": overall_score,
            "metric_averages": metric_averages,
            "timeline": timeline,
        },
        "behavior_patterns": patterns,
        "coaching_progress": coaching_progress,
        "portfolio_analysis": portfolio,
        "feedback": {
            "summary": " ".join(summary_parts),
            "strengths": strengths,
            "improvements": improvements,
            "coaching_summary": coaching_summary,
            "next_actions": next_actions,
        },
    }


def rebuild_user_profile(repository: AppRepository, user_id: str, updated_at: str) -> dict:
    evaluations = repository.list_user_evaluations(user_id)
    metric_values: dict[str, list[float]] = defaultdict(list)
    pattern_stats: dict[str, dict] = {}
    portfolio_values: dict[str, list[float]] = defaultdict(list)
    for evaluation in evaluations:
        for metric, score in evaluation.get("decision_evaluation", {}).get("metric_averages", {}).items():
            metric_values[metric].append(float(score))
        for pattern in evaluation.get("behavior_patterns", []):
            item = pattern_stats.setdefault(
                pattern["pattern_code"],
                {
                    "pattern_code": pattern["pattern_code"],
                    "label": pattern["label"],
                    "observed_scenarios": 0,
                    "total_occurrences": 0,
                },
            )
            item["observed_scenarios"] += 1
            item["total_occurrences"] += int(pattern["occurrence_count"])
        portfolio = evaluation.get("portfolio_analysis", {})
        for field in ("turnover_pct", "average_cash_weight_pct", "maximum_asset_weight_pct"):
            if portfolio.get(field) is not None:
                portfolio_values[field].append(float(portfolio[field]))
    for item in pattern_stats.values():
        scenario_ratio = item["observed_scenarios"] / max(1, len(evaluations))
        item["confidence"] = round(min(0.95, 0.45 + scenario_ratio * 0.45), 2)
        item["stable_tendency"] = len(evaluations) >= 2 and item["observed_scenarios"] >= 2
    profile = {
        "schema_version": SCHEMA_VERSION,
        "user_id": user_id,
        "completed_scenario_count": len(evaluations),
        "dimension_averages": {
            metric: round(mean(values), 2) for metric, values in metric_values.items()
        },
        "pattern_statistics": sorted(
            pattern_stats.values(),
            key=lambda item: (item["stable_tendency"], item["total_occurrences"]),
            reverse=True,
        ),
        "portfolio_tendencies": {
            field: round(mean(values), 2) if values else None
            for field, values in portfolio_values.items()
        },
        "updated_at": updated_at,
    }
    repository.save_user_profile(profile)
    return profile
