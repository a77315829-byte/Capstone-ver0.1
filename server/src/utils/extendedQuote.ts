import { domesticTimestamp } from './kisRealtime';

export type QuoteSession = { localDate: string; timezone: string; sessionType: string; limitOrderAllowed: boolean; sessionStartTime: string | null; sessionEndTime: string | null };
export type ExtendedQuote = { price: number; observedAt: string; source: string; session: string };
export const EXTENDED_QUOTE_MAX_AGE_MS = 120000;

export function isFreshSessionQuote(quote: ExtendedQuote, status: QuoteSession, now: Date): boolean {
 const time = Date.parse(quote.observedAt);
 const age = now.getTime() - time;
 if (!Number.isFinite(quote.price) || quote.price <= 0 || !Number.isFinite(age) || age < 0 || age > EXTENDED_QUOTE_MAX_AGE_MS ||
  !status.limitOrderAllowed || !['PRE', 'POST'].includes(status.sessionType) || quote.session !== status.sessionType) return false;
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: status.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(time)).map(p => [p.type, p.value]));
 const date = `${parts.year}-${parts.month}-${parts.day}`, clock = `${parts.hour}:${parts.minute}`;
 return date === status.localDate && !!status.sessionStartTime && !!status.sessionEndTime && clock >= status.sessionStartTime && clock < status.sessionEndTime;
}

export function usExtendedQuote(rows: unknown, status: QuoteSession, now: Date): ExtendedQuote | null {
 if (!Array.isArray(rows)) return null;
 return rows.flatMap(row => {
  if (!row || Number(row.evol) <= 0 || !Number.isFinite(Number(row.evol))) return [];
  const time = domesticTimestamp(String(row.kymd || ''), String(row.khms || ''));
  if (!Number.isFinite(time)) return [];
  const quote = { price: Number(row.last), observedAt: new Date(time * 1000).toISOString(), source: 'KIS_US_1MIN', session: status.sessionType };
  return isFreshSessionQuote(quote, status, now) ? [quote] : [];
 }).sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0] ?? null;
}

export function krExtendedQuote(trades: unknown, bars: unknown, status: QuoteSession, now: Date): ExtendedQuote | null {
 if (!Array.isArray(trades) || !Array.isArray(bars)) return null;
 // Execution endpoint omits date. Require an independently dated, recent, nonempty bar
 // from the same KRX venue before associating its execution clock with today's date.
 const datedBars = bars.filter(row => row && Number(row.cntg_vol) > 0).flatMap(row => {
  const time = domesticTimestamp(String(row.stck_bsop_date || ''), String(row.stck_cntg_hour || ''));
  if (!Number.isFinite(time)) return [];
  const q = { price: Number(row.stck_prpr), observedAt: new Date(time * 1000).toISOString(), source: 'KIS_KRX', session: 'POST' };
  return isFreshSessionQuote(q, status, now) ? [{ row, time }] : [];
 });
 if (!datedBars.length) return null;
 return trades.flatMap(row => {
  if (!row || Number(row.cnqn) <= 0) return [];
  const time = domesticTimestamp(status.localDate.replace(/-/g, ''), String(row.stck_cntg_hour || ''));
  if (!Number.isFinite(time) || !datedBars.some(bar => Math.floor(time / 60) === Math.floor(bar.time / 60))) return [];
  const q = { price: Number(row.stck_prpr), observedAt: new Date(time * 1000).toISOString(), source: 'KIS_KRX_EXECUTION', session: 'POST' };
  return isFreshSessionQuote(q, status, now) ? [q] : [];
 }).sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0] ?? null;
}
