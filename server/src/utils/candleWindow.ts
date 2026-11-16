import type { OhlcvPoint } from "./requests";

export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1wk" | "1mo" | "1y";
export const candleIntervals: CandleInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1wk", "1mo", "1y"];
export const isCalendarInterval = (interval: CandleInterval) => ["1d", "1wk", "1mo", "1y"].includes(interval);
export const seoulDateKey = (time: number) => new Date((time + 32400) * 1000).toISOString().slice(0, 10).replace(/-/g, "");

export function calendarCandleTime(time: number, interval: CandleInterval): number {
	const date = new Date((time + 32400) * 1000);
	date.setUTCHours(0, 0, 0, 0);
	if (interval === "1wk") date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
	if (interval === "1mo") date.setUTCDate(1);
	if (interval === "1y") { date.setUTCMonth(0, 1); }
	return date.getTime() / 1000 - 32400;
}

export function intradayCandleTime(time: number, interval: CandleInterval): number {
	const seconds = ({ "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400 } as Record<string, number>)[interval];
	return Math.floor((time + 32400) / seconds) * seconds - 32400;
}

export function aggregateWindow(points: OhlcvPoint[], interval: CandleInterval, before?: number): OhlcvPoint[] {
	const groups = new Map<number, OhlcvPoint>();
	for (const point of [...points].sort((a, b) => a.time - b.time)) {
		const time = isCalendarInterval(interval) ? calendarCandleTime(point.time, interval) : intradayCandleTime(point.time, interval);
		if (before !== undefined && time >= before) continue;
		const existing = groups.get(time);
		groups.set(time, existing ? { time, open: existing.open, high: Math.max(existing.high, point.high),
			low: Math.min(existing.low, point.low), close: point.close, volume: existing.volume + point.volume } : { ...point, time });
	}
	return [...groups.values()];
}

export interface CandlePage {
	points: OhlcvPoint[];
	cumulativeVolume: number | null;
}

export interface CandleWindow extends CandlePage {
	hasMore: boolean;
	nextCursor: number | null;
	snapshotDate: string;
}

// The provider is injected in tests so pagination can be verified without KIS/DB access.
export async function loadCandleWindow(
	interval: CandleInterval, limit: number, before: number | undefined,
	fetchPage: (end: number) => Promise<CandlePage>, now = Date.now() / 1000,
): Promise<CandleWindow> {
	const calendar = isCalendarInterval(interval);
	let end = before === undefined ? now : before - 1;
	const raw = new Map<number, OhlcvPoint>();
	let points: OhlcvPoint[] = [];
	let cumulativeVolume: number | null = null;
	let hasMore = false;
	let snapshotDate = seoulDateKey(now);
	for (let pageIndex = 0; pageIndex < (calendar ? 6 : 16); pageIndex++) {
		const page = await fetchPage(end);
		if (pageIndex === 0) cumulativeVolume = page.cumulativeVolume;
		const pagePoints = page.points.filter((point) => Number.isFinite(point.time) && point.time <= end &&
			point.open > 0 && point.high > 0 && point.low > 0 && point.close > 0);
		if (!pagePoints.length) { hasMore = false; break; }
		const oldest = Math.min(...pagePoints.map((point) => point.time));
		const newest = Math.max(...pagePoints.map((point) => point.time));
		if (pageIndex === 0 && !calendar) snapshotDate = seoulDateKey(newest);
		for (const point of pagePoints) if (!raw.has(point.time)) raw.set(point.time, point);
		points = aggregateWindow([...raw.values()], interval, before);
		const sessionStart = calendarCandleTime(oldest, "1d") + 9 * 3600;
		// Do not expose an hour/four-hour candle whose opening minutes have not loaded.
		if (!calendar && points[0] && oldest > Math.max(points[0].time, sessionStart)) points = points.slice(1);
		hasMore = calendar ? pagePoints.length >= 100 : oldest > sessionStart;
		if (points.length >= limit || !hasMore) break;
		const nextEnd = calendar ? calendarCandleTime(oldest, interval) - 1 : oldest - 1;
		if (nextEnd >= end) { hasMore = false; break; }
		end = nextEnd;
	}
	const selected = points.slice(-limit);
	return { points: selected, cumulativeVolume, snapshotDate,
		hasMore: selected.length > 0 && (points.length > limit || hasMore),
		nextCursor: selected[0]?.time ?? null };
}
