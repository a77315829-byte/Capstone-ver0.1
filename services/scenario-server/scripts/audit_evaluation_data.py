"""MongoDB 평가 데이터 현황을 변경 없이 집계한다.

답변 원문, 사용자 식별자, 접속 URI는 출력하지 않는다. MongoDB의 find/count/
aggregate 명령만 사용하며 insert/update/delete는 수행하지 않는다.
"""
from __future__ import annotations

import json
import sys
from typing import Any

from config import MONGODB_CONNECT_TIMEOUT_MS, MONGODB_DATABASE, MONGODB_URI


def _distribution(collection, field: str) -> list[dict[str, Any]]:
    rows = collection.aggregate(
        [
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1, "_id": 1}},
        ]
    )
    return [
        {"value": row.get("_id"), "count": int(row.get("count", 0))}
        for row in rows
    ]


def _link_counts(source, target_name: str, local_field: str, foreign_field: str) -> dict:
    rows = list(source.aggregate(
        [
            {
                "$lookup": {
                    "from": target_name,
                    "let": {"audit_local_value": f"${local_field}"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$eq": [
                                        f"${foreign_field}",
                                        "$$audit_local_value",
                                    ]
                                }
                            }
                        },
                        {"$project": {"_id": 1}},
                    ],
                    "as": "_audit_matches",
                }
            },
            {
                "$project": {
                    "_audit_local_value": f"${local_field}",
                    "_audit_linked": {
                        "$gt": [{"$size": "$_audit_matches"}, 0]
                    },
                }
            },
            {
                "$facet": {
                    "record_counts": [
                        {
                            "$group": {
                                "_id": "$_audit_linked",
                                "count": {"$sum": 1},
                            }
                        }
                    ],
                    "unique_linked_targets": [
                        {"$match": {"_audit_linked": True}},
                        {"$group": {"_id": "$_audit_local_value"}},
                        {"$count": "count"},
                    ],
                }
            },
        ]
    ))
    counts = {"linked": 0, "unlinked": 0, "unique_linked_targets": 0}
    if not rows:
        return counts
    for row in rows[0].get("record_counts", []):
        key = "linked" if row.get("_id") else "unlinked"
        counts[key] = int(row.get("count", 0))
    unique_rows = rows[0].get("unique_linked_targets", [])
    if unique_rows:
        counts["unique_linked_targets"] = int(unique_rows[0].get("count", 0))
    return counts


def build_report(database) -> dict[str, Any]:
    collection_names = set(database.list_collection_names())
    required = {"turn_records", "turn_evaluations"}
    missing = sorted(required - collection_names)
    if missing:
        return {
            "database": database.name,
            "missing_collections": missing,
            "available_collection_count": len(collection_names),
        }

    records = database["turn_records"]
    evaluations = database["turn_evaluations"]
    text_count_rows = list(
        records.aggregate(
            [
                {
                    "$match": {
                        "decision.answers.text": {
                            "$type": "string",
                            "$regex": r"\S",
                        }
                    }
                },
                {"$count": "count"},
            ]
        )
    )
    records_with_text = (
        int(text_count_rows[0].get("count", 0)) if text_count_rows else 0
    )
    record_count = int(records.count_documents({}))
    evaluation_count = int(evaluations.count_documents({}))
    record_links = _link_counts(
        records,
        "turn_evaluations",
        "turn_evaluation_id",
        "evaluation_id",
    )

    return {
        "database": database.name,
        "turn_records": record_count,
        "turn_evaluations": evaluation_count,
        "turn_records_with_free_text": records_with_text,
        "record_to_evaluation": record_links,
        "turn_evaluations_without_record": max(
            0,
            evaluation_count - record_links["unique_linked_targets"],
        ),
        "evaluator_versions": _distribution(evaluations, "evaluator_version"),
        "scenarios": _distribution(records, "scenario_id"),
        "scorecard_statuses": _distribution(evaluations, "scorecard.status"),
    }


def main() -> int:
    try:
        from pymongo import MongoClient
    except ImportError:
        print("pymongo가 없습니다. setup.bat을 먼저 실행하세요.", file=sys.stderr)
        return 2

    client = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=MONGODB_CONNECT_TIMEOUT_MS,
    )
    try:
        client.admin.command("ping")
        report = build_report(client[MONGODB_DATABASE])
        print(json.dumps(report, ensure_ascii=False, indent=2, default=str))
        return 0
    except Exception as exc:
        print(
            f"MongoDB 읽기 전용 점검 실패: {type(exc).__name__}",
            file=sys.stderr,
        )
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
