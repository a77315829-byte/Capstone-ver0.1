import { Request, Response } from "express";
import { fetchStockData } from "../utils/requests";
import { downstreamServices } from "../config/downstream";
import {
	createDownstreamClient,
	forwardDownstream,
} from "../services/downstreamProxy.service";

const marketReactionService = downstreamServices.marketReaction;
const marketReactionClient = createDownstreamClient(
	marketReactionService,
);

// KIS 시세 조회가 느려도 /simulate 전체가 지연되지 않도록 짧은 timeout 을 두고,
// 실패/timeout 시 stock_data 없이 그대로 진행한다(Python 이 stub 시세로 fallback).
const STOCK_DATA_TIMEOUT_MS = 5000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("stock data fetch timeout")), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
};

// KIS prdy_vrss_vol_rate(전일 거래량 대비 비율, %) 를 거래량 추세로 단순 구간화한다.
const volumeTrendFromRate = (rate: number | null | undefined): string | null => {
	if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
	if (rate >= 120) return "increasing";
	if (rate <= 80) return "decreasing";
	return "stable";
};

const fetchRealtimeStockData = async (code: string | undefined) => {
	if (!code) return null;

	try {
		const quote = await withTimeout(fetchStockData(code), STOCK_DATA_TIMEOUT_MS);
		// KIS 는 존재하지 않는 종목코드에도 price=0 인 응답을 줄 수 있으므로 양수인 경우만 신뢰한다.
		if (!quote || typeof quote.price !== "number" || quote.price <= 0) return null;

		return {
			current_price: quote.price,
			daily_change_rate: quote.changeRate,
			// KIS hts_avls 는 억원 단위이므로 조원으로 환산(1조 = 10000억).
			market_cap_trillion:
				typeof quote.marketCap === "number" && quote.marketCap > 0
					? quote.marketCap / 10000
					: null,
			volume_trend: volumeTrendFromRate(quote.volumeVsPrevDayRate),
			observed_at: quote.fetchedAt,
		};
	} catch (error: any) {
		console.error("marketReaction.simulate: KIS quote fetch failed, using stub", {
			code,
			message: error.message,
		});
		return null;
	}
};

const simulate = async (req: Request, res: Response) => {
	const { user_id, selected_stock, input_text, input_type_hint } = req.body;

	if (!input_text || !String(input_text).trim()) {
		return res.status(400).json({
			status: "error",
			message: "input_text가 필요합니다.",
		});
	}

	const stock_data = await fetchRealtimeStockData(selected_stock?.code);

	return forwardDownstream(res, marketReactionService, () =>
		marketReactionClient.post(
			"/simulate",
			{
				user_id: user_id || "test_user_001",
				selected_stock,
				input_text,
				input_type_hint: input_type_hint ?? null,
				stock_data,
			},
		),
	);
};

export default {
	simulate,
};
