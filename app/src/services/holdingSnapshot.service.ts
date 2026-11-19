import api from './api.service';
import { readHoldingWallet } from '../utils/holdingWallet';
import { valueHolding, type HoldingMarket, type HoldingPosition, type HoldingValuation } from '../utils/holdingValuation';

export async function loadHoldingSnapshot(market: HoldingMarket, signal: AbortSignal) {
  const response = await api.get(`/${market === 'US' ? 'us-trading' : 'trading'}/portfolio`, {
    params: { evaluate: false }, signal, timeout: 15000,
  });
  // Portfolio may apply due salary funding; read cash only after that has completed.
  const walletRequest = api.get('/fx/wallet', { signal, timeout: 15000 }).catch(() => null);
  const portfolio = response.data?.data;
  if (!Array.isArray(portfolio?.holdings)) throw new Error('보유주식 응답을 확인할 수 없습니다.');
  const positions: HoldingPosition[] = portfolio.holdings.filter((item: HoldingPosition) =>
    item && typeof item.symbol === 'string' && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.avgPrice) && item.avgPrice >= 0);
  const holdings: HoldingValuation[] = new Array(positions.length);
  let next = 0;
  // Limit requests so the holdings panel does not consume all quote API capacity.
  await Promise.all(Array.from({ length: Math.min(3, positions.length) }, async () => {
    while (next < positions.length && !signal.aborted) {
      const index = next++;
      const item = positions[index]!;
      const path = market === 'US'
        ? `/us-stocks/${encodeURIComponent(item.exchange || 'NAS')}/${encodeURIComponent(item.symbol)}/info`
        : `/stocks/${encodeURIComponent(item.symbol)}/info`;
      try {
        const quoteResponse = await api.get(path, { signal, timeout: 10000 });
        const quote = quoteResponse.data?.data ?? quoteResponse.data;
        holdings[index] = valueHolding(item, quote);
      } catch {
        holdings[index] = valueHolding(item, null);
      }
    }
  }));
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const wallet = readHoldingWallet((await walletRequest)?.data);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  return { holdings, wallet, checkedAt: Date.now() };
}
