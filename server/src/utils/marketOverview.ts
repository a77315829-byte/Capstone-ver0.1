import { US_EXCHANGE_NAME, US_STOCK_CATALOG, UsExchangeCode } from '../data/usStocks';
export const RANKING_SORTS = ['volume', 'turnover', 'gainers', 'losers'] as const;
export type RankingSort = typeof RANKING_SORTS[number];
export function isRankingSort(value: unknown): value is RankingSort {
  return typeof value === 'string' && (RANKING_SORTS as readonly string[]).includes(value);
}
export function marketNumber(value: unknown): number | null {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}
export function signedMarketNumber(value: unknown, sign: unknown) {
  const number = marketNumber(value);
  if (number == null) return null;
  if (['4', '5'].includes(String(sign))) return -Math.abs(number);
  if (['1', '2'].includes(String(sign))) return Math.abs(number);
  return number;
}
export interface VolumeLeader {
  symbol: string; name: string; market: string; exchange?: UsExchangeCode;
  price: number; changeRate: number | null; volume: number; turnover: number | null;
}
export function volumeLeaders(rows: any[], exchange?: UsExchangeCode): VolumeLeader[] {
  return rows.flatMap(row => {
    const symbol = String(exchange ? row.symb || '' : row.mksc_shrn_iscd || row.stck_shrn_iscd || '').trim().replace(/^Q(?=\d{6}$)/, '');
    const price = marketNumber(exchange ? row.last : row.stck_prpr);
    const volume = marketNumber(exchange ? row.tvol : row.acml_vol);
    if (!(exchange ? /^[A-Z0-9.\-]{1,16}$/.test(symbol) : /^\d[A-Z0-9]{5}$/.test(symbol)) || price == null || price <= 0 || volume == null || volume < 0) return [];
    return [{ symbol, name: exchange ? US_STOCK_CATALOG.find(item => item.symbol === symbol)?.nameKo || row.name || row.ename || symbol : row.hts_kor_isnm || symbol,
      market: exchange ? US_EXCHANGE_NAME[exchange] : 'KRX', ...(exchange ? { exchange } : {}), price, volume,
      changeRate: signedMarketNumber(exchange ? row.rate : row.prdy_ctrt, exchange ? row.sign : row.prdy_vrss_sign),
      turnover: marketNumber(exchange ? row.tamt : row.acml_tr_pbmn) }];
  });
}
export function sortVolumeLeaders(rows: VolumeLeader[], limit = 30) {
  return sortMarketLeaders(rows, 'volume', limit);
}
// NDAY=1 is a two-day period, not a previous-day switch. Use its own metrics;
// the daily tvol/tamt/rate fields can already have reset to zero before opening.
export function periodLeaders(rows: any[], exchange: UsExchangeCode, sort: RankingSort): VolumeLeader[] {
 return volumeLeaders(rows, exchange).flatMap(item => {
  const raw = rows.find(row => String(row.symb || '').trim() === item.symbol);
  const volume = marketNumber(raw?.a_tvol), turnover = marketNumber(raw?.a_tamt);
  const rate = marketNumber(raw?.n_rate);
  if (sort === 'volume' && (volume == null || volume <= 0) || sort === 'turnover' && (turnover == null || turnover <= 0)) return [];
  return [{ ...item, volume: sort === 'volume' ? volume! : item.volume,
   turnover: sort === 'turnover' ? turnover : null, changeRate: rate }];
 });
}
export function sortMarketLeaders(rows: VolumeLeader[], sort: RankingSort, limit = 30) {
  const unique = new Map(rows.map(row => [`${row.exchange || 'KR'}:${row.symbol}`, row]));
  const metric = (row: VolumeLeader) => sort === 'volume' ? row.volume : sort === 'turnover' ? row.turnover : row.changeRate;
  return [...unique.values()].filter(row => {
    const value = metric(row);
    return value != null && Number.isFinite(value) && (sort === 'gainers' ? value > 0 : sort === 'losers' ? value < 0 : value >= 0);
  }).sort((a, b) => (sort === 'losers' ? metric(a)! - metric(b)! : metric(b)! - metric(a)!)
    || b.volume - a.volume || a.symbol.localeCompare(b.symbol)).slice(0, limit);
}
