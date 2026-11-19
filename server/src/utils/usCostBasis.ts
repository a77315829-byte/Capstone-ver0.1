export const usdCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function holdingCost(holding: { quantity: number; avgPrice: number; totalBuyAmount?: number }) {
  const stored = Number(holding.totalBuyAmount);
  return usdCents(Number.isFinite(stored) && stored > 0 ? stored : holding.avgPrice * holding.quantity);
}
export function splitHoldingCost(totalCost: number, quantity: number, soldQuantity: number) {
  const soldCost = soldQuantity === quantity ? totalCost : usdCents(totalCost * soldQuantity / quantity);
  return { soldCost, remainingCost: usdCents(totalCost - soldCost) };
}
