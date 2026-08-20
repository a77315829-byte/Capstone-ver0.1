"""버전 관리되는 JSON 콘텐츠를 MongoDB에 반복 안전하게 적재한다."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from config import SCHEMA_VERSION
from data.repository import normalize_rubric_asset_ids
from data.store import DocumentStore, get_store


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
SCENARIOS_DIR = DATA_DIR / "scenarios"


def load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"시드 파일이 없습니다: {path}")
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def upsert(
    store: DocumentStore,
    collection: str,
    query: dict[str, Any],
    document: dict[str, Any],
) -> None:
    value = dict(document)
    value.setdefault("schema_version", SCHEMA_VERSION)
    store.replace_one(collection, query, value, upsert=True)


def validate_content(scenario: dict, displays: dict, rubric_docs: list[dict]) -> None:
    total_turns = int(scenario["total_turns"])
    expected = list(range(1, total_turns + 1))
    schedule_turns = [item["turn_no"] for item in scenario.get("turn_schedule", [])]
    display_turns = [item["turn_no"] for item in displays.get("turns", [])]
    rubric_turns = [item["turn_no"] for item in rubric_docs]
    if schedule_turns != expected:
        raise ValueError(f"turn_schedule이 1~{total_turns} 순서가 아닙니다: {schedule_turns}")
    if display_turns != expected:
        raise ValueError(f"turn_displays가 1~{total_turns} 순서가 아닙니다: {display_turns}")
    if sorted(rubric_turns) != expected:
        raise ValueError(f"rubric 파일이 1~{total_turns}와 일치하지 않습니다: {rubric_turns}")
    schedule_dates = {item["turn_no"]: item["market_date"] for item in scenario["turn_schedule"]}
    for turn in displays["turns"]:
        if turn["market_date"] != schedule_dates[turn["turn_no"]]:
            raise ValueError(f"turn {turn['turn_no']}의 market_date가 서로 다릅니다.")
    asset_ids = set(scenario.get("asset_ids", []))
    seen_initial_assets: set[str] = set()
    for position in scenario.get("simulation", {}).get("initial_positions", []):
        asset_id = str(position.get("asset_id", ""))
        quantity = int(position.get("quantity", 0))
        if asset_id not in asset_ids:
            raise ValueError(f"초기 보유 종목이 asset_ids에 없습니다: {asset_id}")
        if asset_id in seen_initial_assets or quantity <= 0:
            raise ValueError(f"초기 보유 종목은 중복 없이 1주 이상이어야 합니다: {asset_id}")
        if "avg_price" in position and float(position["avg_price"]) <= 0:
            raise ValueError(f"초기 보유 종목의 avg_price는 0보다 커야 합니다: {asset_id}")
        seen_initial_assets.add(asset_id)


def seed_scenario(
    scenario_id: str,
    *,
    store: DocumentStore | None = None,
    base_dir: Path = SCENARIOS_DIR,
) -> dict[str, int]:
    target_store = store or get_store()
    scenario_dir = base_dir / scenario_id
    scenario = load_json(scenario_dir / "scenario.json")
    assets_file = load_json(scenario_dir / "assets.json")
    displays = load_json(scenario_dir / "turn_displays.json")
    questions = load_json(DATA_DIR / "questions.json")
    version = int(scenario.get("version", 1))
    rubric_docs = [
        normalize_rubric_asset_ids(load_json(scenario_dir / f"rubric_turn{turn_no}.json"))
        for turn_no in range(1, int(scenario["total_turns"]) + 1)
    ]
    validate_content(scenario, displays, rubric_docs)

    target_store.ensure_indexes()
    upsert(
        target_store,
        "scenarios",
        {"scenario_id": scenario_id, "version": version},
        scenario,
    )
    upsert(
        target_store,
        "question_banks",
        {"bank_id": "default"},
        {"bank_id": "default", **questions},
    )

    counts = {
        "scenarios": 1,
        "assets": 0,
        "turns": 0,
        "news": 0,
        "market_snapshots": 0,
        "rubrics": 0,
    }
    for asset in assets_file["assets"]:
        document = {
            "currency": assets_file.get("currency", "KRW"),
            "exchange": assets_file.get("exchange", "KRX"),
            "order_unit": 1,
            **asset,
        }
        upsert(target_store, "assets", {"asset_id": asset["asset_id"]}, document)
        counts["assets"] += 1

    for turn in displays["turns"]:
        turn_no = int(turn["turn_no"])
        snapshot_id = f"{scenario_id}-v{version}-turn-{turn_no}-market"
        news_ids = []
        for news in turn.get("news", []):
            news_document = {
                "scenario_id": scenario_id,
                "scenario_version": version,
                "visible_from_turn": turn_no,
                **news,
            }
            upsert(target_store, "news_items", {"news_id": news["news_id"]}, news_document)
            news_ids.append(news["news_id"])
            counts["news"] += 1

        market_document = {
            "snapshot_id": snapshot_id,
            "scenario_id": scenario_id,
            "scenario_version": version,
            "turn_no": turn_no,
            "as_of_date": turn["market_date"],
            **turn.get("market_state", {}),
        }
        upsert(
            target_store,
            "market_snapshots",
            {"snapshot_id": snapshot_id},
            market_document,
        )
        counts["market_snapshots"] += 1

        turn_document = {
            key: value
            for key, value in turn.items()
            if key not in {"news", "market_state"}
        }
        turn_document.update(
            {
                "scenario_id": scenario_id,
                "scenario_version": version,
                "market_snapshot_id": snapshot_id,
                "news_ids": news_ids,
            }
        )
        upsert(
            target_store,
            "scenario_turns",
            {
                "scenario_id": scenario_id,
                "scenario_version": version,
                "turn_no": turn_no,
            },
            turn_document,
        )
        counts["turns"] += 1

    for rubric in rubric_docs:
        rubric_document = {
            "schema_version": SCHEMA_VERSION,
            "scenario_version": version,
            **rubric,
        }
        upsert(
            target_store,
            "turn_rubrics",
            {
                "scenario_id": scenario_id,
                "scenario_version": version,
                "turn_no": rubric["turn_no"],
            },
            rubric_document,
        )
        counts["rubrics"] += 1
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="시나리오 콘텐츠를 MongoDB에 적재합니다.")
    parser.add_argument("--scenario", default="semiconductor")
    args = parser.parse_args()
    store = get_store()
    store.ping()
    counts = seed_scenario(args.scenario, store=store)
    print(json.dumps({"status": "ok", "imported": counts}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
