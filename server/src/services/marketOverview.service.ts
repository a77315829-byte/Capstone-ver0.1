import { fetchKrMarketRanking, fetchUsMarketRanking, fetchMarketIndex } from '../utils/requests';
import { marketNumber, signedMarketNumber, RankingSort } from '../utils/marketOverview';
import mongoose from 'mongoose';
import MarketRankingSnapshot from '../models/marketRankingSnapshot.model';
import { createMarketRankingCache, RankingSnapshot } from './marketRankingCache';
import { getUsMarketStatus } from './usMarketSession.service';
import { getKrxMarketStatus } from './marketSession.service';
import { withDeadline } from '../utils/runtime';

type Section<T> = { data: T; asOf: string | null; stale: boolean; error: string | null };
const cache = new Map<string, { until: number; value: Section<any> }>();
const pending = new Map<string, Promise<Section<any>>>();
async function section<T>(key: string, empty: T, work: () => Promise<{ data: T; error?: string | null }>): Promise<Section<T>> {
  const saved = cache.get(key);
  if (saved && saved.until > Date.now()) return saved.value;
  const active = pending.get(key);
  const task = active ?? (async () => {
    let value: Section<T>;
    try { const result = await work(); value = { ...result, error: result.error || null, asOf: new Date().toISOString(), stale: false }; }
    catch { value = { data: saved?.value.data || empty, asOf: saved?.value.asOf || null, stale: true, error: '시세를 갱신하지 못했습니다. 잠시 후 다시 확인해 주세요.' }; }
    cache.set(key, { until: Date.now() + 20000, value }); return value;
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  if (saved?.value.data != null) return { ...saved.value, stale: true, error: '마지막 지수를 표시하며 갱신 중입니다.' };
  // Slow index providers must not hold up the independently available stock rankings.
  return withDeadline(task, 1500).catch(() => ({ data: empty, asOf: null, stale: true, error: '지수 조회가 지연되고 있습니다.' }));
}
const ranking = createMarketRankingCache({
 kr: fetchKrMarketRanking, us: fetchUsMarketRanking,
 load: async key => {
  if (mongoose.connection.readyState !== 1) return null;
  const row = await MarketRankingSnapshot.findOne({ key }).maxTimeMS(2000).lean();
  return (row?.snapshot as RankingSnapshot) ?? null;
 },
 save: async (key, snapshot) => {
  if (mongoose.connection.readyState !== 1) return;
  await MarketRankingSnapshot.updateOne({ key }, { $set: { snapshot } }, { upsert: true, maxTimeMS: 2000 });
 },
});
const INDEXES = [
  { code: '0001', name: '코스피', domestic: true }, { code: '1001', name: '코스닥', domestic: true },
  { code: 'COMP', name: '나스닥 종합', domestic: false }, { code: 'SPX', name: 'S&P 500', domestic: false },
];
async function indexes() {
  return Promise.all(INDEXES.map(async item => ({ code: item.code, name: item.name,
    ...await section(`index:${item.code}`, null, async () => {
      const result = await fetchMarketIndex(item.code, item.domestic);
      const row: any = item.domestic ? result.output : result.output1;
      const price = marketNumber(item.domestic ? row?.bstp_nmix_prpr : row?.ovrs_nmix_prpr);
      if (price == null || price <= 0) throw new Error('Missing index');
      const dates = (result.output2 || []).map((entry: any) => String(entry.stck_bsop_date || '')).filter((date: string) => /^\d{8}$/.test(date)).sort();
      const date = dates[dates.length - 1];
      return { data: { price, change: signedMarketNumber(item.domestic ? row.bstp_nmix_prdy_vrss : row.ovrs_nmix_prdy_vrss, row.prdy_vrss_sign),
        changeRate: signedMarketNumber(item.domestic ? row.bstp_nmix_prdy_ctrt : row.prdy_ctrt, row.prdy_vrss_sign),
        date: date ? `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}` : null } };
    })
  })));
}
export async function getMarketOverview(market: 'KR' | 'US', sort: RankingSort = 'volume') {
  const [leaders, indices] = await Promise.all([ranking(market, sort), indexes()]);
  return { market, sort, ranking: leaders, indices, sessions: { KR: getKrxMarketStatus(), US: getUsMarketStatus() }, source: '한국투자증권 KIS', refreshSeconds: 30 };
}
