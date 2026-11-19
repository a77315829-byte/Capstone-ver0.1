export type CashBalance = { cash: number; reservedCash: number; availableCash: number };
export type HoldingWallet = { KRW: CashBalance; USD: CashBalance };
export function readHoldingWallet(value: unknown): HoldingWallet | null {
  if (!value || typeof value !== 'object') return null;
  const wallet = value as HoldingWallet;
  for (const currency of ['KRW', 'USD'] as const) {
    const balance = wallet[currency];
    if (!balance || ![balance.cash, balance.reservedCash, balance.availableCash].every(
      item => typeof item === 'number' && Number.isFinite(item))) return null;
  }
  return wallet;
}
