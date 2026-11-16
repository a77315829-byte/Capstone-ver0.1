import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateWindow, calendarCandleTime, loadCandleWindow } from "../src/utils/candleWindow";
import type { OhlcvPoint } from "../src/utils/requests";

const end = Date.parse("2026-11-09T12:00:00+09:00") / 1000;
const midnight = calendarCandleTime(end, "1d");
const point = (time: number, close = 100): OhlcvPoint => ({ time, open: close - 2, high: close + 3, low: close - 4, close, volume: 10 });
const days = Array.from({ length: 350 }, (_, i) => point(midnight - (349 - i) * 86400));

test("initial daily window fetches one recent page instead of all history", async () => {
	let calls = 0;
	const window = await loadCandleWindow("1d", 100, undefined, async (anchor) => {
		calls++;
		return { points: days.filter((item) => item.time <= anchor).slice(-100), cumulativeVolume: 1000 };
	}, end);
	assert.equal(calls, 1);
	assert.equal(window.points.length, 100);
	assert.equal(window.points[99]!.time, midnight);
	assert.equal(window.hasMore, true);
	assert.equal(window.nextCursor, window.points[0]!.time);
});

test("exclusive cursor loads 120 older candles without overlapping the current window", async () => {
	const before = days[250]!.time;
	const window = await loadCandleWindow("1d", 120, before, async (anchor) => ({
		points: days.filter((item) => item.time <= anchor).slice(-100), cumulativeVolume: null,
	}), end);
	assert.equal(window.points.length, 120);
	assert.equal(window.points[119]!.time, before - 86400);
	assert.ok(window.points.every((item) => item.time < before));
	assert.equal(new Set(window.points.map((item) => item.time)).size, 120);
});

test("weekly/monthly/yearly bars use calendar boundaries while snapshot date remains the trading date", async () => {
	const friday = Date.parse("2026-11-13T00:00:00+09:00") / 1000;
	const window = await loadCandleWindow("1wk", 100, undefined, async () => ({ points: [point(midnight)], cumulativeVolume: 100 }), friday + 36000);
	assert.equal(window.points[0]!.time, midnight);
	assert.equal(window.snapshotDate, "20261113");
	assert.equal(window.hasMore, false);
	assert.equal(calendarCandleTime(friday, "1mo"), Date.parse("2026-11-01T00:00:00+09:00") / 1000);
	assert.equal(calendarCandleTime(friday, "1y"), Date.parse("2026-01-01T00:00:00+09:00") / 1000);
});

test("minute pagination aggregates complete five-minute OHLCV bars", async () => {
	const minutes = Array.from({ length: 120 }, (_, i) => point(midnight + 9 * 3600 + i * 60, i + 100));
	const window = await loadCandleWindow("5m", 12, undefined, async (anchor) => ({
		points: minutes.filter((item) => item.time <= anchor).slice(-30), cumulativeVolume: 1200,
	}), midnight + 11 * 3600 - 1);
	assert.equal(window.points.length, 12);
	assert.equal(window.points[0]!.time, midnight + 10 * 3600);
	assert.equal(window.points[0]!.volume, 50);
	assert.equal(window.points[0]!.open, 158);
	assert.equal(window.points[0]!.close, 164);
});

test("incomplete opening bucket fetches its missing minutes before being returned", async () => {
	const minutes = Array.from({ length: 120 }, (_, i) => point(midnight + 9 * 3600 + i * 60));
	let calls = 0;
	const window = await loadCandleWindow("4h", 100, undefined, async (anchor) => {
		calls++;
		return { points: minutes.filter((item) => item.time <= anchor).slice(-30), cumulativeVolume: 1200 };
	}, midnight + 11 * 3600 - 1);
	assert.equal(calls, 4);
	assert.equal(window.points.length, 1);
	assert.equal(window.points[0]!.volume, 1200);
	assert.equal(window.hasMore, false);
});

test("empty history terminates pagination and cursor never moves forward", async () => {
	const window = await loadCandleWindow("1d", 100, undefined, async () => ({ points: [], cumulativeVolume: null }), end);
	assert.deepEqual(window.points, []);
	assert.equal(window.nextCursor, null);
	assert.equal(window.hasMore, false);
	assert.equal(aggregateWindow([point(midnight)], "1d", midnight).length, 0);
});
