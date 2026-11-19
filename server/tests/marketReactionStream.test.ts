import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import { streamMarketReaction } from "../src/services/marketReactionStream.service";

const body = { selected_stock: { code: "005930", name: "삼성전자" }, input_text: "실적 개선 소식" };
const event = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => { resolve = done; });
	return { promise, resolve };
}

async function fixture(
	handler: (req: IncomingMessage, res: ServerResponse) => void,
	deadlineMs = 3000,
) {
	const upstream = createServer(handler).listen(0, "127.0.0.1");
	await once(upstream, "listening");
	const app = express();
	app.use(express.json());
	app.post("/simulate/stream", (req, res) => streamMarketReaction(req, res, {
		url: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/simulate/stream`,
		loadStockData: async () => null,
		deadlineMs,
	}));
	const proxy = app.listen(0, "127.0.0.1");
	await once(proxy, "listening");
	return {
		url: `http://127.0.0.1:${(proxy.address() as AddressInfo).port}/simulate/stream`,
		close: async () => {
			proxy.closeAllConnections();
			upstream.closeAllConnections();
			await Promise.all([proxy, upstream].map(server => new Promise<void>(resolve => server.close(() => resolve()))));
		},
	};
}

const post = (url: string, input: unknown = body) => fetch(url, {
	method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
});

test("SSE proxy delivers partial Korean results before final completion", { timeout: 5000 }, async () => {
	const finish = deferred();
	const fx = await fixture((_req, res) => {
		res.setHeader("Content-Type", "text/event-stream");
		res.write(event("agent", { agent: { agent_name_ko: "개인 투자자", comment: "수요 증가" } }));
		void finish.promise.then(() => res.end(event("result", { status: "ok", overall_explanation: "분석 완료" })));
	});
	try {
		const response = await post(fx.url);
		assert.match(response.headers.get("content-type")!, /text\/event-stream/);
		assert.equal(response.headers.get("x-accel-buffering"), "no");
		const reader = response.body!.getReader();
		const decoder = new TextDecoder();
		let received = "";
		while (!received.includes("수요 증가")) {
			const chunk = await reader.read();
			assert.equal(chunk.done, false);
			received += decoder.decode(chunk.value, { stream: true });
		}
		assert.match(received, /"stage":"quote"/);
		assert.doesNotMatch(received, /event: result/);
		finish.resolve();
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			received += decoder.decode(chunk.value, { stream: true });
		}
		assert.match(received, /event: result/);
		assert.match(received, /분석 완료/);
	} finally { finish.resolve(); await fx.close(); }
});

test("client disconnect cancels the upstream stream", { timeout: 5000 }, async () => {
	const connected = deferred();
	const disconnected = deferred();
	const fx = await fixture((_req, res) => {
		res.setHeader("Content-Type", "text/event-stream");
		res.write(event("progress", { stage: "agents" }));
		res.on("close", disconnected.resolve);
		connected.resolve();
	});
	try {
		const controller = new AbortController();
		const response = await fetch(fx.url, {
			method: "POST", headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body), signal: controller.signal,
		});
		await connected.promise;
		controller.abort();
		await response.body?.cancel().catch(() => undefined);
		await disconnected.promise;
	} finally { await fx.close(); }
});

test("overall deadline emits an error and closes the stalled backend", { timeout: 5000 }, async () => {
	const disconnected = deferred();
	const fx = await fixture((_req, res) => {
		res.setHeader("Content-Type", "text/event-stream");
		res.write(": keep-alive\n\n");
		res.on("close", disconnected.resolve);
	}, 150);
	try {
		const response = await post(fx.url);
		const text = await response.text();
		assert.match(text, /event: error/);
		assert.match(text, /분석 시간이 초과/);
		await disconnected.promise;
	} finally { await fx.close(); }
});

test("upstream HTTP errors become readable terminal SSE errors", { timeout: 5000 }, async () => {
	const fx = await fixture((_req, res) => {
		res.writeHead(422, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ detail: "internal schema details" }));
	});
	try {
		const text = await (await post(fx.url)).text();
		assert.match(text, /event: error/);
		assert.match(text, /분석 입력을 확인/);
		assert.doesNotMatch(text, /internal schema details/);
	} finally { await fx.close(); }
});

test("empty input rejects without starting backend analysis", { timeout: 5000 }, async () => {
	let requests = 0;
	const fx = await fixture((_req, res) => { requests += 1; res.end(); });
	try {
		const response = await post(fx.url, { input_text: " " });
		assert.equal(response.status, 400);
		assert.equal(requests, 0);
	} finally { await fx.close(); }
});
