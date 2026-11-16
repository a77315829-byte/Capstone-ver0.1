export type ChartInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1wk" | "1mo" | "1y";
export const DEFAULT_CHART_INTERVAL: ChartInterval = "1d";
export const INITIAL_CANDLE_COUNT = 100;
export const OLDER_CANDLE_COUNT = 120;
export const VISIBLE_CANDLE_COUNT = 60;
export const isCalendarInterval = (interval: ChartInterval) => ["1d", "1wk", "1mo", "1y"].includes(interval);
export type ChartPoint = { time: number; open: number; high: number; low: number; close: number; volume?: number };
export type DomesticTrade = {
	type: "trade"; symbol: string; time: number; price: number; quantity: number;
	cumulativeVolume: number; changePrice: number; changeRate: number;
	open: number; high: number; low: number;
};
export type ChartBook = {
	points: ChartPoint[];
	cumulativeVolume: number | null;
	date: string;
	lastTradeTime: number;
};

export const seoulDate = (time: number) => new Date((time + 9 * 3600) * 1000).toISOString().slice(0, 10);

export function formatCandleLabel(time: number, interval: ChartInterval, axis = false): string {
	const date = new Date((time + 32400) * 1000).toISOString();
	if (interval === "1y") return date.slice(0, 4);
	if (interval === "1mo") return date.slice(0, 7);
	if (isCalendarInterval(interval)) return date.slice(axis ? 5 : 0, 10);
	return axis ? date.slice(11, 16) : date.slice(0, 16).replace("T", " ");
}

export function candleTime(time: number, interval: ChartInterval): number {
	if (isCalendarInterval(interval)) {
		const date = new Date((time + 32400) * 1000);
		date.setUTCHours(0, 0, 0, 0);
		if (interval === "1wk") date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
		if (interval === "1mo") date.setUTCDate(1);
		if (interval === "1y") date.setUTCMonth(0, 1);
		return date.getTime() / 1000 - 32400;
	}
	const seconds = ({ "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400 } as Record<string, number>)[interval]!;
	return Math.floor((time + 9 * 3600) / seconds) * seconds - 9 * 3600;
}

export function snapshotBook(points: ChartPoint[], cumulativeVolume: number | null, snapshotDate?: string): ChartBook {
	return { points, cumulativeVolume, date: snapshotDate ?? (points.length ? seoulDate(points[points.length - 1]!.time) : ""), lastTradeTime: 0 };
}

export function applyTrade(book: ChartBook, trade: DomesticTrade, interval: ChartInterval): ChartBook {
	if (!Number.isFinite(trade.time) || !Number.isFinite(trade.price) || trade.price <= 0 ||
		!Number.isFinite(trade.cumulativeVolume) || trade.cumulativeVolume < 0) return book;
	const date = seoulDate(trade.time);
	if (date < book.date || trade.time < book.lastTradeTime) return book;
	const sameDay = date === book.date;
	if (sameDay && book.cumulativeVolume !== null && trade.cumulativeVolume <= book.cumulativeVolume) return book;
	const time = candleTime(trade.time, interval);
	const last = book.points[book.points.length - 1];
	if (last && time < last.time) return book;
	const sameCandle = last?.time === time;
	// A REST snapshot already includes trades up to its cumulative-volume watermark.
	const delta = sameDay && book.cumulativeVolume !== null
		? trade.cumulativeVolume - book.cumulativeVolume
		: !sameDay && isCalendarInterval(interval) ? trade.cumulativeVolume : sameCandle ? 0 : trade.quantity;
	const candle: ChartPoint = interval === "1d" ? {
		time, open: trade.open || trade.price, high: Math.max(trade.high, trade.price),
		low: Math.min(trade.low || trade.price, trade.price), close: trade.price, volume: trade.cumulativeVolume,
	} : isCalendarInterval(interval) ? {
		time, open: sameCandle ? last.open : trade.open || trade.price,
		high: Math.max(sameCandle ? last.high : trade.high, trade.high, trade.price),
		low: Math.min(sameCandle ? last.low : trade.low || trade.price, trade.low || trade.price, trade.price),
		close: trade.price, volume: sameCandle ? (last.volume || 0) + Math.max(0, delta) : trade.cumulativeVolume,
	} : {
		time, open: sameCandle ? last.open : trade.price,
		high: sameCandle ? Math.max(last.high, trade.price) : trade.price,
		low: sameCandle ? Math.min(last.low, trade.price) : trade.price,
		close: trade.price, volume: sameCandle ? (last.volume || 0) + Math.max(0, delta) : trade.quantity,
	};
	return {
		points: sameCandle ? [...book.points.slice(0, -1), candle] : [...book.points, candle],
		cumulativeVolume: trade.cumulativeVolume, date, lastTradeTime: trade.time,
	};
}

// Preserve the visible dates when older candles are prepended.
export function preserveVisibleRange(previous: ChartPoint[], next: ChartPoint[], range: { from: number; to: number }): { from: number; to: number } {
	if (!previous.length || !next.length) return range;
	const added = next.findIndex((point) => point.time === previous[0]!.time);
	return added > 0 ? { from: range.from + added, to: range.to + added } : range;
}

// Backfill replaces partial older buckets, while keeping the live last candle.
export function mergeChartHistory(history: ChartPoint[], current: ChartPoint[]): ChartPoint[] {
	const points = new Map(history.map((point) => [point.time, point]));
	const latest = history[history.length - 1]?.time ?? 0;
	for (const point of current) if (point.time >= latest) points.set(point.time, point);
	return [...points.values()].sort((a, b) => a.time - b.time);
}
