"""턴별 지수·거시지표 CSV를 기존 market_snapshots에 병합한다.

열: scenario_id,scenario_version,turn_no,kind,code,name,value,change_pct,unit,as_of_date
kind는 index 또는 indicator이다. change_pct와 unit은 비워도 된다.
"""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from data.store import get_store


REQUIRED = {"scenario_id", "scenario_version", "turn_no", "kind", "code", "name", "value"}


def optional_float(value: str | None):
    text = str(value or "").strip()
    return float(text) if text else None


def main() -> None:
    parser = argparse.ArgumentParser(description="시장 지수·지표 CSV를 턴 스냅샷에 병합합니다.")
    parser.add_argument("csv_path", type=Path)
    args = parser.parse_args()
    store = get_store()
    store.ping()
    grouped: dict[tuple[str, int, int], dict[str, list[dict]]] = {}
    with args.csv_path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        missing = REQUIRED - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV 필수 열이 없습니다: {', '.join(sorted(missing))}")
        for row in reader:
            kind = row["kind"].strip().lower()
            if kind not in {"index", "indicator"}:
                raise ValueError("kind는 index 또는 indicator여야 합니다.")
            key = (row["scenario_id"], int(row["scenario_version"]), int(row["turn_no"]))
            bucket = grouped.setdefault(key, {"indices": [], "indicators": []})
            item = {
                "code": row["code"].strip(),
                "name": row["name"].strip(),
                "value": float(row["value"]),
                "change_pct": optional_float(row.get("change_pct")),
                "unit": str(row.get("unit") or "").strip(),
                "as_of_date": str(row.get("as_of_date") or "").strip(),
            }
            bucket["indices" if kind == "index" else "indicators"].append(item)

    updated = 0
    for (scenario_id, version, turn_no), values in grouped.items():
        query = {
            "scenario_id": scenario_id,
            "scenario_version": version,
            "turn_no": turn_no,
        }
        snapshot = store.find_one("market_snapshots", query)
        if not snapshot:
            raise ValueError(f"시장 스냅샷이 없습니다: {scenario_id} v{version} turn {turn_no}")
        snapshot.update(values)
        store.replace_one("market_snapshots", query, snapshot, upsert=False)
        updated += 1
    print(json.dumps({"status": "ok", "updated_snapshots": updated}, ensure_ascii=False))


if __name__ == "__main__":
    main()
