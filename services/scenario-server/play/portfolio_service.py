"""주문 체결과 포트폴리오 평가의 결정론적 계산."""
from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import uuid4

from data.app_repository import AppRepository, NotFoundError
from play.errors import DataUnavailableError, PlayError


def _position_map(session: dict) -> dict[str, dict]:
    return {item["asset_id"]: deepcopy(item) for item in session.get("positions", [])}


def get_execution_price(repository: AppRepository, asset_id: str, market_date: str) -> int:
    price = repository.get_latest_price(asset_id, market_date)
    if not price or price.get("close") is None:
        raise DataUnavailableError(
            f"{asset_id}의 {market_date} 체결 가격이 없습니다. 가격 데이터를 먼저 적재하세요."
        )
    return int(price["close"])


def build_portfolio_state(
    repository: AppRepository,
    session: dict,
    market_date: str,
    *,
    allow_missing_prices: bool = False,
) -> dict:
    cash = int(session.get("cash", 0))
    realized_by_asset = {
        key: int(value)
        for key, value in session.get("realized_pnl_by_asset", {}).items()
    }
    positions = []
    total_position_value = 0
    missing_assets = []
    for position in session.get("positions", []):
        asset_id = position["asset_id"]
        price_doc = repository.get_latest_price(asset_id, market_date)
        if not price_doc or price_doc.get("close") is None:
            if not allow_missing_prices:
                raise DataUnavailableError(
                    f"{asset_id}의 {market_date} 평가 가격이 없습니다."
                )
            current_price = int(round(float(position.get("avg_price", 0))))
            missing_assets.append(asset_id)
        else:
            current_price = int(price_doc["close"])
        quantity = int(position["quantity"])
        market_value = current_price * quantity
        avg_price = float(position.get("avg_price", 0))
        unrealized_pnl = round((current_price - avg_price) * quantity)
        total_position_value += market_value
        asset = repository.get_asset(asset_id)
        positions.append(
            {
                "asset_id": asset_id,
                "name": asset.get("name", asset_id),
                "industry_label": asset.get("industry_label", ""),
                "quantity": quantity,
                "avg_price": round(avg_price, 2),
                "current_price": current_price,
                "market_value": market_value,
                "unrealized_pnl": unrealized_pnl,
                "realized_pnl": realized_by_asset.get(asset_id, 0),
            }
        )
    total_value = cash + total_position_value
    initial_value = int(session.get("initial_cash", 0))
    for position in positions:
        position["weight_pct"] = (
            round(position["market_value"] / total_value * 100, 2)
            if total_value > 0
            else 0.0
        )
    cash_weight = round(cash / total_value * 100, 2) if total_value > 0 else 0.0
    return {
        "market_date": market_date,
        "cash": cash,
        "cash_weight_pct": cash_weight,
        "position_value": total_position_value,
        "total_value": total_value,
        "profit_loss": total_value - initial_value,
        "cumulative_return_pct": (
            round((total_value / initial_value - 1) * 100, 4)
            if initial_value > 0
            else 0.0
        ),
        "positions": positions,
        "realized_pnl_total": sum(realized_by_asset.values()),
        "missing_price_assets": missing_assets,
        "data_complete": not missing_assets,
    }


def execute_order(
    repository: AppRepository,
    session: dict,
    *,
    asset_id: str,
    side: str,
    quantity: int,
    market_date: str,
    turn_no: int,
    created_at: str,
) -> tuple[dict, dict]:
    if session.get("status") != "ACTIVE":
        raise PlayError("SESSION_NOT_ACTIVE", "진행 중인 세션에서만 주문할 수 있습니다.", 409)
    if quantity <= 0:
        raise PlayError("INVALID_QUANTITY", "주문 수량은 1주 이상이어야 합니다.")
    side = side.upper()
    if side not in {"BUY", "SELL"}:
        raise PlayError("INVALID_SIDE", "주문 방향은 BUY 또는 SELL이어야 합니다.")
    repository.get_asset(asset_id)
    execution_price = get_execution_price(repository, asset_id, market_date)
    amount = execution_price * quantity
    updated = deepcopy(session)
    positions = _position_map(updated)
    current = positions.get(
        asset_id,
        {"asset_id": asset_id, "quantity": 0, "avg_price": 0.0},
    )

    if side == "BUY":
        if amount > int(updated.get("cash", 0)):
            raise PlayError(
                "INSUFFICIENT_CASH",
                f"주문금액 {amount:,}원이 보유현금보다 큽니다.",
            )
        old_quantity = int(current.get("quantity", 0))
        new_quantity = old_quantity + quantity
        old_cost = float(current.get("avg_price", 0)) * old_quantity
        current["quantity"] = new_quantity
        current["avg_price"] = round((old_cost + amount) / new_quantity, 4)
        updated["cash"] = int(updated.get("cash", 0)) - amount
    else:
        held_quantity = int(current.get("quantity", 0))
        if quantity > held_quantity:
            raise PlayError(
                "INSUFFICIENT_POSITION",
                f"매도수량 {quantity}주가 보유수량 {held_quantity}주보다 큽니다.",
            )
        realized = round((execution_price - float(current.get("avg_price", 0))) * quantity)
        current["quantity"] = held_quantity - quantity
        realized_by_asset = dict(updated.get("realized_pnl_by_asset", {}))
        realized_by_asset[asset_id] = int(realized_by_asset.get(asset_id, 0)) + realized
        updated["realized_pnl_by_asset"] = realized_by_asset
        updated["cash"] = int(updated.get("cash", 0)) + amount

    if int(current["quantity"]) == 0:
        positions.pop(asset_id, None)
    else:
        positions[asset_id] = current
    updated["positions"] = sorted(positions.values(), key=lambda item: item["asset_id"])
    updated["revision"] = int(updated.get("revision", 0)) + 1
    updated["updated_at"] = created_at

    order = {
        "schema_version": 1,
        "order_id": str(uuid4()),
        "session_id": session["session_id"],
        "user_id": session["user_id"],
        "scenario_id": session["scenario_id"],
        "turn_no": turn_no,
        "market_date": market_date,
        "asset_id": asset_id,
        "side": side,
        "quantity": quantity,
        "execution_price": execution_price,
        "amount": amount,
        "realized_pnl": realized if side == "SELL" else 0,
        "status": "FILLED",
        "price_basis": "close",
        "created_at": created_at,
    }
    return updated, order


def make_snapshot(
    session: dict,
    portfolio: dict,
    *,
    turn_no: int | None,
    kind: str,
    sequence: int,
    created_at: str,
) -> dict:
    suffix = f"turn-{turn_no}" if turn_no is not None else "final"
    return {
        "schema_version": 1,
        "snapshot_id": f"{session['session_id']}-{suffix}-{kind}",
        "session_id": session["session_id"],
        "user_id": session["user_id"],
        "scenario_id": session["scenario_id"],
        "turn_no": turn_no,
        "kind": kind,
        "sequence": sequence,
        "created_at": created_at,
        **portfolio,
    }
