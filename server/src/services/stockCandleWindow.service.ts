import mongoose from "mongoose";
import Cache from "node-cache";
import StockChartCache from "../models/stockChartCache.model";
import { fetchDomesticPeriodCandlePage, fetchIntradayStockDataSnapshot } from "../utils/requests";
import { isCalendarInterval, loadCandleWindow, seoulDateKey } from "../utils/candleWindow";
import type { CandleInterval, CandleWindow } from "../utils/candleWindow";

const cache = new Cache({ stdTTL: 60, checkperiod: 60 });
const pending = new Map<string, Promise<CandleWindow>>();

export async function getCandleWindow(symbol: string, interval: CandleInterval, limit: number, before?: number, refresh = false): Promise<CandleWindow> {
	const period = `window-v1:${before ?? "latest"}:${limit}`;
	const key = `${symbol}:${interval}:${period}`;
	if (!refresh) {
		const saved = cache.get<CandleWindow>(key);
		if (saved) return saved;
	}
	const running = pending.get(key);
	if (running) return running;
	const task = (async () => {
		const ttlMs = before === undefined ? 60_000 : 6 * 3600_000;
		if (!refresh && mongoose.connection.readyState === 1) {
			const saved = await StockChartCache.findOne({ symbol, interval, period }).lean().catch(() => null);
			if (saved?.timestampVersion === 2 && Date.now() - saved.fetchedAt.getTime() < ttlMs && saved.snapshotDate) {
				const window: CandleWindow = { points: saved.points, cumulativeVolume: saved.cumulativeVolume ?? null,
					snapshotDate: saved.snapshotDate, hasMore: saved.hasMore ?? false, nextCursor: saved.nextCursor ?? null };
				cache.set(key, window, ttlMs / 1000);
				return window;
			}
		}
		const calendar = isCalendarInterval(interval);
		const code = ({ "1d": "D", "1wk": "W", "1mo": "M", "1y": "Y" } as const)[interval as "1d" | "1wk" | "1mo" | "1y"];
		const window = await loadCandleWindow(interval, limit, before, async (end) => {
			if (calendar) return fetchDomesticPeriodCandlePage(symbol, seoulDateKey(end), code);
			const clock = new Date((end + 32400) * 1000).toISOString().slice(11, 19).replace(/:/g, "");
			const page = await fetchIntradayStockDataSnapshot(symbol, clock > "153000" ? "153000" : clock < "090000" ? "153000" : clock);
			if (before !== undefined) page.points = page.points.filter((point) => seoulDateKey(point.time) === seoulDateKey(end));
			return page;
		});
		cache.set(key, window, ttlMs / 1000);
		if (mongoose.connection.readyState === 1) {
			await StockChartCache.findOneAndUpdate({ symbol, interval, period }, { $set: { ...window, symbol, interval, period,
				source: "KIS", timestampVersion: 2, fetchedAt: new Date() } }, { upsert: true }).catch(() => undefined);
		}
		return window;
	})().finally(() => pending.delete(key));
	pending.set(key, task);
	return task;
}
