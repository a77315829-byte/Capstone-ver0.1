export type HoldingMarket = 'KR' | 'US';
export type HoldingPosition = {
  symbol: string; name: string; market: string; exchange?: string;
  quantity: number; avgPrice: number; buyAmount?: number;
};
export type HoldingValuation = HoldingPosition & {
  currentPrice: number | null; evaluationAmount: number | null;
  profitLoss: number | null; profitLossRate: number | null;
};
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// The portfolio endpoint returns purchase prices when evaluation is disabled or fails.
// Only an independently received, positive quote may be shown as the current price.
export function valueHolding(position: HoldingPosition, quote?: { price?: number; name?: string } | null): HoldingValuation {
  const buyAmount = finite(position.buyAmount) && position.buyAmount >= 0 ? position.buyAmount : cents(position.avgPrice * position.quantity);
  const quotedPrice = quote?.price;
  const currentPrice = finite(quotedPrice) && quotedPrice > 0 ? quotedPrice : null;
  const evaluationAmount = currentPrice == null ? null : cents(currentPrice * position.quantity);
  const profitLoss = evaluationAmount == null ? null : cents(evaluationAmount - buyAmount);
  return { ...position, name: quote?.name || position.name, buyAmount, currentPrice, evaluationAmount,
    profitLoss, profitLossRate: profitLoss != null && buyAmount > 0 ? profitLoss / buyAmount * 100 : null };
}

export function summarizeHoldings(holdings: HoldingValuation[]) {
  const buyAmount = cents(holdings.reduce((sum, item) => sum + (item.buyAmount || 0), 0));
  const incomplete = holdings.some(item => item.evaluationAmount == null);
  const evaluationAmount = incomplete ? null : cents(holdings.reduce((sum, item) => sum + (item.evaluationAmount || 0), 0));
  const profitLoss = evaluationAmount == null ? null : cents(evaluationAmount - buyAmount);
  return { buyAmount, evaluationAmount, profitLoss, incomplete,
    profitLossRate: profitLoss != null && buyAmount > 0 ? profitLoss / buyAmount * 100 : holdings.length ? null : 0 };
}

export function tradingUpdate(method?: string, url?: string) {
  if (!method || !['post', 'put', 'patch', 'delete'].includes(method.toLowerCase()) || !url) return null;
  const path = url.split('?')[0] || '';
  const match = path.match(/^\/(us-trading|trading)\/(orders(?:\/[^/]+\/cancel|\/check-pending)?|reset|top-up)$/);
  if (match) return { market: (match[1] === 'us-trading' ? 'US' : 'KR') as HoldingMarket, openPanel: match[2] === 'orders' && method.toLowerCase() === 'post' };
  if (/^\/stocks\/[^/]+\/(buy|sell)$/.test(path)) return { market: 'KR' as const, openPanel: true };
  return null;
}
