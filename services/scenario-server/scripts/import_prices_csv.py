"""asset_id,trade_date,open,high,low,close,volume CSV를 MongoDB에 적재한다."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from config import SCHEMA_VERSION
from data.store import get_store


REQUIRED_COLUMNS = {"asset_id", "trade_date", "open", "high", "low", "close", "volume"}


def main() -> None:
    parser = argparse.ArgumentParser(description="OHLCV CSV를 daily_prices에 적재합니다.")
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--source", default="CSV")
    args = parser.parse_args()
    store = get_store()
    store.ping()
    store.ensure_indexes()
    imported = 0
    with args.csv_path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV 필수 열이 없습니다: {', '.join(sorted(missing))}")
        for row in reader:
            document = {
                "schema_version": SCHEMA_VERSION,
                "asset_id": str(row["asset_id"]).zfill(6),
                "trade_date": str(row["trade_date"]).replace("-", ""),
                "open": int(float(row["open"])),
                "high": int(float(row["high"])),
                "low": int(float(row["low"])),
                "close": int(float(row["close"])),
                "volume": int(float(row["volume"])),
                "source": args.source,
            }
            date = document["trade_date"]
            document["trade_date"] = f"{date[:4]}-{date[4:6]}-{date[6:8]}"
            store.replace_one(
                "daily_prices",
                {"asset_id": document["asset_id"], "trade_date": document["trade_date"]},
                document,
                upsert=True,
            )
            imported += 1
    print(json.dumps({"status": "ok", "imported": imported}, ensure_ascii=False))


if __name__ == "__main__":
    main()
