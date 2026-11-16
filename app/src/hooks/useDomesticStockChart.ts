import { useEffect, useRef, useState } from "react";
import api from "../services/api.service";
import { applyTrade, INITIAL_CANDLE_COUNT, mergeChartHistory, OLDER_CANDLE_COUNT, snapshotBook } from "../utils/domesticChart";
import type { ChartInterval, ChartPoint, DomesticTrade } from "../utils/domesticChart";

type StreamStatus = "connecting" | "connected" | "reconnecting" | "unavailable";
type Snapshot = { data: ChartPoint[]; cumulativeVolume?: number | null; snapshotDate?: string; hasMore: boolean; nextCursor: number | null };

export function useDomesticStockChart(symbol: string, period: string, interval: ChartInterval) {
	const chartKey = `${symbol}:${period}:${interval}`;
	const [chart, setChart] = useState<{ key: string; points: ChartPoint[] }>({ key: chartKey, points: [] });
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingOlder, setIsLoadingOlder] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [historyError, setHistoryError] = useState<string | null>(null);
	const [status, setStatus] = useState<StreamStatus>("connecting");
	const [error, setError] = useState<string | null>(null);
	const [lastTrade, setLastTrade] = useState<DomesticTrade | null>(null);
	const refreshRef = useRef<() => void>(() => undefined);
	const olderRef = useRef<() => void>(() => undefined);

	useEffect(() => {
		let disposed = false;
		let socket: WebSocket | undefined;
		let retry: ReturnType<typeof setTimeout> | undefined;
		let flushTimer: ReturnType<typeof setTimeout> | undefined;
		let retries = 0;
		let hasConnected = false;
		let upstreamConnected = false;
		let generation = 0;
		let loadingSnapshot = true;
		let loadingOlder = false;
		let cursor: number | null = null;
		let hasOlder = false;
		let buffer: DomesticTrade[] = [];
		let book = snapshotBook([], null);
		let newestTrade: DomesticTrade | null = null;
		const abort = new AbortController();
		const setPoints = (points: ChartPoint[]) => setChart({ key: `${symbol}:${period}:${interval}`, points });
		setPoints([]); setLastTrade(null); setIsLoading(true); setIsLoadingOlder(false);
		setHasMore(false); setHistoryError(null); setStatus("connecting"); setError(null);

		const flush = () => {
			flushTimer = undefined;
			if (disposed || loadingSnapshot) return;
			for (const trade of buffer) {
				const next = applyTrade(book, trade, interval);
				if (next !== book) { book = next; newestTrade = trade; }
			}
			buffer = [];
			setPoints(book.points); setLastTrade(newestTrade);
		};
		const loadSnapshot = async () => {
			const version = ++generation;
			loadingSnapshot = true;
			loadingOlder = false; setIsLoadingOlder(false);
			try {
				const response = await api.get<Snapshot>(`/stocks/${encodeURIComponent(symbol)}/candles`, {
					params: { interval, limit: INITIAL_CANDLE_COUNT, refresh: hasConnected }, signal: abort.signal,
				});
				if (disposed || version !== generation) return;
				const data = response.data;
				const volume = data.cumulativeVolume ?? (interval === "1d" ? data.data[data.data.length - 1]?.volume ?? null : null);
				const history = book.points;
				const keepOlderCursor = history[0] && data.data[0] && history[0].time < data.data[0].time;
				const snapshotDate = data.snapshotDate?.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
				book = snapshotBook(data.data, volume, snapshotDate);
				book.points = mergeChartHistory(history, book.points);
				if (!keepOlderCursor) { cursor = data.nextCursor; hasOlder = data.hasMore; }
				setHasMore(hasOlder); setError(null);
				loadingSnapshot = false; flush(); setIsLoading(false);
			} catch {
				if (disposed || version !== generation) return;
				setError("차트 데이터를 불러오지 못했습니다. 다시 시도해주세요.");
				loadingSnapshot = false; flush(); setIsLoading(false);
			}
		};
		const loadOlder = async () => {
			if (disposed || loadingSnapshot || loadingOlder || !hasOlder || cursor === null) return;
			const version = generation;
			const before = cursor;
			loadingOlder = true; setIsLoadingOlder(true); setHistoryError(null);
			try {
				const response = await api.get<Snapshot>(`/stocks/${encodeURIComponent(symbol)}/candles`, {
					params: { interval, limit: OLDER_CANDLE_COUNT, before }, signal: abort.signal,
				});
				if (disposed || version !== generation) return;
				const data = response.data;
				book.points = mergeChartHistory(data.data.filter((point) => point.time < before), book.points);
				cursor = data.nextCursor;
				hasOlder = data.hasMore && cursor !== null && cursor < before;
				setHasMore(hasOlder); setPoints(book.points);
			} catch {
				if (!disposed && version === generation) setHistoryError("과거 차트를 불러오지 못했습니다.");
			} finally {
				if (!disposed && version === generation) { loadingOlder = false; setIsLoadingOlder(false); }
			}
		};
		refreshRef.current = () => { void loadSnapshot(); };
		olderRef.current = () => { void loadOlder(); };
		void loadSnapshot();

		const connect = () => {
			if (disposed) return;
			setStatus(hasConnected ? "reconnecting" : "connecting");
			const url = new URL(`/api/stocks/${encodeURIComponent(symbol)}/stream`, window.location.href);
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			socket = new WebSocket(url);
			socket.onmessage = (event) => {
				if (disposed) return;
				try {
					const message = JSON.parse(String(event.data));
					if (message.type === "status") {
						setStatus(message.status);
						if (message.status === "connected") {
							if (hasConnected && !upstreamConnected) void loadSnapshot();
							hasConnected = true; upstreamConnected = true; retries = 0;
						} else upstreamConnected = false;
						return;
					}
					if (message.type !== "trade" || message.symbol !== symbol) return;
					buffer.push(message as DomesticTrade);
					if (buffer.length > 20_000) buffer.shift();
					if (!loadingSnapshot && !flushTimer) flushTimer = setTimeout(flush, 100);
				} catch { /* Ignore invalid stream frames. */ }
			};
			socket.onerror = () => socket?.close();
			socket.onclose = () => {
				if (disposed) return;
				upstreamConnected = false; setStatus("reconnecting");
				retry = setTimeout(connect, Math.min(1000 * 2 ** retries++, 30_000));
			};
		};
		connect();
		return () => {
			disposed = true; abort.abort();
			if (retry) clearTimeout(retry);
			if (flushTimer) clearTimeout(flushTimer);
			if (socket) { socket.onclose = null; socket.close(); }
		};
	}, [symbol, period, interval]);

	const current = chart.key === chartKey;
	return { points: current ? chart.points : [], isLoading: !current || isLoading, status,
		error: current ? error : null, lastTrade: lastTrade?.symbol === symbol ? lastTrade : null,
		isLoadingOlder: current && isLoadingOlder, hasMore: current && hasMore,
		historyError: current ? historyError : null,
		loadOlder: () => olderRef.current(), refresh: () => refreshRef.current() };
}
