import { Request, Response } from "express";
import axios from "axios";
import { aiMode, serviceHeaders, timeoutMs } from "../utils/runtime";
import { marketFallback } from "../services/exhibitionFallback.service";
import { fetchStockData, fetchUsStockData } from "../utils/requests";
import { normalizeSimulationStock, SimulationStock } from "../utils/marketSimulation";

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

// KIS prdy_vrss_vol_rate(전일 거래량 대비 비율, %) 를 거래량 추세로 단순 구간화한다.
const volumeTrendFromRate = (rate: number | null | undefined): string | null => {
	if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
	if (rate >= 120) return "increasing";
	if (rate <= 80) return "decreasing";
	return "stable";
};

const fetchRealtimeStockData = async (stock: SimulationStock) => {
 const code = stock.code;

	try {
		if (stock.market === "US") {
			const quote = await withTimeout(fetchUsStockData(code, stock.exchange || "NAS"), STOCK_DATA_TIMEOUT_MS);
			if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) return null;
			return { current_price: quote.price, daily_change_rate: quote.changeRate,
				market_cap_trillion: null, market_cap_usd: quote.marketCap || null,
				volume_trend: null, observed_at: quote.fetchedAt };
		}
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
		console.error("marketReaction.simulate: KIS quote unavailable", {
			code,
			error: error.name,
		});
		return null;
	}
};

let retryAfter = 0;
const simulate = async (req: Request, res: Response) => {
 const { input_text, input_type_hint } = req.body;
 const selected_stock = normalizeSimulationStock(req.body.selected_stock);
 const hints = ["real_news", "company_information", "industry_information", "hypothetical_scenario", "economic_market_event", "unknown"];
 if (typeof input_text !== "string" || !input_text.trim() || input_text.length > 10000 ||
  !selected_stock ||
  (input_type_hint != null && !hints.includes(input_type_hint))) {
  return res.status(400).json({ status: "error", message: "종목과 분석 내용을 확인해주세요. 입력은 10,000자 이하여야 합니다." });
 }
 const stock_data = await fetchRealtimeStockData(selected_stock);
 const fallback = () => res.json(marketFallback(selected_stock, input_text.trim(), input_type_hint ?? null,
  stock_data ? { price: stock_data.current_price, changeRate: stock_data.daily_change_rate, fetchedAt: stock_data.observed_at } : null));
 if (aiMode() === "rules" || Date.now() < retryAfter) return fallback();
 try {
  const response = await axios.post(MARKET_REACTION_URL + "/simulate",
   { user_id: "anonymous", selected_stock, input_text, input_type_hint: input_type_hint ?? null, stock_data },
   { timeout: timeoutMs("MARKET_SERVICE_TIMEOUT_MS", 120000), headers: serviceHeaders() });
  if (response.data?.status !== "ok" || !Array.isArray(response.data?.agent_reactions)) return fallback();
  return res.status(response.status).json(response.data);
 } catch (error: any) {
  if (error.response?.status >= 400 && error.response?.status < 500) {
   return res.status(error.response.status).json(error.response.data);
  }
  retryAfter = Date.now() + 15000;
  return fallback();
 }
};
export default { simulate };
