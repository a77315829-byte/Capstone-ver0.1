// Local-only visual check: synthetic quotes, no database or real KIS credentials.
const { createServer } = require("node:http");
const path = require("node:path");
const { WebSocketServer } = require("ws");
const { attachStockStream } = require("../src/services/stockStream.service");
const { calendarCandleTime, seoulDateKey } = require("../src/utils/candleWindow");

Object.assign(process.env, {
	STOTRA_KIS_BASE_URL: "http://127.0.0.1:25311", STOTRA_KIS_WS_URL: "ws://127.0.0.1:25311",
	STOTRA_KIS_APP_KEY: "preview", STOTRA_KIS_APP_SECRET: "preview", STOTRA_KIS_MARKET_DIV_CODE: "J",
});
let sequence = 0;
const epoch = Date.parse("2026-11-09T09:30:00+09:00") / 1000;
const price = () => 70000 + (sequence % 30) * 100;
const provider = createServer((_req, res) => {
	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify({ approval_key: "preview-only" }));
});
const sockets = new WebSocketServer({ server: provider });
sockets.on("connection", (socket) => {
	const symbols = new Set();
	socket.on("message", (raw) => {
		const message = JSON.parse(raw.toString());
		if (!message.body?.input) return;
		const symbol = message.body.input.tr_key;
		if (message.header.tr_type === "1") symbols.add(symbol); else symbols.delete(symbol);
		socket.send(JSON.stringify({ header: { tr_key: symbol }, body: { rt_cd: "0" } }));
	});
	const timer = setInterval(() => {
		sequence++;
		for (const symbol of symbols) {
			const row = Array(47).fill("0");
			const clock = new Date((epoch + sequence + 9 * 3600) * 1000).toISOString().slice(11, 19).replace(/:/g, "");
			Object.assign(row, { 0: symbol, 1: clock, 2: String(price()), 3: "2", 4: String(price() - 70000), 5: "1.5", 7: "70000", 8: "73000", 9: "69000", 12: "5", 13: String(1000 + sequence * 5), 33: "20261109" });
			socket.send(`0|H0STCNT0|001|${row.join("^")}`);
		}
	}, 200);
	socket.on("close", () => clearInterval(timer));
});
provider.listen(25311, "127.0.0.1");

const api = createServer((req, res) => {
	const url = new URL(req.url, "http://127.0.0.1");
	let data = {};
	if (url.pathname.endsWith("/candles")) {
		const unit = url.searchParams.get("interval") || "1d";
		const limit = Number(url.searchParams.get("limit") || 100);
		const before = Number(url.searchParams.get("before") || 0);
		const calendar = ["1d", "1wk", "1mo", "1y"].includes(unit);
		const span = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400 }[unit] || 86400;
		const anchor = before ? before - 1 : epoch + sequence;
		const current = calendar ? calendarCandleTime(anchor, unit) : Math.floor((anchor + 32400) / span) * span - 32400;
		const points = Array.from({ length: limit }, (_, i) => {
			const offset = limit - 1 - i;
			const date = new Date((current + 32400) * 1000);
			if (unit === "1y") date.setUTCFullYear(date.getUTCFullYear() - offset);
			else if (unit === "1mo") date.setUTCMonth(date.getUTCMonth() - offset);
			else date.setTime(date.getTime() - offset * (unit === "1wk" ? 7 * 86400 : span) * 1000);
			const time = date.getTime() / 1000 - 32400;
			return { time, open: 70000 + (i % 5) * 100, high: 73000, low: 69000,
				close: i === limit - 1 && !before ? price() : 70500 + (i % 5) * 100,
				volume: i === limit - 1 && !before ? 1000 + sequence * 5 : 100 + i * 5 };
		}).filter((point) => point.time > Date.parse("1980-01-01T00:00:00+09:00") / 1000);
		data = { success: true, data: points, cumulativeVolume: 1000 + sequence * 5, snapshotDate: seoulDateKey(epoch),
			hasMore: points.length === limit, nextCursor: points[0]?.time ?? null };
		console.log(`Candle window: ${unit}, before=${before || "latest"}, count=${points.length}`);
	} else if (url.pathname.endsWith("/historical")) {
		const recent = url.searchParams.get("recent") === "true";
		const daily = url.searchParams.get("period") !== "1d";
		const span = daily ? 86400 : { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400 }[url.searchParams.get("interval")] || 60;
		const current = Math.floor((epoch + sequence + 32400) / span) * span - 32400;
		data = { success: true, partial: recent, cumulativeVolume: 1000 + sequence * 5,
			data: Array.from({ length: recent ? 30 : 60 }, (_, i) => ({ time: current - (recent ? 29 - i : 59 - i) * span, open: 70000 + (i % 5) * 100, high: 73000, low: 69000, close: i === (recent ? 29 : 59) ? price() : 70500 + (i % 5) * 100, volume: 100 + i * 5 })) };
	} else if (url.pathname.endsWith("/info") || url.pathname.endsWith("/detail")) {
		data = { success: true, data: { symbol: url.pathname.split("/")[3], name: "삼성전자", market: "KRX", price: price(), changeRate: 1.5, changePrice: price() - 70000, volume: 1000, open: 70000, high: 73000, low: 69000, tradable: true } };
	} else if (url.pathname.endsWith("/orderbook")) {
		data = { success: true, data: { symbol: "005930", totalAskVolume: 0, totalBidVolume: 0, levels: [] } };
	} else if (url.pathname.endsWith("/executions")) {
		data = { success: true, data: { symbol: "005930", items: [] } };
	} else if (url.pathname.endsWith("/investor-trend")) {
		data = { success: true, data: { symbol: "005930", individual: 0, foreign: 0, institution: 0, corporation: 0 } };
	} else if (url.pathname.endsWith("/status")) {
		data = { success: true, data: { isOpen: true, phase: "OPEN", localDate: "2026-11-09", localTime: "09:30:00", message: "테스트 시세" } };
	} else if (url.pathname.includes("portfolio")) {
		data = { success: true, data: { cash: 1000000, availableCash: 1000000, holdings: [], totalEvaluationAmount: 0, totalAssets: 1000000 } };
	} else data = { success: true, data: [] };
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.end(JSON.stringify(data));
});
attachStockStream(api);
api.listen(25310, "127.0.0.1");

const { createServer: createViteServer } = require("../../app/node_modules/vite");
createViteServer({
	root: path.resolve(__dirname, "../../app"), configFile: path.resolve(__dirname, "../../app/vite.config.js"),
	server: { host: "127.0.0.1", port: 25373, strictPort: true, proxy: { "/api": { target: "http://127.0.0.1:25310", ws: true } } },
}).then((vite) => vite.listen()).then(() => console.log("Synthetic chart preview: http://127.0.0.1:25373/exchange"));
