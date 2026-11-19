export type RealizedDay = { date: string; profit: number };
export type HoldingDay = { date: string; profit: number; rate: number | null; buyAmount: number; observedAt: string };
export function holdingPerformancePoints(history: HoldingDay[], current: HoldingDay, days?: number) {
 const now = Date.parse(current.observedAt);
 const domain = performanceDomain(days, now, history[0]?.date || current.date);
 // Each point keeps its original denominator; later deposits or purchases cannot rewrite past returns.
 return [...history.filter(day => day.date !== current.date), current]
  .filter(day => Date.parse(day.observedAt) >= domain.start && Date.parse(day.observedAt) <= now)
  .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
  .map(day => ({ ...day, time: Date.parse(day.observedAt), value: day.rate, kind: day === current ? 'current' : 'holding' }));
}
export type PerformancePoint = { label: string; date: string; time: number; value: number; profit: number; kind: 'realized' | 'current' };
export const seoulDay = (time: number) => new Date(time).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const dayTime = (date: string) => Date.parse(`${date}T00:00:00+09:00`);
export function performanceDomain(days: number | undefined, now: number, firstDate?: string) {
  const start = days ? dayTime(seoulDay(now)) - (days - 1) * 86400000 : dayTime(firstDate || seoulDay(now));
  return { start, end: Math.max(now, start + 1) };
}
// Past points reconstruct cumulative realized P/L only. Current point includes held-position P/L.
export function performancePoints(history: RealizedDay[], capital: number, currentProfit: number,
  days?: number, now = Date.now(), firstDate?: string): PerformancePoint[] {
  const sorted = [...history].filter(day => dayTime(day.date) <= now).sort((a, b) => a.date.localeCompare(b.date));
  const first = firstDate || sorted[0]?.date || seoulDay(now);
  const domain = performanceDomain(days, now, first);
  const start = Math.max(domain.start, Math.min(dayTime(first), now));
  let cumulative = 0;
  const result: PerformancePoint[] = [];
  const point = (time: number, profit: number, kind: 'realized' | 'current'): PerformancePoint => ({
    label: kind === 'current' ? '현재' : seoulDay(time).slice(5).replace('-', '/'),
    date: seoulDay(time), time, profit, kind, value: capital > 0 ? profit / capital * 100 : 0,
  });
  for (const day of sorted) {
    const time = dayTime(day.date);
    if (time < start) { cumulative += day.profit; continue; }
    if (!result.length) result.push(point(start, cumulative, 'realized'));
    cumulative += day.profit;
    result.push(point(time, cumulative, 'realized'));
  }
  if (!result.length) result.push(point(start, cumulative, 'realized'));
  result.push(point(now, currentProfit, 'current'));
  return result;
}
