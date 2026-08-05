import { Request, Response } from "express";
import axios from "axios";
import { fetchStockData } from "../utils/requests";

// Python market-reaction FastAPI 서비스 주소. 기본값은 로컬 8002 포트.
const MARKET_REACTION_URL =
	process.env.MARKET_REACTION_URL || "http://127.0.0.1:8002";

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

const fetchRealtimeStockData = async (code: string | undefined) => {
	if (!code) return null;

	try {
		const quote = await withTimeout(fetchStockData(code), STOCK_DATA_TIMEOUT_MS);
		// KIS 는 존재하지 않는 종목코드에도 price=0 인 응답을 줄 수 있으므로 양수인 경우만 신뢰한다.
		if (!quote || typeof quote.price !== "number" || quote.price <= 0) return null;

		return {
			current_price: quote.price,
			daily_change_rate: quote.changeRate,
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

	try {
		const stock_data = await fetchRealtimeStockData(selected_stock?.code);

		// Python 응답을 그대로 전달하기 위해 모든 상태코드를 허용한다.
		// (422 rejected, fallback 200 등 Python 이 정한 상태코드를 보존)
		const pythonRes = await axios.post(
			`${MARKET_REACTION_URL}/simulate`,
			{
				user_id: user_id || "test_user_001",
				selected_stock,
				input_text,
				input_type_hint: input_type_hint ?? null,
				stock_data,
			},
			{
				timeout: 120000,
				validateStatus: () => true,
			},
		);

		return res.status(pythonRes.status).json(pythonRes.data);
	} catch (error: any) {
		// validateStatus 로 HTTP 에러는 위에서 통과되므로, 여기 도달하면 연결/타임아웃 등 네트워크 오류.
		console.error("marketReaction.simulate error:", {
			message: error.message,
			code: error.code,
		});

		return res.status(503).json({
			status: "error",
			message:
				"시장 반응 분석 서비스(Python)에 연결하지 못했습니다. 서비스 실행 상태를 확인하세요.",
			error: error.message,
		});
	}
};

export default {
	simulate,
};
