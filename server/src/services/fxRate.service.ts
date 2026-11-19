import axios from 'axios';
import { fetchUsdKrwQuotation } from '../utils/requests';
import { fxError, validFxRate } from '../utils/fx';

export interface ExchangeRate {
  rate: number; date: string; source: string; fetchedAt: string; stale: boolean;
}
export function usableRate(rate: number, date: string, now = Date.now()) {
  const stamp = Date.parse(`${date}T00:00:00Z`);
  return validFxRate(rate) && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(stamp)
    && stamp <= now + 86400000 && now - stamp <= 7 * 86400000;
}
let cached: ExchangeRate | null = null;
let pending: Promise<ExchangeRate> | null = null;
let attemptedAt = 0;
export async function getExchangeRate(): Promise<ExchangeRate> {
  if (cached && Date.now() - attemptedAt < 60000) return cached;
  if (pending) return pending;
  pending = (async () => {
    attemptedAt = Date.now();
    const providers = [
      async () => ({ ...await fetchUsdKrwQuotation(), source: '한국투자증권 · 원/달러 고시 시세' }),
      async () => {
        const { data } = await axios.get('https://api.frankfurter.dev/v2/rate/USD/KRW', {
          params: { providers: 'ECB' }, timeout: 8000,
        });
        if (data.base !== 'USD' || data.quote !== 'KRW') throw new Error('Unexpected currency');
        return { rate: Number(data.rate), date: String(data.date), source: 'ECB · 일일 기준환율 (Frankfurter)' };
      },
    ];
    for (const fetch of providers) {
      try {
        const result = await fetch();
        if (!usableRate(result.rate, result.date)) continue;
        cached = { ...result, fetchedAt: new Date().toISOString(), stale: false };
        return cached;
      } catch { /* Try the next provider; never expose provider credentials/errors. */ }
    }
    if (cached) { cached = { ...cached, stale: true }; return cached; }
    throw fxError(503, '환율을 조회할 수 없어 환전을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  })();
  try { return await pending; } finally { pending = null; }
}
