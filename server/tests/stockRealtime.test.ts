import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket, { WebSocketServer } from "ws";
import { domesticTimestamp, parseDomesticTrades } from "../src/utils/kisRealtime";
import { attachStockStream } from "../src/services/stockStream.service";

function record(symbol = "005930", price = "70000", volume = "1010") {
	const row = Array(47).fill("0") as string[];
	Object.assign(row, { 0: symbol, 1: "091501", 2: price, 3: "5", 4: "100", 5: "0.14", 7: "70100", 8: "70200", 9: "69900", 12: "10", 13: volume, 33: "20261109" });
	return row.join("^");
}

test("KRX timestamps use exchange date and Seoul timezone", () => {
	assert.equal(domesticTimestamp("20261109", "091501"), Date.parse("2026-11-09T00:15:01Z") / 1000);
	assert.ok(Number.isNaN(domesticTimestamp("bad", "091501")));
	assert.ok(Number.isNaN(domesticTimestamp("20261109", "251501")));
	assert.ok(Number.isNaN(domesticTimestamp("20260230", "091501")));
});

test("all records in a KIS frame are parsed, including same-price volume", () => {
	const trades = parseDomesticTrades(`0|H0STCNT0|002|${record()}^${record("000660", "100000", "1020")}`);
	assert.equal(trades.length, 2);
	assert.equal(trades[0]!.changePrice, -100);
	assert.equal(trades[1]!.symbol, "000660");
	assert.equal(trades[1]!.quantity, 10);
	assert.equal(parseDomesticTrades(`0|H0STCNT0|001|${record().split("^").slice(0, 46).join("^")}`).length, 1);
});

test("control, encrypted, truncated, and invalid price frames are ignored", () => {
	assert.deepEqual(parseDomesticTrades('{"header":{"tr_id":"PINGPONG"}}'), []);
	assert.deepEqual(parseDomesticTrades(`1|H0STCNT0|001|${record()}`), []);
	assert.deepEqual(parseDomesticTrades("0|H0STCNT0|002|005930^091501^70000"), []);
	assert.deepEqual(parseDomesticTrades(`0|H0STCNT0|001|${record("005930", "NaN")}`), []);
});

function waitFor<T>(read: () => T | undefined, timeout = 5000): Promise<T> {
	return new Promise((resolve, reject) => {
		const started = Date.now();
		const timer = setInterval(() => {
			const value = read();
			if (value !== undefined) { clearInterval(timer); resolve(value); }
			else if (Date.now() - started > timeout) { clearInterval(timer); reject(new Error("Timed out waiting for stream")); }
		}, 10);
	});
}

test("relay shares upstream, isolates symbols, handles PINGPONG, and resubscribes after disconnect", { timeout: 15000 }, async (context) => {
	const provider = createServer((_request, response) => {
		response.setHeader("Content-Type", "application/json");
		response.end(JSON.stringify({ approval_key: "test-approval-secret" }));
	});
	const providerWs = new WebSocketServer({ server: provider });
	const upstreams: WebSocket[] = [];
	const subscriptions: { socket: WebSocket; symbol: string; action: string }[] = [];
	let pong = false;
	providerWs.on("connection", (socket) => {
		upstreams.push(socket);
		socket.on("message", (raw) => {
			const message = JSON.parse(raw.toString());
			if (message.header.tr_id === "PINGPONG") { pong = true; return; }
			const symbol = message.body.input.tr_key;
			subscriptions.push({ socket, symbol, action: message.header.tr_type });
			socket.send(JSON.stringify({ header: { tr_id: "H0STCNT0", tr_key: symbol }, body: { rt_cd: "0" } }));
		});
	});
	provider.listen(0, "127.0.0.1");
	await once(provider, "listening");
	const providerPort = (provider.address() as AddressInfo).port;
	const keys = ["STOTRA_KIS_BASE_URL", "STOTRA_KIS_WS_URL", "STOTRA_KIS_APP_KEY", "STOTRA_KIS_APP_SECRET", "STOTRA_KIS_MARKET_DIV_CODE"];
	const previous = keys.map((key) => process.env[key]);
	Object.assign(process.env, { STOTRA_KIS_BASE_URL: `http://127.0.0.1:${providerPort}`, STOTRA_KIS_WS_URL: `ws://127.0.0.1:${providerPort}`, STOTRA_KIS_APP_KEY: "test", STOTRA_KIS_APP_SECRET: "test", STOTRA_KIS_MARKET_DIV_CODE: "J" });
	const relay = createServer();
	attachStockStream(relay);
	relay.listen(0, "127.0.0.1");
	await once(relay, "listening");
	const port = (relay.address() as AddressInfo).port;
	const browsers: WebSocket[] = [];
	context.after(async () => {
		for (const browser of browsers) browser.terminate();
		for (const socket of providerWs.clients) socket.terminate();
		await new Promise<void>((resolve) => relay.close(() => resolve()));
		await new Promise<void>((resolve) => providerWs.close(() => resolve()));
		await new Promise<void>((resolve) => provider.close(() => resolve()));
		keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
	});
	const open = async (symbol: string) => {
		const messages: any[] = [];
		const browser = new WebSocket(`ws://127.0.0.1:${port}/api/stocks/${symbol}/stream`, { origin: `http://127.0.0.1:${port}` });
		browser.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
		browsers.push(browser);
		await once(browser, "open");
		return { browser, messages };
	};
	const foreignOrigin = new WebSocket(`ws://127.0.0.1:${port}/api/stocks/005930/stream`, { origin: "http://other.example" });
	browsers.push(foreignOrigin);
	await assert.rejects(once(foreignOrigin, "open"), /403/);
	const samsung = await open("005930");
	const samsung2 = await open("005930");
	const hynix = await open("000660");
	await waitFor(() => subscriptions.filter((item) => item.action === "1").length === 2 ? true : undefined);
	assert.equal(upstreams.length, 1);
	upstreams[0]!.send(`0|H0STCNT0|001|${record()}`);
	await waitFor(() => samsung.messages.find((item) => item.type === "trade"));
	await waitFor(() => samsung2.messages.find((item) => item.type === "trade"));
	assert.equal(hynix.messages.some((item) => item.type === "trade"), false);
	assert.equal(JSON.stringify(samsung.messages).includes("test-approval-secret"), false);
	upstreams[0]!.send(JSON.stringify({ header: { tr_id: "PINGPONG" } }));
	await waitFor(() => pong ? true : undefined);
	upstreams[0]!.terminate();
	await waitFor(() => upstreams.length === 2 ? true : undefined);
	await waitFor(() => subscriptions.filter((item) => item.socket === upstreams[1] && item.action === "1").length === 2 ? true : undefined);
	samsung.browser.close();
	samsung2.browser.close();
	await waitFor(() => subscriptions.find((item) => item.symbol === "005930" && item.action === "2"));
	upstreams[1]!.send(`0|H0STCNT0|001|${record("000660", "100000")}`);
	await waitFor(() => hynix.messages.find((item) => item.type === "trade"));
});
