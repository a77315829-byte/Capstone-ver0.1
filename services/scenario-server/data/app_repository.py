"""시나리오 실행 서비스의 데이터 접근 계층."""
from __future__ import annotations

from typing import Any

from data.store import DocumentStore, get_store


class NotFoundError(LookupError):
    pass


class ConflictError(RuntimeError):
    pass


class AppRepository:
    def __init__(self, store: DocumentStore | None = None) -> None:
        self.store = store or get_store()

    # ── 콘텐츠 ──────────────────────────────────────────────
    def get_scenario(self, scenario_id: str, version: int | None = None) -> dict:
        if version is None:
            values = self.store.find_many(
                "scenarios",
                {"scenario_id": scenario_id, "is_published": True},
                sort=[("version", -1)],
                limit=1,
            )
            value = values[0] if values else None
        else:
            value = self.store.find_one(
                "scenarios",
                {"scenario_id": scenario_id, "version": version},
            )
        if not value:
            raise NotFoundError(f"시나리오를 찾을 수 없습니다: {scenario_id}")
        return value

    def list_scenarios(self) -> list[dict]:
        values = self.store.find_many(
            "scenarios",
            {"is_published": True},
            sort=[("display_order", 1), ("scenario_id", 1), ("version", -1)],
        )
        latest: dict[str, dict] = {}
        for value in values:
            latest.setdefault(value["scenario_id"], value)
        return list(latest.values())

    def get_turn(self, scenario_id: str, version: int, turn_no: int) -> dict:
        value = self.store.find_one(
            "scenario_turns",
            {
                "scenario_id": scenario_id,
                "scenario_version": version,
                "turn_no": turn_no,
            },
        )
        if not value:
            raise NotFoundError(f"턴을 찾을 수 없습니다: {scenario_id} turn {turn_no}")
        return value

    def get_market_snapshot(self, snapshot_id: str) -> dict | None:
        if not snapshot_id:
            return None
        return self.store.find_one("market_snapshots", {"snapshot_id": snapshot_id})

    def list_news(self, news_ids: list[str]) -> list[dict]:
        if not news_ids:
            return []
        values = self.store.find_many(
            "news_items",
            {"news_id": {"$in": news_ids}},
            sort=[("display_order", 1)],
        )
        order = {news_id: index for index, news_id in enumerate(news_ids)}
        return sorted(values, key=lambda item: order.get(item.get("news_id"), 10_000))

    def get_rubric(self, scenario_id: str, version: int, turn_no: int) -> dict:
        value = self.store.find_one(
            "turn_rubrics",
            {
                "scenario_id": scenario_id,
                "scenario_version": version,
                "turn_no": turn_no,
            },
        )
        if not value:
            raise NotFoundError(f"기준표를 찾을 수 없습니다: {scenario_id} turn {turn_no}")
        return value

    def get_question_bank(self) -> dict:
        value = self.store.find_one("question_banks", {"bank_id": "default"})
        if not value:
            raise NotFoundError("질문 은행을 찾을 수 없습니다.")
        return value

    def get_turn_questions(self, scenario_id: str, version: int, turn_no: int) -> list[dict]:
        rubric = self.get_rubric(scenario_id, version, turn_no)
        bank = self.get_question_bank().get("questions", {})
        result = []
        for question_id in rubric.get("questions_used", []):
            if question_id in bank:
                question = dict(bank[question_id])
                question["question_id"] = question_id
                result.append(question)
        return result

    def list_assets(self, asset_ids: list[str] | None = None) -> list[dict]:
        query: dict[str, Any] = {"is_active": True}
        if asset_ids is not None:
            query["asset_id"] = {"$in": asset_ids}
        values = self.store.find_many("assets", query, sort=[("display_order", 1)])
        if asset_ids is None:
            return values
        order = {asset_id: index for index, asset_id in enumerate(asset_ids)}
        return sorted(values, key=lambda item: order.get(item.get("asset_id"), 10_000))

    def get_asset(self, asset_id: str) -> dict:
        value = self.store.find_one("assets", {"asset_id": asset_id, "is_active": True})
        if not value:
            raise NotFoundError(f"종목을 찾을 수 없습니다: {asset_id}")
        return value

    def get_price(self, asset_id: str, trade_date: str) -> dict | None:
        return self.store.find_one(
            "daily_prices",
            {"asset_id": asset_id, "trade_date": trade_date},
        )

    def get_latest_price(self, asset_id: str, on_or_before: str) -> dict | None:
        values = self.store.find_many(
            "daily_prices",
            {"asset_id": asset_id, "trade_date": {"$lte": on_or_before}},
            sort=[("trade_date", -1)],
            limit=1,
        )
        return values[0] if values else None

    def get_previous_price(self, asset_id: str, before: str) -> dict | None:
        values = self.store.find_many(
            "daily_prices",
            {"asset_id": asset_id, "trade_date": {"$lt": before}},
            sort=[("trade_date", -1)],
            limit=1,
        )
        return values[0] if values else None

    def list_prices(
        self,
        asset_id: str,
        *,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict]:
        date_query: dict[str, str] = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query: dict[str, Any] = {"asset_id": asset_id}
        if date_query:
            query["trade_date"] = date_query
        return self.store.find_many("daily_prices", query, sort=[("trade_date", 1)])

    # ── 실행 데이터 ──────────────────────────────────────────
    def create_session(self, session: dict) -> None:
        self.store.insert_one("scenario_sessions", session)

    def get_session(self, session_id: str) -> dict:
        value = self.store.find_one("scenario_sessions", {"session_id": session_id})
        if not value:
            raise NotFoundError(f"세션을 찾을 수 없습니다: {session_id}")
        return value

    def save_session(self, session: dict) -> None:
        self.store.replace_one(
            "scenario_sessions",
            {"session_id": session["session_id"]},
            session,
            upsert=False,
        )

    def insert_order(self, order: dict) -> None:
        self.store.insert_one("orders", order)

    def list_orders(self, session_id: str, turn_no: int | None = None) -> list[dict]:
        query: dict[str, Any] = {"session_id": session_id}
        if turn_no is not None:
            query["turn_no"] = turn_no
        return self.store.find_many("orders", query, sort=[("created_at", 1)])

    def save_snapshot(self, snapshot: dict) -> None:
        self.store.replace_one(
            "portfolio_snapshots",
            {"snapshot_id": snapshot["snapshot_id"]},
            snapshot,
            upsert=True,
        )

    def list_snapshots(self, session_id: str) -> list[dict]:
        return self.store.find_many(
            "portfolio_snapshots",
            {"session_id": session_id},
            sort=[("sequence", 1)],
        )

    def save_turn_record(self, record: dict) -> None:
        self.store.replace_one(
            "turn_records",
            {"session_id": record["session_id"], "turn_no": record["turn_no"]},
            record,
            upsert=True,
        )

    def get_turn_record(self, session_id: str, turn_no: int) -> dict | None:
        return self.store.find_one(
            "turn_records",
            {"session_id": session_id, "turn_no": turn_no},
        )

    def list_turn_records(self, session_id: str) -> list[dict]:
        return self.store.find_many(
            "turn_records",
            {"session_id": session_id},
            sort=[("turn_no", 1)],
        )

    def save_turn_evaluation(self, evaluation: dict) -> None:
        self.store.replace_one(
            "turn_evaluations",
            {"evaluation_id": evaluation["evaluation_id"]},
            evaluation,
            upsert=True,
        )

    def list_turn_evaluations(self, session_id: str) -> list[dict]:
        return self.store.find_many(
            "turn_evaluations",
            {"session_id": session_id},
            sort=[("turn_no", 1)],
        )

    def save_scenario_evaluation(self, evaluation: dict) -> None:
        self.store.replace_one(
            "scenario_evaluations",
            {"evaluation_id": evaluation["evaluation_id"]},
            evaluation,
            upsert=True,
        )

    def get_scenario_evaluation(self, evaluation_id: str) -> dict:
        value = self.store.find_one(
            "scenario_evaluations",
            {"evaluation_id": evaluation_id},
        )
        if not value:
            raise NotFoundError(f"종합평가를 찾을 수 없습니다: {evaluation_id}")
        return value

    def get_evaluation_by_session(self, session_id: str) -> dict | None:
        return self.store.find_one("scenario_evaluations", {"session_id": session_id})

    def list_user_evaluations(self, user_id: str) -> list[dict]:
        return self.store.find_many(
            "scenario_evaluations",
            {"user_id": user_id},
            sort=[("completed_at", -1)],
        )

    def save_user_profile(self, profile: dict) -> None:
        self.store.replace_one(
            "user_behavior_profiles",
            {"user_id": profile["user_id"]},
            profile,
            upsert=True,
        )

    def get_user_profile(self, user_id: str) -> dict | None:
        return self.store.find_one("user_behavior_profiles", {"user_id": user_id})
