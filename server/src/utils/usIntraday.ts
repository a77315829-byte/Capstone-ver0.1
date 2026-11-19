export const US_INTRADAY_MINUTES = { '1min': 1, '5min': 5, '15min': 15, '1h': 60, '4h': 240 } as const;

// KIS supplies a Korean date/time alongside the exchange-local timestamp.
// Use its explicit UTC+09:00 offset: this also handles US DST and midnight rollover.
export function parseUsIntradayRows(rows: unknown) {
  const points = new Map<number, { time: number; open: number; high: number; low: number; close: number; volume: number }>();
  if (!Array.isArray(rows)) return [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const date = String(row.kymd || '');
    const clock = String(row.khms || '');
    if (!/^\d{8}$/.test(date) || !/^\d{6}$/.test(clock)) continue;
    const time = Date.parse(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${clock.slice(0, 2)}:${clock.slice(2, 4)}:${clock.slice(4, 6)}+09:00`) / 1000;
    const open = Number(row.open), high = Number(row.high), low = Number(row.low), close = Number(row.last);
    const volume = Number(row.evol);
    if (![time, open, high, low, close, volume].every(Number.isFinite) || time <= 0 ||
        Math.min(open, high, low, close) <= 0 || high < Math.max(open, close, low) || low > Math.min(open, close) || volume < 0) continue;
    if (!points.has(time)) points.set(time, { time, open, high, low, close, volume });
  }
  return [...points.values()].sort((a, b) => a.time - b.time);
}
