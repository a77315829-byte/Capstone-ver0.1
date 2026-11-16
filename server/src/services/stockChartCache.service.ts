import StockChartCache, {
	ChartPoint,
} from "../models/stockChartCache.model";

import {
	fetchHistoricalStockData,
	normalizeStockSymbol,
	ChartPeriod,
	ChartInterval,
	OhlcvPoint,
} from "../utils/requests";

const chartPeriods: ChartPeriod[] = ["1d", "5d", "1m", "6m", "YTD", "1y", "all"];

const chartIntervals: ChartInterval[] = [
	"1m",
	"5m",
	"15m",
	"1h",
	"4h",
	"1d",
];

export const normalizeChartPeriod = (period?: string): ChartPeriod => {
	if (period && chartPeriods.includes(period as ChartPeriod)) {
		return period as ChartPeriod;
	}

	return "1d";
};

export const normalizeChartInterval = (
	interval?: string,
	period: ChartPeriod = "1d",
): ChartInterval => {
	if (interval && chartIntervals.includes(interval as ChartInterval)) {
		return interval as ChartInterval;
	}

	if (period === "1d") {
		return "1m";
	}

	return "1d";
};

const getChartTtlMs = (
	period: ChartPeriod,
	interval: ChartInterval,
): number => {
	// 장중 단기 차트는 짧게 캐싱
	if (period === "1d" && interval === "1m") {
		return 60 * 1000; // 1분
	}

	if (period === "1d") {
		return 2 * 60 * 1000; // 2분
	}

	if (period === "5d") {
		return 10 * 60 * 1000; // 10분
	}

	if (period === "1m") {
		return 60 * 60 * 1000; // 1시간
	}

	if (period === "6m" || period === "YTD" || period === "1y") {
		return 6 * 60 * 60 * 1000; // 6시간
	}

	return 24 * 60 * 60 * 1000; // 1일
};

const isFresh = (fetchedAt: Date, ttlMs: number): boolean => {
	return Date.now() - fetchedAt.getTime() < ttlMs;
};

const normalizePoints = (points: OhlcvPoint[] | ChartPoint[]): ChartPoint[] => {
	return points
		.map((point: any) => ({
			time: Number(point.time),
			open: Number(point.open),
			high: Number(point.high),
			low: Number(point.low),
			close: Number(point.close),
			volume: Number(point.volume ?? 0),
		}))
		.filter(
			(point) =>
				Number.isFinite(point.time) &&
				Number.isFinite(point.open) &&
				Number.isFinite(point.high) &&
				Number.isFinite(point.low) &&
				Number.isFinite(point.close) &&
				point.close > 0,
		)
		.sort((a, b) => a.time - b.time);
};

export const getChartDataWithCache = async (
	symbol: string,
	periodInput?: string,
	intervalInput?: string,
	refresh = false,
) => {
	const normalizedSymbol = normalizeStockSymbol(symbol);
	const period = normalizeChartPeriod(periodInput);
	const interval = normalizeChartInterval(intervalInput, period);
	const ttlMs = getChartTtlMs(period, interval);

	const cached = await StockChartCache.findOne({
		symbol: normalizedSymbol,
		period,
		interval,
	}).lean();

	if (!refresh && cached?.timestampVersion === 2 && cached.fetchedAt && isFresh(cached.fetchedAt, ttlMs)) {
		return {
			symbol: normalizedSymbol,
			period,
			interval,
			source: "cache",
			fetchedAt: cached.fetchedAt,
			points: cached.points,
		};
	}

	const kisPoints = await fetchHistoricalStockData(
		normalizedSymbol,
		period,
		interval,
		refresh,
	);

	const points = normalizePoints(kisPoints);

	const now = new Date();

	const saved = await StockChartCache.findOneAndUpdate(
		{
			symbol: normalizedSymbol,
			period,
			interval,
		},
		{
			$set: {
				symbol: normalizedSymbol,
				period,
				interval,
				points,
				source: "KIS",
				timestampVersion: 2,
				fetchedAt: now,
			},
		},
		{
			upsert: true,
			new: true,
			setDefaultsOnInsert: true,
		},
	).lean();

	return {
		symbol: normalizedSymbol,
		period,
		interval,
		source: "kis",
		fetchedAt: saved?.fetchedAt ?? now,
		points,
	};
};
