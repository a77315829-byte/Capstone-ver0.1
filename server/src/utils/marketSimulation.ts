export type SimulationStock = { code: string; name: string; market: 'KR' | 'US'; currency: 'KRW' | 'USD'; exchange?: 'NAS' | 'NYS' | 'AMS' };

export function normalizeSimulationStock(value: unknown): SimulationStock | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (typeof input.code !== 'string' || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100) return null;
  const code = input.code.trim().toUpperCase();
  const market = /^\d[A-Z0-9]{5}$/.test(code) ? 'KR' : /^[A-Z][A-Z0-9.-]{0,11}$/.test(code) ? 'US' : null;
  if (!market || (input.market != null && input.market !== market)) return null;
  if (market === 'KR') return { code, name: input.name.trim(), market, currency: 'KRW' };
  const exchange = input.exchange ?? 'NAS';
  if (exchange !== 'NAS' && exchange !== 'NYS' && exchange !== 'AMS') return null;
  return { code, name: input.name.trim(), market, currency: 'USD', exchange };
}
