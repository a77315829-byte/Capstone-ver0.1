"""과거 일봉으로 고정된 시나리오용 10단계 모의 호가를 만든다.

실제 과거 호가를 복원하는 기능이 아니다. 동일한 시나리오·턴·종목에는 항상
같은 스냅샷을 사용하고, 각 세션에서 발생한 체결 수량만 잔량에서 차감한다.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any

from play.errors import DataUnavailableError, PlayError


GENERATOR_VERSION = "synthetic-ohlcv-v1"
ORDERBOOK_LEVELS = 10
LEVEL_WEIGHTS = (6, 7, 8, 9, 10, 10, 11, 12, 13, 14)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def tick_size(price: int, asset: dict) -> int:
    """프로젝트에서 사용하는 국내 주식·ETF 호가 단위."""
    if str(asset.get("asset_type", "")).lower() == "etf":
        return 5

    value = max(1, int(price))
    if value < 2_000:
        return 1
    if value < 5_000:
        return 5
    if value < 20_000:
        return 10
    if value < 50_000:
        return 50
    if str(asset.get("market", "")).upper() == "KOSDAQ":
        return 100
    if value < 200_000:
        return 100
    if value < 500_000:
        return 500
    return 1_000


def _normalize_reference_price(close: int, asset: dict) -> int:
    unit = tick_size(close, asset)
    return max(unit, int(round(close / unit) * unit))


def _next_price(price: int, direction: int, asset: dict) -> int:
    if direction > 0:
        return price + tick_size(price, asset)
    probe = max(1, price - 1)
    return max(1, price - tick_size(probe, asset))


def _allocate_quantities(total: int) -> list[int]:
    quantities = [max(1, round(total * weight / 100)) for weight in LEVEL_WEIGHTS]
    quantities[-1] += total - sum(quantities)
    return quantities


def generate_orderbook_snapshot(
    *,
    scenario_id: str,
    scenario_version: int,
    turn_no: int,
    market_date: str,
    asset: dict,
    price_bar: dict,
    generated_at: str,
) -> dict:
    """일봉 종가·거래량·당일 방향으로 재현 가능한 모의 호가를 생성한다."""
    close = int(price_bar.get("close") or 0)
    if close <= 0:
        raise DataUnavailableError(
            f"{asset.get('asset_id', '')}의 {market_date} 호가 기준가격이 없습니다."
        )

    market_open = int(price_bar.get("open") or close)
    volume = max(0, int(price_bar.get("volume") or 0))
    reference_price = _normalize_reference_price(close, asset)

    # 한쪽 10단계 총잔량은 일 거래량의 0.1%다. 데이터가 작거나 누락돼도
    # 화면과 소액 주문 검증에 필요한 최소 100주는 유지한다.
    base_depth = max(100, min(100_000, round(volume * 0.001)))
    daily_return = (close - market_open) / market_open if market_open > 0 else 0.0
    pressure = _clamp(daily_return * 4.0, -0.20, 0.20)
    bid_total = max(100, round(base_depth * (1.0 + pressure)))
    ask_total = max(100, round(base_depth * (1.0 - pressure)))
    bid_quantities = _allocate_quantities(bid_total)
    ask_quantities = _allocate_quantities(ask_total)

    bids: list[dict[str, int]] = []
    asks: list[dict[str, int]] = []
    bid_price = reference_price
    ask_price = reference_price
    for level in range(ORDERBOOK_LEVELS):
        bid_price = _next_price(bid_price, -1, asset)
        ask_price = _next_price(ask_price, 1, asset)
        bids.append(
            {
                "level": level + 1,
                "price": bid_price,
                "quantity": bid_quantities[level],
            }
        )
        asks.append(
            {
                "level": level + 1,
                "price": ask_price,
                "quantity": ask_quantities[level],
            }
        )

    asset_id = str(asset["asset_id"])
    snapshot_id = (
        f"{scenario_id}-v{scenario_version}-turn-{turn_no}-{asset_id}-"
        f"{GENERATOR_VERSION}"
    )
    return {
        "schema_version": 1,
        "snapshot_id": snapshot_id,
        "scenario_id": scenario_id,
        "scenario_version": int(scenario_version),
        "turn_no": int(turn_no),
        "market_date": market_date,
        "asset_id": asset_id,
        "asset_name": asset.get("name", asset_id),
        "market": asset.get("market", ""),
        "asset_type": asset.get("asset_type", "stock"),
        "generator_version": GENERATOR_VERSION,
        "source": "SIMULATED_FROM_DAILY_OHLCV",
        "is_simulated": True,
        "reference_price": reference_price,
        "source_close": close,
        "source_price_date": price_bar.get("trade_date"),
        "source_volume": volume,
        "spread": asks[0]["price"] - bids[0]["price"],
        "bids": bids,
        "asks": asks,
        "generated_at": generated_at,
    }


def available_orderbook(snapshot: dict, orders: list[dict]) -> dict:
    """세션의 기존 체결을 차감한 현재 잔량을 반환한다."""
    consumed: dict[str, dict[int, int]] = {"bids": {}, "asks": {}}
    for order in orders:
        if order.get("orderbook_snapshot_id") != snapshot.get("snapshot_id"):
            continue
        book_side = "asks" if str(order.get("side", "")).upper() == "BUY" else "bids"
        for fill in order.get("fills", []):
            price = int(fill.get("price") or 0)
            quantity = int(fill.get("quantity") or 0)
            if price > 0 and quantity > 0:
                consumed[book_side][price] = consumed[book_side].get(price, 0) + quantity

    result = {
        key: deepcopy(value)
        for key, value in snapshot.items()
        if key not in {"_id", "bids", "asks"}
    }
    for book_side in ("bids", "asks"):
        levels: list[dict[str, Any]] = []
        cumulative = 0
        for source_level in snapshot.get(book_side, []):
            level = dict(source_level)
            initial = int(level.get("quantity") or 0)
            used = min(initial, consumed[book_side].get(int(level["price"]), 0))
            remaining = max(0, initial - used)
            cumulative += remaining
            level.update(
                {
                    "initial_quantity": initial,
                    "consumed_quantity": used,
                    "quantity": remaining,
                    "cumulative_quantity": cumulative,
                }
            )
            levels.append(level)
        result[book_side] = levels
    return result


def validate_limit_price(limit_price: int, asset: dict) -> None:
    if limit_price <= 0:
        raise PlayError("INVALID_LIMIT_PRICE", "지정가는 1원 이상이어야 합니다.")
    if limit_price % tick_size(limit_price, asset) != 0:
        raise PlayError(
            "INVALID_LIMIT_PRICE",
            f"지정가 {limit_price:,}원이 해당 가격대의 호가 단위와 맞지 않습니다.",
        )


def match_order(
    orderbook: dict,
    *,
    side: str,
    order_type: str,
    quantity: int,
    limit_price: int | None,
) -> dict:
    """고정 호가를 IOC 방식으로 소진해 체결 목록을 만든다."""
    normalized_side = side.upper()
    normalized_type = order_type.upper()
    if normalized_side not in {"BUY", "SELL"}:
        raise PlayError("INVALID_SIDE", "주문 방향은 BUY 또는 SELL이어야 합니다.")
    if normalized_type not in {"MARKET", "LIMIT"}:
        raise PlayError("INVALID_ORDER_TYPE", "주문 유형은 MARKET 또는 LIMIT이어야 합니다.")
    if quantity <= 0:
        raise PlayError("INVALID_QUANTITY", "주문 수량은 1주 이상이어야 합니다.")
    if normalized_type == "LIMIT" and limit_price is None:
        raise PlayError("LIMIT_PRICE_REQUIRED", "지정가 주문에는 가격이 필요합니다.")

    levels = orderbook.get("asks" if normalized_side == "BUY" else "bids", [])
    remaining = int(quantity)
    fills: list[dict[str, int]] = []
    for level in levels:
        if remaining <= 0:
            break
        price = int(level.get("price") or 0)
        available = int(level.get("quantity") or 0)
        if price <= 0 or available <= 0:
            continue
        if normalized_type == "LIMIT":
            if normalized_side == "BUY" and price > int(limit_price):
                break
            if normalized_side == "SELL" and price < int(limit_price):
                break
        filled = min(remaining, available)
        fills.append({"price": price, "quantity": filled, "amount": price * filled})
        remaining -= filled

    filled_quantity = quantity - remaining
    amount = sum(fill["amount"] for fill in fills)
    average_price = round(amount / filled_quantity, 2) if filled_quantity else None
    if filled_quantity == quantity:
        status = "FILLED"
    elif filled_quantity > 0:
        status = "PARTIALLY_FILLED"
    else:
        status = "CANCELLED"
    return {
        "status": status,
        "requested_quantity": int(quantity),
        "filled_quantity": filled_quantity,
        "cancelled_quantity": remaining,
        "amount": amount,
        "average_execution_price": average_price,
        "fills": fills,
        "time_in_force": "IOC",
    }
