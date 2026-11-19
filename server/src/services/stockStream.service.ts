import type { Server } from "http";
import axios from "axios";
import WebSocket, { WebSocketServer } from "ws";
import { getKisConfig } from "../utils/requests";
import { parseDomesticTrades } from "../utils/kisRealtime";
import { networkPeerAllowed } from "../utils/networkAccess";

type StreamStatus = "connecting" | "connected" | "reconnecting" | "unavailable";

// One upstream connection, shared subscriptions, and independent browser clients.
export function attachStockStream(server: Server) {
	const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
	const clients = new Map<string, Set<WebSocket>>();
	const subscribed = new Set<string>();
	let upstream: WebSocket | undefined;
	let approval: { key: string; expiresAt: number } | undefined;
	let connecting = false;
	let retry: ReturnType<typeof setTimeout> | undefined;
	let retries = 0;
	let subscriptionTimer: ReturnType<typeof setTimeout> | undefined;
	let lastMessageAt = 0;
	let status: StreamStatus = "connecting";
	let stopped = false;

	const send = (client: WebSocket, payload: unknown) => {
		if (client.readyState !== WebSocket.OPEN) return;
		if (client.bufferedAmount > 1024 * 1024) { client.terminate(); return; }
		client.send(JSON.stringify(payload));
	};
	const broadcastStatus = (next: StreamStatus, message?: string) => {
		status = next;
		for (const group of clients.values()) for (const client of group) {
			send(client, { type: "status", status: next, message });
		}
	};
	const scheduleRetry = () => {
		if (stopped || !clients.size || retry) return;
		broadcastStatus("reconnecting");
		retry = setTimeout(() => { retry = undefined; void connect(); }, Math.min(1000 * 2 ** retries++, 30_000));
	};
	const syncSubscriptions = () => {
		if (subscriptionTimer || upstream?.readyState !== WebSocket.OPEN) return;
		const symbol = [...subscribed].find((item) => !clients.has(item)) ??
			[...clients.keys()].find((item) => !subscribed.has(item));
		if (!symbol || !approval) return;
		const subscribe = clients.has(symbol);
		upstream.send(JSON.stringify({
			header: { approval_key: approval.key, custtype: "P", tr_type: subscribe ? "1" : "2", "content-type": "utf-8" },
			body: { input: { tr_id: "H0STCNT0", tr_key: symbol } },
		}));
		if (subscribe) subscribed.add(symbol); else subscribed.delete(symbol);
		subscriptionTimer = setTimeout(() => { subscriptionTimer = undefined; syncSubscriptions(); }, 250);
	};
	const connect = async () => {
		if (connecting || stopped || !clients.size || upstream || retry) return;
		connecting = true;
		try {
			const { appKey, appSecret, baseUrl, env } = getKisConfig();
			if ((process.env.STOTRA_KIS_MARKET_DIV_CODE || "J") !== "J") {
				throw new Error("실시간 차트는 KRX 시세 설정(J)이 필요합니다.");
			}
			if (!approval || approval.expiresAt < Date.now()) {
				const response = await axios.post(`${baseUrl}/oauth2/Approval`, {
					grant_type: "client_credentials", appkey: appKey, secretkey: appSecret,
				}, { timeout: 10_000 });
				if (!response.data.approval_key) throw new Error("실시간 접속키 발급에 실패했습니다.");
				approval = { key: response.data.approval_key, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
			}
			if (stopped || !clients.size) return;
			const socket = new WebSocket(process.env.STOTRA_KIS_WS_URL || (env === "demo" ? "ws://ops.koreainvestment.com:31000" : "ws://ops.koreainvestment.com:21000"), {
				handshakeTimeout: 10_000, maxPayload: 1024 * 1024,
			});
			upstream = socket;
			socket.on("open", () => {
				lastMessageAt = Date.now();
				subscribed.clear();
				syncSubscriptions();
			});
			socket.on("message", (raw) => {
				lastMessageAt = Date.now();
				const message = raw.toString();
				if (message.startsWith("{")) {
					try {
						const response = JSON.parse(message);
						if (response.header?.tr_id === "PINGPONG") { socket.send(message); return; }
						if (response.body?.rt_cd === "1") {
							// Do not expose provider credentials or raw error responses to browsers/logs.
							broadcastStatus("unavailable", "실시간 시세 구독을 확인해주세요.");
							approval = undefined;
							socket.terminate();
							return;
						}
						if (response.body?.rt_cd === "0") {
							retries = 0;
							const symbol = String(response.header?.tr_key || "");
							if (clients.has(symbol)) for (const client of clients.get(symbol)!) {
								send(client, { type: "status", status: "connected" });
							}
							status = "connected";
						}
					} catch { /* Ignore malformed provider control messages. */ }
					return;
				}
				for (const trade of parseDomesticTrades(message)) {
					for (const client of clients.get(trade.symbol) ?? []) send(client, trade);
				}
			});
			socket.on("error", () => socket.terminate());
			socket.on("ping", () => { lastMessageAt = Date.now(); });
			socket.on("pong", () => { lastMessageAt = Date.now(); });
			socket.on("close", () => {
				if (upstream !== socket) return;
				upstream = undefined;
				subscribed.clear();
				if (subscriptionTimer) clearTimeout(subscriptionTimer);
				subscriptionTimer = undefined;
				scheduleRetry();
			});
		} catch {
			broadcastStatus("unavailable", "실시간 시세 연결을 확인해주세요.");
			scheduleRetry();
		} finally { connecting = false; }
	};

	server.on("upgrade", (request, socket, head) => {
		if (!networkPeerAllowed(request.socket.remoteAddress)) {
			socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return;
		}
		if (request.headers.origin) {
			try {
				if (new URL(request.headers.origin).host !== request.headers.host) {
					socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return;
				}
			} catch { socket.destroy(); return; }
		}
		const match = /^\/api\/stocks\/(\d[A-Z0-9]{5})\/stream$/.exec((request.url || "").split("?")[0]);
		if (!match) { socket.destroy(); return; }
		const symbol = match[1];
		if (!clients.has(symbol) && clients.size >= 40) {
			socket.end("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n"); return;
		}
		wss.handleUpgrade(request, socket, head, (client) => {
			if (!clients.has(symbol)) clients.set(symbol, new Set());
			clients.get(symbol)!.add(client);
			send(client, { type: "status", status: subscribed.has(symbol) ? status : "connecting" });
			client.on("error", () => client.terminate());
			client.on("pong", () => alive.add(client));
			client.on("close", () => {
				alive.delete(client);
				const group = clients.get(symbol);
				group?.delete(client);
				if (group?.size === 0) clients.delete(symbol);
				if (clients.size) { syncSubscriptions(); return; }
				if (retry) clearTimeout(retry);
				retry = undefined;
				if (subscriptionTimer) clearTimeout(subscriptionTimer);
				subscriptionTimer = undefined;
				const idleSocket = upstream;
				upstream = undefined;
				subscribed.clear();
				idleSocket?.terminate();
			});
			alive.add(client);
			if (upstream?.readyState === WebSocket.OPEN) syncSubscriptions(); else void connect();
		});
	});
	const alive = new Set<WebSocket>();
	const heartbeat = setInterval(() => {
		for (const client of wss.clients) {
			if (!alive.delete(client)) client.terminate(); else client.ping();
		}
		if (upstream?.readyState === WebSocket.OPEN && Date.now() - lastMessageAt > 90_000) upstream.terminate();
	}, 30_000);
	heartbeat.unref();
	server.on("close", () => {
		stopped = true;
		clearInterval(heartbeat);
		if (retry) clearTimeout(retry);
		if (subscriptionTimer) clearTimeout(subscriptionTimer);
		upstream?.terminate();
		for (const client of wss.clients) client.terminate();
		wss.close();
	});
	return wss;
}
