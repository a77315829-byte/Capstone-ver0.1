"""주문 체결과 포트폴리오 평가의 결정론적 계산."""
from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import uuid4

from data.app_repository import AppRepository, NotFoundError
from play.errors import DataUnavailableError, PlayError
from play.orderbook_service import match_order, validate_limit_price


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
    order_type: str,
    limit_price: int | None,
    orderbook: dict,
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
    order_type = order_type.upper()
    if order_type not in {"MARKET", "LIMIT"}:
        raise PlayError("INVALID_ORDER_TYPE", "주문 유형은 MARKET 또는 LIMIT이어야 합니다.")
    asset = repository.get_asset(asset_id)
    if order_type == "LIMIT":
        if limit_price is None:
            raise PlayError("LIMIT_PRICE_REQUIRED", "지정가 주문에는 가격이 필요합니다.")
        validate_limit_price(int(limit_price), asset)
        limit_price = int(limit_price)
    else:
        limit_price = None

    if orderbook.get("asset_id") != asset_id:
        raise PlayError("INVALID_ORDERBOOK", "주문 종목과 호가 종목이 일치하지 않습니다.")
    book_levels = orderbook.get("asks" if side == "BUY" else "bids", [])
    best_level = next(
        (level for level in book_levels if int(level.get("quantity") or 0) > 0),
        None,
    )
    if best_level is None:
        raise PlayError("ORDERBOOK_EMPTY", "현재 체결 가능한 호가 잔량이 없습니다.", 409)

    updated = deepcopy(session)
    positions = _position_map(updated)
    current = positions.get(
        asset_id,
        {"asset_id": asset_id, "quantity": 0, "avg_price": 0.0},
    )

    if side == "BUY":
        estimated_price = (
            int(limit_price)
            if order_type == "LIMIT"
            else int(best_level["price"])
        )
        estimated_amount = estimated_price * quantity
        if estimated_amount > int(updated.get("cash", 0)):
            raise PlayError(
                "INSUFFICIENT_CASH",
                f"예상 주문금액 {estimated_amount:,}원이 보유현금보다 큽니다.",
            )
    else:
        held_quantity = int(current.get("quantity", 0))
        if quantity > held_quantity:
            raise PlayError(
                "INSUFFICIENT_POSITION",
                f"매도수량 {quantity}주가 보유수량 {held_quantity}주보다 큽니다.",
            )

    matched = match_order(
        orderbook,
        side=side,
        order_type=order_type,
        quantity=quantity,
        limit_price=limit_price,
    )
    filled_quantity = int(matched["filled_quantity"])
    amount = int(matched["amount"])
    average_execution_price = matched["average_execution_price"]
    realized = 0

    if side == "BUY" and amount > int(updated.get("cash", 0)):
        raise PlayError(
            "INSUFFICIENT_CASH",
            f"체결금액 {amount:,}원이 보유현금보다 큽니다.",
        )

    if filled_quantity > 0 and side == "BUY":
        old_quantity = int(current.get("quantity", 0))
        new_quantity = old_quantity + filled_quantity
        old_cost = float(current.get("avg_price", 0)) * old_quantity
        current["quantity"] = new_quantity
        current["avg_price"] = round((old_cost + amount) / new_quantity, 4)
        updated["cash"] = int(updated.get("cash", 0)) - amount
    elif filled_quantity > 0:
        held_quantity = int(current.get("quantity", 0))
        realized = round(amount - float(current.get("avg_price", 0)) * filled_quantity)
        current["quantity"] = held_quantity - filled_quantity
        realized_by_asset = dict(updated.get("realized_pnl_by_asset", {}))
        realized_by_asset[asset_id] = int(realized_by_asset.get(asset_id, 0)) + realized
        updated["realized_pnl_by_asset"] = realized_by_asset
        updated["cash"] = int(updated.get("cash", 0)) + amount

    if filled_quantity > 0:
        if int(current["quantity"]) == 0:
            positions.pop(asset_id, None)
        else:
            positions[asset_id] = current
        updated["positions"] = sorted(
            positions.values(),
            key=lambda item: item["asset_id"],
        )
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
        "order_type": order_type,
        "limit_price": limit_price,
        "requested_quantity": int(matched["requested_quantity"]),
        "filled_quantity": filled_quantity,
        "cancelled_quantity": int(matched["cancelled_quantity"]),
        # 기존 프론트 계약에서 quantity는 실제 체결 수량을 의미하도록 유지한다.
        "quantity": filled_quantity,
        "execution_price": average_execution_price,
        "average_execution_price": average_execution_price,
        "amount": amount,
        "realized_pnl": realized,
        "status": matched["status"],
        "time_in_force": matched["time_in_force"],
        "fills": matched["fills"],
        "price_basis": "synthetic_orderbook_v1",
        "orderbook_snapshot_id": orderbook["snapshot_id"],
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
