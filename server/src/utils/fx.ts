export type FxDirection = 'KRW_TO_USD' | 'USD_TO_KRW';
export function fxError(statusCode: number, message: string) { return Object.assign(new Error(message), { statusCode }); }
export function validFxRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 100 && value <= 10000;
}
export function validateExchangeInput(direction: FxDirection, amount: unknown): asserts amount is number {
  if (!['KRW_TO_USD', 'USD_TO_KRW'].includes(direction)) throw fxError(400, '환전 방향을 확인해 주세요.');
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) throw fxError(400, '환전 금액을 확인해 주세요.');
  const precision = direction === 'KRW_TO_USD' ? 1 : 100;
  if (Math.abs(amount * precision - Math.round(amount * precision)) > 0.000001) throw fxError(400, direction === 'KRW_TO_USD' ? '원화는 1원 단위로 입력해 주세요.' : '달러는 0.01달러 단위로 입력해 주세요.');
}
export function calculateExchange(direction: FxDirection, amount: unknown, rate: number) {
  validateExchangeInput(direction, amount);
  if (!validFxRate(rate)) throw fxError(400, '환율을 확인해 주세요.');
  // Round RECEIVED money down, so repeated round trips cannot create money.
  const received = direction === 'KRW_TO_USD' ? Math.floor(amount / rate * 100 + 1e-9) / 100 : Math.floor(amount * rate + 1e-9);
  if (received <= 0) throw fxError(400, '환전 후 금액이 최소 단위보다 작습니다.');
  return { direction, sourceCurrency: direction === 'KRW_TO_USD' ? 'KRW' : 'USD', targetCurrency: direction === 'KRW_TO_USD' ? 'USD' : 'KRW', sourceAmount: amount, targetAmount: received, rate };
}
export function signedFundingAmount(record: { amount?: number; type?: string }) {
  const amount = Math.max(0, Number(record.amount) || 0);
  return record.type === 'FX_OUT' ? -amount : amount;
}
