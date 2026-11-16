import assert from "node:assert/strict";
import { test } from "node:test";
import { applyTrade, candleTime, formatCandleLabel, mergeChartHistory, preserveVisibleRange, snapshotBook } from "../src/utils/domesticChart.ts";
import type { DomesticTrade } from "../src/utils/domesticChart.ts";

const time = Date.parse("2026-11-09T09:15:00+09:00") / 1000;
const candle = { time, open: 100, high: 105, low: 95, close: 101, volume: 100 };
const trade = (changes: Partial<DomesticTrade> = {}): DomesticTrade => ({
	type: "trade", symbol: "005930", time: time + 10, price: 103, quantity: 5,
	cumulativeVolume: 1005, changePrice: 3, changeRate: 3, open: 98, high: 110, low: 90, ...changes,
});

test("same-minute ticks preserve OHLC and add volume even when price stays unchanged", () => {
	let book = snapshotBook([candle], 1000);
	book = applyTrade(book, trade(), "1m");
	book = applyTrade(book, trade({ time: time + 11, cumulativeVolume: 1010 }), "1m");
	assert.deepEqual(book.points[0], { ...candle, close: 103, volume: 110 });
});

test("snapshot watermark prevents double-counting buffered or duplicate trades", () => {
	const book = snapshotBook([candle], 1005);
	assert.equal(applyTrade(book, trade(), "1m"), book);
	assert.equal(applyTrade(book, trade({ cumulativeVolume: 1001 }), "1m"), book);
});

test("new minute creates a candle and delayed earlier ticks are ignored", () => {
	const book = applyTrade(snapshotBook([candle], 1000), trade({ time: time + 61, price: 108 }), "1m");
	assert.equal(book.points.length, 2);
	assert.deepEqual(book.points[1], { time: time + 60, open: 108, high: 108, low: 108, close: 108, volume: 5 });
	assert.equal(applyTrade(book, trade({ time: time + 20, cumulativeVolume: 1015 }), "1m"), book);
});

test("daily candles use exchange OHLC and cumulative volume", () => {
	const book = applyTrade(snapshotBook([], null), trade(), "1d");
	assert.deepEqual(book.points[0], { time: Date.parse("2026-11-09T00:00:00+09:00") / 1000, open: 98, high: 110, low: 90, close: 103, volume: 1005 });
});

test("new exchange day resets cumulative volume and rejects old-date ticks", () => {
	let book = applyTrade(snapshotBook([candle], 1000), trade(), "1m");
	book = applyTrade(book, trade({ time: time + 86400, cumulativeVolume: 5 }), "1m");
	assert.equal(book.points.length, 2);
	assert.equal(book.points[1]!.volume, 5);
	assert.equal(applyTrade(book, trade({ cumulativeVolume: 2000 }), "1m"), book);
});

test("four-hour and daily buckets align to Seoul, independently of host timezone", () => {
	assert.equal(candleTime(time, "4h"), Date.parse("2026-11-09T08:00:00+09:00") / 1000);
	assert.equal(candleTime(time, "1d"), Date.parse("2026-11-09T00:00:00+09:00") / 1000);
});

test("backfill corrects partial older candles and preserves live last candle", () => {
	const old = { ...candle, time: time - 60, volume: 20 };
	const full = [{ ...old, volume: 200 }, candle];
	const live = [old, { ...candle, close: 110, volume: 150 }];
	const merged = mergeChartHistory(full, live);
	assert.equal(merged[0]!.volume, 200);
	assert.equal(merged[1]!.close, 110);
	assert.equal(merged[1]!.volume, 150);
});

test("prepending older history preserves the user's visible candles", () => {
	const previous = [candle, { ...candle, time: time + 60 }];
	const older = [{ ...candle, time: time - 120 }, { ...candle, time: time - 60 }];
	assert.deepEqual(preserveVisibleRange(previous, [...older, ...previous], { from: -1, to: 1 }), { from: 1, to: 3 });
	assert.deepEqual(preserveVisibleRange(previous, previous, { from: 0, to: 1 }), { from: 0, to: 1 });
});

test("weekly live volume uses the trading day watermark and accumulates the next day", () => {
	const wednesday = time + 2 * 86400;
	const weekly = { ...candle, time: candleTime(time, "1wk"), volume: 10000 };
	let book = snapshotBook([weekly], 1000, "2026-11-11");
	book = applyTrade(book, trade({ time: wednesday, cumulativeVolume: 1005 }), "1wk");
	assert.equal(book.points.length, 1);
	assert.equal(book.points[0]!.volume, 10005);
	assert.equal(book.points[0]!.open, candle.open);
	book = applyTrade(book, trade({ time: wednesday + 86400, cumulativeVolume: 40 }), "1wk");
	assert.equal(book.points[0]!.volume, 10045);
});

test("calendar labels and period buckets are formatted in Seoul rather than UTC", () => {
	assert.equal(formatCandleLabel(candleTime(time, "1d"), "1d"), "2026-11-09");
	assert.equal(formatCandleLabel(candleTime(time, "1mo"), "1mo"), "2026-11");
	assert.equal(candleTime(time + 2 * 86400, "1wk"), candleTime(time, "1d"));
	assert.equal(candleTime(time, "1y"), Date.parse("2026-01-01T00:00:00+09:00") / 1000);
});
