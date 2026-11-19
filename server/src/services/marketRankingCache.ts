import { periodLeaders, volumeLeaders, sortMarketLeaders, RankingSort, VolumeLeader } from '../utils/marketOverview';
import { UsExchangeCode } from '../data/usStocks';
import { withDeadline } from '../utils/runtime';

export type RankingPeriod = 'session' | 'two-day';
export type RankingSnapshot = { data: VolumeLeader[]; asOf: string; period: RankingPeriod };
export type RankingSection = { data: VolumeLeader[]; asOf: string | null; period: RankingPeriod; stale: boolean; error: string | null; periodLabel: string };
type Market = 'KR' | 'US';
type Dependencies = {
 kr: (sort: RankingSort) => Promise<any>;
 us: (exchange: UsExchangeCode, sort: RankingSort, period: '0' | '1') => Promise<any>;
 load: (key: string) => Promise<RankingSnapshot | null>;
 save: (key: string, value: RankingSnapshot) => Promise<void>;
 now?: () => number;
};
const EXCHANGES = ['NAS', 'NYS', 'AMS'] as const;
const RETAIN_MS = 7 * 86400000;
const twoDayLabel = (sort: RankingSort) => sort === 'volume' ? '최근 2거래일 평균 거래량 기준'
 : sort === 'turnover' ? '최근 2거래일 평균 거래대금 기준' : '최근 2거래일 등락률 기준';

export function createMarketRankingCache(deps: Dependencies) {
 const now = deps.now ?? Date.now;
 const saved = new Map<string, RankingSnapshot>();
 const initialized = new Map<string, Promise<void>>();
 const responses = new Map<string, { until: number; value: RankingSection }>();
 const pending = new Map<string, Promise<RankingSection>>();
 const usable = (value: RankingSnapshot | undefined | null): value is RankingSnapshot => !!value &&
  ['session', 'two-day'].includes(value.period) && Array.isArray(value.data) && value.data.length > 0 &&
  Number.isFinite(Date.parse(value.asOf)) && now() >= Date.parse(value.asOf) && now() - Date.parse(value.asOf) <= RETAIN_MS;
 const section = (snapshot: RankingSnapshot, stale: boolean, error: string | null): RankingSection => ({ ...snapshot, stale, error,
  periodLabel: snapshot.period === 'two-day' ? '최근 2거래일 기준' : stale ? '마지막 수신한 당일 순위' : '당일 누적 순위' });
 async function read(key: string) {
  if (!initialized.has(key)) {
   initialized.set(key, Promise.resolve().then(async () => {
    try { const value = await deps.load(key); if (usable(value)) saved.set(key, value); } catch { /* In-memory operation remains available. */ }
   }));
  }
  await initialized.get(key);
  const value = saved.get(key); return usable(value) ? value : null;
 }
 async function keep(key: string, snapshot: RankingSnapshot, complete: boolean) {
  // An empty/partial response must never erase a complete last-known ranking.
  if (!snapshot.data.length || !complete) return;
  saved.set(key, snapshot);
  try { await deps.save(key, snapshot); } catch { /* Keep the useful response if persistence is unavailable. */ }
 }
 async function fetchRows(market: Market, sort: RankingSort, period: '0' | '1') {
  if (market === 'KR') {
   const result = await deps.kr(sort);
   if (!Array.isArray(result.output)) throw new Error('Invalid ranking');
   const data = sortMarketLeaders(volumeLeaders(result.output), sort);
   return { data: activeRows(data, sort), missing: [] as string[] };
  }
  const results = await Promise.allSettled(EXCHANGES.map(async exchange => {
   const result = await deps.us(exchange, sort, period);
   if (!Array.isArray(result.output2)) throw new Error('Invalid ranking');
   return activeRows(sortMarketLeaders(period === '0' ? volumeLeaders(result.output2, exchange) : periodLeaders(result.output2, exchange, sort), sort, 100), sort);
  }));
  const data = sortMarketLeaders(results.flatMap(r => r.status === 'fulfilled' ? r.value : []), sort);
  const missing = results.flatMap((r, index) => r.status === 'rejected' || !r.value.length ? [EXCHANGES[index]] : []);
  return { data, missing };
 }
 function activeRows(rows: VolumeLeader[], sort: RankingSort) {
  return rows.filter(row => sort === 'volume' ? row.volume > 0 : sort === 'turnover' ? (row.turnover ?? 0) > 0 : true);
 }
 async function refresh(market: Market, sort: RankingSort) {
  const key = `${market}:${sort}`;
  const [previous, periodPrevious] = await Promise.all([read(key + ':session'), read(key + ':two-day')]);
  let failed = false;
  try {
   const current = await fetchRows(market, sort, '0');
   if (current.data.length) {
    const snapshot: RankingSnapshot = { data: current.data, asOf: new Date(now()).toISOString(), period: 'session' };
    await keep(key + ':session', snapshot, !current.missing.length);
    return section(snapshot, false, current.missing.length ? `${current.missing.join(', ')} 순위를 받지 못해 수신된 거래소만 표시합니다.` : null);
   }
  } catch { failed = true; }
  if (previous) return section(previous, true, failed ? '순위 갱신에 실패해 마지막 정상 결과를 표시합니다.' : '현재 당일 순위가 제공되지 않아 마지막 정상 결과를 표시합니다.');
  if (market === 'US') {
   // Probe current-session rankings every refresh; reuse the closed-session period data for five minutes.
   if (periodPrevious && now() - Date.parse(periodPrevious.asOf) < 300000) return section(periodPrevious, true, '당일 순위가 없어 최근 기간 순위를 표시합니다.');
   try {
    const recent = await fetchRows(market, sort, '1');
    if (recent.data.length) {
     const snapshot: RankingSnapshot = { data: recent.data, asOf: new Date(now()).toISOString(), period: 'two-day' };
     await keep(key + ':two-day', snapshot, !recent.missing.length);
     return section(snapshot, false, `당일 순위가 없어 최근 기간 순위를 표시합니다.${recent.missing.length ? ` ${recent.missing.join(', ')}는 미수신되어 제외했습니다.` : ''}`);
    }
   } catch { /* Retain the last period response rather than replacing it with an empty list. */ }
   if (periodPrevious) return section(periodPrevious, true, '순위 갱신에 실패해 마지막 최근 기간 결과를 표시합니다.');
  }
  return { data: [], asOf: null, period: 'session' as const, stale: true, error: '현재 순위와 저장된 이전 순위를 받지 못했습니다. 잠시 후 다시 확인해 주세요.', periodLabel: '당일 누적 순위' };
 }
 function forceRefresh(market: Market, sort: RankingSort): Promise<RankingSection> {
  const key = `${market}:${sort}`;
  const active = pending.get(key); if (active) return active;
  const task = refresh(market, sort).catch(() => ({ data: [], asOf: null, period: 'session' as const, stale: true,
   error: '순위를 갱신하지 못했습니다. 잠시 후 다시 확인해 주세요.', periodLabel: '당일 누적 순위' })).then(value => {
   if (value.period === 'two-day') value.periodLabel = twoDayLabel(sort);
   responses.set(key, { value, until: now() + 20000 }); return value;
  }).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
 }
 async function get(market: Market, sort: RankingSort): Promise<RankingSection> {
  const key = `${market}:${sort}`, cached = responses.get(key);
  if (cached && cached.until > now()) return cached.value;
  const [daily, period] = await Promise.all([read(key + ':session'), read(key + ':two-day')]);
  const prior = cached?.value.data.length && usable(cached.value as RankingSnapshot) ? cached.value : daily ?? period;
  const task = forceRefresh(market, sort);
  if (prior) {
   const value = section(prior as RankingSnapshot, true, '저장된 순위를 먼저 표시하고 뒤에서 갱신 중입니다.');
   if (value.period === 'two-day') value.periodLabel = twoDayLabel(sort);
   return value;
  }
  // No history on the first run: bound the HTTP wait, while sharing the same background request.
  return withDeadline(task, 8000).catch(() => ({ data: [], asOf: null, period: 'session', stale: true,
   error: '순위 제공 응답이 지연되고 있습니다. 수신되면 다음 갱신에 표시합니다.', periodLabel: '당일 누적 순위' }));
 }
 return Object.assign(get, { refresh: forceRefresh });
}
