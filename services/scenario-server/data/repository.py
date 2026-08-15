"""
데이터 조회 창구.
- JSON 파일에서 질문 은행·시나리오·기준표를 읽어온다.
- 채점/진행 코드는 이 함수들로만 데이터에 접근한다.
- 나중에 파일 → DB로 바꿔도 이 파일 안만 고치면 된다(호출부 불변).
"""
import json
import logging
from pathlib import Path

from config import DATA_BACKEND
from data.store import get_store

# 이 파일(repository.py)이 있는 폴더 = data/
DATA_DIR = Path(__file__).parent
SCENARIOS_DIR = DATA_DIR / "scenarios"
logger = logging.getLogger(__name__)

ASSET_ALIAS_MAP = {
    "SK_HYNIX": "000660",
    "SAMSUNG": "005930",
    "SEMI_ETF": "091160",
    "TRAP_AI_SW": "080220",
    "GOLD_ETF": "132030",
    "HYUNDAI": "005380",
}


def _load_json(path: Path) -> dict:
    """JSON 파일 하나를 읽어 dict로. 없으면 에러."""
    if not path.exists():
        raise FileNotFoundError(f"파일 없음: {path}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def normalize_rubric_asset_ids(rubric: dict) -> dict:
    """초기 기준표 별칭을 KRX 종목코드로 변환한다."""
    value = json.loads(json.dumps(rubric, ensure_ascii=False))
    for asset in value.get("assets", []):
        asset["asset_id"] = ASSET_ALIAS_MAP.get(asset.get("asset_id"), asset.get("asset_id"))
    action_rule = value.get("action_rule", {})
    for field in ("trap_assets", "core_assets"):
        action_rule[field] = [
            ASSET_ALIAS_MAP.get(asset_id, asset_id)
            for asset_id in action_rule.get(field, [])
        ]
    for trap in value.get("traps", []):
        target = trap.get("target")
        if target in ASSET_ALIAS_MAP:
            trap["target"] = ASSET_ALIAS_MAP[target]
    return value


def _db_document(collection: str, query: dict) -> dict | None:
    """MongoDB 콘텐츠를 우선 사용하고, 미구성 상태에서는 JSON으로 폴백한다."""
    if DATA_BACKEND != "mongodb":
        return None
    try:
        return get_store().find_one(collection, query)
    except Exception as exc:
        logger.warning(
            "MongoDB 콘텐츠 조회 실패, JSON 폴백: collection=%s error=%s",
            collection,
            type(exc).__name__,
        )
        return None


def get_questions() -> dict:
    """질문 은행(공통) 전체를 반환."""
    stored = _db_document("question_banks", {"bank_id": "default"})
    if stored:
        stored.pop("_id", None)
        stored.pop("bank_id", None)
        stored.pop("schema_version", None)
        return stored
    return _load_json(DATA_DIR / "questions.json")


def get_scenario(scenario_id: str) -> dict:
    """시나리오 메타(제목·학습포인트·턴 골격) 반환."""
    stored = _db_document(
        "scenarios",
        {"scenario_id": scenario_id, "is_published": True},
    )
    if stored:
        stored.pop("_id", None)
        return stored
    return _load_json(SCENARIOS_DIR / scenario_id / "scenario.json")


def get_rubric(scenario_id: str, turn_no: int) -> dict:
    """특정 시나리오·턴의 채점 기준표(정답지) 반환."""
    stored = _db_document(
        "turn_rubrics",
        {"scenario_id": scenario_id, "turn_no": turn_no},
    )
    if stored:
        stored.pop("_id", None)
        return normalize_rubric_asset_ids(stored)
    return normalize_rubric_asset_ids(
        _load_json(SCENARIOS_DIR / scenario_id / f"rubric_turn{turn_no}.json")
    )


def get_turn_questions(scenario_id: str, turn_no: int) -> list[dict]:
    """
    이 턴에 실제로 쓸 질문들을 (은행에서 뽑아) 반환.
    rubric의 questions_used 목록 → 질문 은행에서 해당 질문 꺼내기.
    """
    rubric = get_rubric(scenario_id, turn_no)
    bank = get_questions()["questions"]
    used_ids = rubric.get("questions_used", [])
    result = []
    for qid in used_ids:
        if qid in bank:
            q = dict(bank[qid])   # 복사
            q["question_id"] = qid
            result.append(q)
    return result
