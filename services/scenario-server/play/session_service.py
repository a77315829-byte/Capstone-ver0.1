"""시나리오 시작부터 턴 진행, 채점, 최종평가까지 조정한다."""
from __future__ import annotations

from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from enum import Enum
import json
from typing import Any
from uuid import uuid4

from config import EVALUATOR_VERSION, SCHEMA_VERSION
from data.app_repository import AppRepository, NotFoundError
from data.models import Action, Holding, QuestionAnswer, UserDecision
from play.errors import DataUnavailableError, PlayError
from play.final_evaluation_service import build_scenario_evaluation, rebuild_user_profile
from play.portfolio_service import (
    build_portfolio_state,
    execute_order,
    make_snapshot,
)
from scoring import coaching_tracker, engine


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def to_primitive(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if is_dataclass(value):
        return to_primitive(asdict(value))
    if isinstance(value, dict):
        return {str(key): to_primitive(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_primitive(item) for item in value]
    return value


class ScenarioSessionService:
    def __init__(self, repository: AppRepository | None = None) -> None:
        self.repository = repository or AppRepository()

    def list_scenarios(self) -> list[dict]:
        result = []
        for scenario in self.repository.list_scenarios():
            result.append(
                {
                    "scenario_id": scenario["scenario_id"],
                    "version": scenario["version"],
                    "title": scenario["title"],
                    "description": scenario.get("description", ""),
                    "difficulty": scenario.get("difficulty", ""),
                    "total_turns": scenario["total_turns"],
                    "initial_cash": scenario.get("simulation", {}).get("initial_cash", 0),
                    "learning_points": scenario.get("learning_points", []),
                }
            )
        return result

    def start_session(self, user_id: str, scenario_id: str) -> dict:
        user_id = user_id.strip()
        if not user_id:
            raise PlayError("INVALID_USER", "사용자 ID가 필요합니다.")
        scenario = self.repository.get_scenario(scenario_id)
        now = utc_now()
        initial_cash = int(scenario.get("simulation", {}).get("initial_cash", 10_000_000))
        session = {
            "schema_version": SCHEMA_VERSION,
            "session_id": str(uuid4()),
            "user_id": user_id,
            "scenario_id": scenario_id,
            "scenario_version": int(scenario["version"]),
            "status": "ACTIVE",
            "current_turn": 1,
            "initial_cash": initial_cash,
            "cash": initial_cash,
            "positions": [],
            "realized_pnl_by_asset": {},
            "revision": 0,
            "started_at": now,
            "updated_at": now,
            "completed_at": None,
            "final_evaluation_id": None,
        }
        self.repository.create_session(session)
        first_date = scenario["turn_schedule"][0]["market_date"]
        portfolio = build_portfolio_state(self.repository, session, first_date)
        self.repository.save_snapshot(
            make_snapshot(
                session,
                portfolio,
                turn_no=1,
                kind="TURN_START",
                sequence=10,
                created_at=now,
            )
        )
        return self._session_public(session)

    def _session_public(self, session: dict) -> dict:
        return {
            "session_id": session["session_id"],
            "user_id": session["user_id"],
            "scenario_id": session["scenario_id"],
            "scenario_version": session["scenario_version"],
            "status": session["status"],
            "current_turn": session["current_turn"],
            "started_at": session["started_at"],
            "completed_at": session.get("completed_at"),
            "final_evaluation_id": session.get("final_evaluation_id"),
        }

    def get_turn_view(self, session_id: str) -> dict:
        session = self.repository.get_session(session_id)
        scenario = self.repository.get_scenario(
            session["scenario_id"], session["scenario_version"]
        )
        if session["status"] == "COMPLETED":
            return {
                "session": self._session_public(session),
                "result_ready": True,
                "evaluation_id": session.get("final_evaluation_id"),
            }
        if session["status"] == "FINALIZING":
            return {
                "session": self._session_public(session),
                "result_ready": False,
                "finalizing": True,
            }
        turn_no = int(session["current_turn"])
        turn = self.repository.get_turn(
            session["scenario_id"], session["scenario_version"], turn_no
        )
        market_snapshot = self.repository.get_market_snapshot(
            turn.get("market_snapshot_id", "")
        )
        news = self.repository.list_news(turn.get("news_ids", []))
        questions = self.repository.get_turn_questions(
            session["scenario_id"], session["scenario_version"], turn_no
        )
        previous_guidance = coaching_tracker.latest_guidance(
            self.repository.list_turn_evaluations(session_id),
            turn_no,
        )
        assets = self._asset_summaries(scenario["asset_ids"], turn["market_date"])
        portfolio = build_portfolio_state(
            self.repository,
            session,
            turn["market_date"],
            allow_missing_prices=True,
        )
        prior_turn_end = next(
            (
                item
                for item in reversed(self.repository.list_snapshots(session["session_id"]))
                if item.get("kind") == "TURN_END" and int(item.get("turn_no") or 0) < turn_no
            ),
            None,
        )
        turn_base_value = int(
            prior_turn_end.get("total_value", session["initial_cash"])
            if prior_turn_end
            else session["initial_cash"]
        )
        portfolio["turn_base_value"] = turn_base_value
        portfolio["turn_return_pct"] = (
            round((portfolio["total_value"] / turn_base_value - 1) * 100, 4)
            if turn_base_value > 0
            else 0.0
        )
        return {
            "session": self._session_public(session),
            "progress": {
                "current_turn": turn_no,
                "total_turns": scenario["total_turns"],
                "market_date": turn["market_date"],
                "next_market_date": turn.get("next_market_date"),
                "final_valuation_date": scenario["final_valuation"]["market_date"],
            },
            "scenario": {
                "scenario_id": scenario["scenario_id"],
                "title": scenario["title"],
                "description": scenario.get("description", ""),
                "difficulty": scenario.get("difficulty", ""),
                "learning_points": scenario.get("learning_points", []),
            },
            "turn": {
                "turn_no": turn_no,
                "title": turn["title"],
                "phase": turn.get("phase", ""),
                "summary": turn.get("summary", ""),
            },
            "market_state": market_snapshot,
            "news": news,
            "assets": assets,
            "default_asset_id": scenario.get("default_asset_id"),
            "portfolio": portfolio,
            "questions": questions,
            "coaching": {
                "reminders": previous_guidance,
            },
        }

    def _asset_summaries(self, asset_ids: list[str], market_date: str) -> list[dict]:
        assets = self.repository.list_assets(asset_ids)
        result = []
        for asset in assets:
            price = self.repository.get_latest_price(asset["asset_id"], market_date)
            previous = self.repository.get_previous_price(asset["asset_id"], market_date)
            close = int(price["close"]) if price and price.get("close") is not None else None
            previous_close = (
                int(previous["close"])
                if previous and previous.get("close") is not None
                else None
            )
            change = close - previous_close if close is not None and previous_close else None
            change_pct = (
                round(change / previous_close * 100, 2)
                if change is not None and previous_close
                else None
            )
            result.append(
                {
                    "asset_id": asset["asset_id"],
                    "name": asset["name"],
                    "market": asset["market"],
                    "asset_type": asset["asset_type"],
                    "industry_label": asset.get("industry_label", ""),
                    "current_price": close,
                    "previous_close": previous_close,
                    "change": change,
                    "change_pct": change_pct,
                    "volume": int(price.get("volume", 0)) if price else None,
                    "price_date": price.get("trade_date") if price else None,
                    "data_available": price is not None,
                }
            )
        return result

    def get_chart(
        self,
        session_id: str,
        asset_id: str,
        *,
        start_date: str | None = None,
    ) -> dict:
        session = self.repository.get_session(session_id)
        scenario = self.repository.get_scenario(
            session["scenario_id"], session["scenario_version"]
        )
        if asset_id not in scenario["asset_ids"]:
            raise PlayError("ASSET_NOT_ALLOWED", "이 시나리오에서 매매할 수 없는 종목입니다.")
        turn_no = min(int(session["current_turn"]), int(scenario["total_turns"]))
        if session["status"] == "COMPLETED":
            end_date = scenario["final_valuation"]["market_date"]
        else:
            end_date = scenario["turn_schedule"][turn_no - 1]["market_date"]
        prices = self.repository.list_prices(
            asset_id,
            start_date=start_date,
            end_date=end_date,
        )
        return {
            "asset": self.repository.get_asset(asset_id),
            "end_date": end_date,
            "candles": [
                {
                    "date": item["trade_date"],
                    "open": item["open"],
                    "high": item["high"],
                    "low": item["low"],
                    "close": item["close"],
                    "volume": item["volume"],
                }
                for item in prices
            ],
            "data_available": bool(prices),
        }

    def place_order(
        self,
        session_id: str,
        *,
        asset_id: str,
        side: str,
        quantity: int,
    ) -> dict:
        session = self.repository.get_session(session_id)
        scenario = self.repository.get_scenario(
            session["scenario_id"], session["scenario_version"]
        )
        if asset_id not in scenario["asset_ids"]:
            raise PlayError("ASSET_NOT_ALLOWED", "이 시나리오에서 매매할 수 없는 종목입니다.")
        turn_no = int(session["current_turn"])
        turn = self.repository.get_turn(
            session["scenario_id"], session["scenario_version"], turn_no
        )
        now = utc_now()
        updated, order = execute_order(
            self.repository,
            session,
            asset_id=asset_id,
            side=side,
            quantity=quantity,
            market_date=turn["market_date"],
            turn_no=turn_no,
            created_at=now,
        )
        self.repository.save_session(updated)
        self.repository.insert_order(order)
        portfolio = build_portfolio_state(
            self.repository, updated, turn["market_date"]
        )
        return {"order": order, "portfolio": portfolio}

    def submit_turn(self, session_id: str, answers: list[dict]) -> dict:
        session = self.repository.get_session(session_id)
        if session.get("status") != "ACTIVE":
            raise PlayError("SESSION_NOT_ACTIVE", "이미 종료된 세션입니다.", 409)
        turn_no = int(session["current_turn"])
        if self.repository.get_turn_record(session_id, turn_no):
            raise PlayError("TURN_ALREADY_SUBMITTED", "이미 제출한 턴입니다.", 409)
        scenario = self.repository.get_scenario(
            session["scenario_id"], session["scenario_version"]
        )
        turn = self.repository.get_turn(
            session["scenario_id"], session["scenario_version"], turn_no
        )
        questions = self.repository.get_turn_questions(
            session["scenario_id"], session["scenario_version"], turn_no
        )
        self._validate_answers(answers, questions)
        snapshots = self.repository.list_snapshots(session_id)
        before = next(
            (
                item
                for item in snapshots
                if item.get("turn_no") == turn_no and item.get("kind") == "TURN_START"
            ),
            None,
        )
        if before is None:
            before_portfolio = build_portfolio_state(
                self.repository, session, turn["market_date"]
            )
            before = make_snapshot(
                session,
                before_portfolio,
                turn_no=turn_no,
                kind="TURN_START",
                sequence=turn_no * 10,
                created_at=utc_now(),
            )
            self.repository.save_snapshot(before)
        after_portfolio = build_portfolio_state(
            self.repository, session, turn["market_date"]
        )
        orders = self.repository.list_orders(session_id, turn_no)
        holdings = self._derive_scoring_holdings(before, after_portfolio, orders)
        cash_pct = max(0, min(100, round(after_portfolio["cash_weight_pct"])))
        rubric = self.repository.get_rubric(
            session["scenario_id"], session["scenario_version"], turn_no
        )
        decision = UserDecision(
            scenario_id=session["scenario_id"],
            turn_no=turn_no,
            holdings=holdings,
            cash_pct=cash_pct,
            answers=[
                QuestionAnswer(
                    question_id=item["question_id"],
                    selected=list(item.get("selected", [])),
                    text=str(item.get("text", "")),
                )
                for item in answers
            ],
        )
        previous_guidance = coaching_tracker.latest_guidance(
            self.repository.list_turn_evaluations(session_id),
            turn_no,
        )
        scorecard = to_primitive(engine.score_turn(decision, rubric))
        if isinstance(scorecard.get("feedback"), str):
            try:
                scorecard["feedback"] = json.loads(scorecard["feedback"])
            except json.JSONDecodeError:
                scorecard["feedback"] = {"explanation": scorecard["feedback"]}
        coaching_tracker.enrich_scorecard(
            scorecard,
            previous_guidance,
            turn_no,
            is_final_turn=turn_no == int(scenario["total_turns"]),
        )

        now = utc_now()
        after_snapshot = make_snapshot(
            session,
            after_portfolio,
            turn_no=turn_no,
            kind="TURN_END",
            sequence=turn_no * 10 + 1,
            created_at=now,
        )
        evaluation_id = str(uuid4())
        record = {
            "schema_version": SCHEMA_VERSION,
            "session_id": session_id,
            "user_id": session["user_id"],
            "scenario_id": session["scenario_id"],
            "scenario_version": session["scenario_version"],
            "turn_no": turn_no,
            "market_date": turn["market_date"],
            "content_refs": {
                "market_snapshot_id": turn.get("market_snapshot_id"),
                "news_ids": turn.get("news_ids", []),
            },
            "portfolio_before": self._strip_snapshot_meta(before),
            "portfolio_after": after_portfolio,
            "order_ids": [item["order_id"] for item in orders],
            "decision": {
                "holdings": to_primitive(holdings),
                "cash_pct": cash_pct,
                "answers": answers,
            },
            "turn_evaluation_id": evaluation_id,
            "submitted_at": now,
        }
        evaluation = {
            "schema_version": SCHEMA_VERSION,
            "evaluation_id": evaluation_id,
            "session_id": session_id,
            "user_id": session["user_id"],
            "scenario_id": session["scenario_id"],
            "scenario_version": session["scenario_version"],
            "turn_no": turn_no,
            "evaluator_version": EVALUATOR_VERSION,
            "scorecard": scorecard,
            "created_at": now,
        }

        final_evaluation = None
        next_turn = None
        if turn_no == int(scenario["total_turns"]):
            final_date = scenario["final_valuation"]["market_date"]
            final_portfolio = build_portfolio_state(
                self.repository, session, final_date
            )
            final_snapshot = make_snapshot(
                session,
                final_portfolio,
                turn_no=None,
                kind="FINAL",
                sequence=999,
                created_at=now,
            )
            self.repository.save_snapshot(after_snapshot)
            self.repository.save_snapshot(final_snapshot)
            self.repository.save_turn_record(record)
            self.repository.save_turn_evaluation(evaluation)
            session["status"] = "FINALIZING"
            session["updated_at"] = now
            self.repository.save_session(session)
            final_evaluation = self.finalize_session(session_id)
            session = self.repository.get_session(session_id)
        else:
            self.repository.save_snapshot(after_snapshot)
            self.repository.save_turn_record(record)
            self.repository.save_turn_evaluation(evaluation)
            session["current_turn"] = turn_no + 1
            session["updated_at"] = now
            self.repository.save_session(session)
            next_turn_doc = self.repository.get_turn(
                session["scenario_id"], session["scenario_version"], turn_no + 1
            )
            next_portfolio = build_portfolio_state(
                self.repository, session, next_turn_doc["market_date"]
            )
            self.repository.save_snapshot(
                make_snapshot(
                    session,
                    next_portfolio,
                    turn_no=turn_no + 1,
                    kind="TURN_START",
                    sequence=(turn_no + 1) * 10,
                    created_at=now,
                )
            )
            next_turn = turn_no + 1

        return {
            "session": self._session_public(session),
            "turn_evaluation": evaluation,
            "next_turn": next_turn,
            "final_evaluation": final_evaluation,
        }

    @staticmethod
    def _strip_snapshot_meta(snapshot: dict) -> dict:
        return {
            key: value
            for key, value in snapshot.items()
            if key
            not in {
                "_id",
                "schema_version",
                "snapshot_id",
                "session_id",
                "user_id",
                "scenario_id",
                "turn_no",
                "kind",
                "sequence",
                "created_at",
            }
        }

    @staticmethod
    def _validate_answers(answers: list[dict], questions: list[dict]) -> None:
        answer_map = {item.get("question_id"): item for item in answers}
        expected_ids = [item["question_id"] for item in questions]
        missing = [question_id for question_id in expected_ids if question_id not in answer_map]
        if missing:
            raise PlayError(
                "MISSING_ANSWERS",
                f"답하지 않은 문항이 있습니다: {', '.join(missing)}",
            )
        for question in questions:
            answer = answer_map[question["question_id"]]
            selected = list(answer.get("selected", []))
            text = str(answer.get("text", "")).strip()
            if question.get("type") == "free":
                if not text:
                    raise PlayError("EMPTY_REASONING", "자유서술 근거를 입력하세요.")
                continue
            if not selected:
                raise PlayError(
                    "EMPTY_ANSWER",
                    f"{question['question_id']}의 답을 선택하세요.",
                )
            if question.get("type") == "single" and len(selected) != 1:
                raise PlayError(
                    "INVALID_SELECTION_COUNT",
                    f"{question['question_id']}는 하나만 선택할 수 있습니다.",
                )
            max_select = question.get("max_select")
            if max_select and len(selected) > int(max_select):
                raise PlayError(
                    "INVALID_SELECTION_COUNT",
                    f"{question['question_id']}는 최대 {max_select}개까지 선택할 수 있습니다.",
                )
            invalid = [value for value in selected if value not in question.get("options", [])]
            if invalid:
                raise PlayError(
                    "INVALID_OPTION",
                    f"{question['question_id']}에 존재하지 않는 선택지가 포함됐습니다.",
                )

    @staticmethod
    def _derive_scoring_holdings(
        before: dict,
        after: dict,
        orders: list[dict],
    ) -> list[Holding]:
        before_total = max(1, int(before.get("total_value", after.get("total_value", 1))))
        grouped: dict[str, dict[str, int]] = {}
        for order in orders:
            item = grouped.setdefault(order["asset_id"], {"buy": 0, "sell": 0})
            key = "buy" if order["side"] == "BUY" else "sell"
            item[key] += int(order["amount"])
        final_quantities = {
            item["asset_id"]: int(item["quantity"])
            for item in after.get("positions", [])
        }
        holdings = []
        for asset_id, amounts in grouped.items():
            net = amounts["buy"] - amounts["sell"]
            weight = max(1, min(100, round(abs(net) / before_total * 100)))
            if net > 0:
                action = Action.BUY
            elif net < 0 and final_quantities.get(asset_id, 0) == 0:
                action = Action.SELL
            elif net < 0:
                action = Action.PARTIAL_SELL
            else:
                action = Action.HOLD
            holdings.append(Holding(asset_id=asset_id, action=action, weight_pct=weight))
        if not holdings:
            holdings = [
                Holding(
                    asset_id=item["asset_id"],
                    action=Action.HOLD,
                    weight_pct=max(0, min(100, round(float(item.get("weight_pct", 0))))),
                )
                for item in after.get("positions", [])
            ]
        return holdings

    def get_evaluation(self, session_id: str) -> dict:
        session = self.repository.get_session(session_id)
        if session.get("status") != "COMPLETED":
            raise PlayError("SESSION_NOT_COMPLETED", "시나리오가 아직 종료되지 않았습니다.", 409)
        value = self.repository.get_evaluation_by_session(session_id)
        if not value:
            raise PlayError("EVALUATION_NOT_READY", "종합평가가 아직 생성되지 않았습니다.", 503)
        return value

    def finalize_session(self, session_id: str) -> dict:
        """턴 6 저장 이후 종합평가 생성을 재시도할 수 있게 분리한다."""
        session = self.repository.get_session(session_id)
        if session.get("status") == "COMPLETED":
            existing = self.repository.get_evaluation_by_session(session_id)
            if not existing:
                raise PlayError("EVALUATION_NOT_READY", "종합평가가 없습니다.", 503)
            rebuild_user_profile(self.repository, session["user_id"], utc_now())
            return existing
        if session.get("status") != "FINALIZING":
            raise PlayError(
                "SESSION_NOT_READY_TO_FINALIZE",
                "모든 턴을 제출한 뒤 종합평가를 생성할 수 있습니다.",
                409,
            )
        now = utc_now()
        evaluation = self.repository.get_evaluation_by_session(session_id)
        if evaluation is None:
            evaluation = build_scenario_evaluation(self.repository, session, now)
            self.repository.save_scenario_evaluation(evaluation)
        session["status"] = "COMPLETED"
        session["completed_at"] = now
        session["updated_at"] = now
        session["final_evaluation_id"] = evaluation["evaluation_id"]
        self.repository.save_session(session)
        rebuild_user_profile(self.repository, session["user_id"], now)
        return evaluation
