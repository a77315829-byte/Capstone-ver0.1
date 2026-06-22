import Cache from "node-cache";
import axios from "axios";
import dotenv from "dotenv";
import * as zlib from "zlib";
import { TextDecoder } from "util";
import * as fs from "fs";
import * as path from "path";

import {
	US_EXCHANGE_NAME,
	US_PRODUCT_TYPE_CODE,
	US_STOCK_CATALOG,
	UsExchangeCode,
} from "../data/usStocks";

dotenv.config();

type KisEnv = "real" | "demo";

export type ChartPeriod = "1d" | "5d" | "1m" | "6m" | "YTD" | "1y" | "all";
export type ChartInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

interface KisToken {
	access_token: string;
	expires_in?: number | string;
	access_token_token_expired?: string;
}

interface SavedKisToken {
	token: string;
	expiresAt: number;
	baseUrl: string;
	appKeyTail: string;
}

interface KisResponse<T> {
	rt_cd?: string;
	msg_cd?: string;
	msg1?: string;
	output?: T;
	output1?: any;
	output2?: any[];
}

interface StockSearchResult {
	symbol: string;
	shortname: string;
	longname: string;
	exchDisp: string;
	exchange: string;
	quoteType: string;
	assetType: string;
	tradable: boolean;
}

interface MasterStock {
	symbol: string;
	name: string;
	market: "KOSPI" | "KOSDAQ";
	assetType: string;
	tradable: boolean;
}

export interface OhlcvPoint {
	time: number; // 초 단위 UNIX timestamp
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

const stockCache = new Cache({ stdTTL: 60 });

const KIS_REAL_URL = "https://openapi.koreainvestment.com:9443";
const KIS_DEMO_URL = "https://openapivts.koreainvestment.com:29443";

const KIS_MARKET_DIV_CODE = process.env.STOTRA_KIS_MARKET_DIV_CODE || "J";
const KIS_PRODUCT_TYPE_CD = process.env.STOTRA_KIS_PRODUCT_TYPE_CD || "300";
const KIS_MASTER_CACHE_KEY = "kis-domestic-master";

const KIS_REQUEST_DELAY_MS = Number(
	process.env.STOTRA_KIS_REQUEST_DELAY_MS || 500,
);

const TOKEN_CACHE_FILE = path.join(process.cwd(), ".kis-token-cache.json");

let kisToken: { token: string; expiresAt: number } | null = null;
let kisTokenPromise: Promise<string> | null = null;
let kisRequestQueue: Promise<any> = Promise.resolve();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const enqueueKisRequest = async <T>(task: () => Promise<T>): Promise<T> => {
	const run = kisRequestQueue.then(async () => {
		await sleep(KIS_REQUEST_DELAY_MS);
		return task();
	});

	kisRequestQueue = run.catch(() => undefined);

	return run;
};

const createHttpError = (statusCode: number, message: string) => {
	const error = new Error(message) as Error & { statusCode?: number };
	error.statusCode = statusCode;
	return error;
};

const getKisConfig = () => {
	const appKey = process.env.STOTRA_KIS_APP_KEY;
	const appSecret = process.env.STOTRA_KIS_APP_SECRET;
	const env = (process.env.STOTRA_KIS_ENV || "real") as KisEnv;
	const baseUrl =
		process.env.STOTRA_KIS_BASE_URL ||
		(env === "demo" ? KIS_DEMO_URL : KIS_REAL_URL);

	if (!appKey || !appSecret) {
		throw createHttpError(
			500,
			"STOTRA_KIS_APP_KEY and STOTRA_KIS_APP_SECRET are required",
		);
	}

	return { appKey, appSecret, baseUrl, env };
};

const parseNumber = (value: any): number => {
	const parsed = parseFloat(String(value ?? "0").replace(/,/g, ""));
	return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeStockSymbol = (symbol: string): string => {
	const normalized = String(symbol || "")
		.trim()
		.toUpperCase()
		.replace(/\.(KS|KQ)$/, "");

	const domesticCode = normalized.match(/^Q?(\d{6})/);
	return domesticCode ? domesticCode[1] : normalized;
};

const isKisQuoteSupportedSymbol = (symbol: string): boolean => {
	return /^\d{6}$/.test(symbol);
};

const getKisErrorMessage = (error: any): string => {
	return (
		error?.response?.data?.msg1 ||
		error?.response?.data?.message ||
		error?.response?.data?.error_description ||
		error?.message ||
		String(error)
	);
};

const isKisRateLimitError = (error: any): boolean => {
	const data = error?.response?.data;

	return (
		data?.msg_cd === "EGW00201" ||
		data?.message === "EGW00201" ||
		String(data?.msg1 || "").includes("초당 거래건수") ||
		String(error?.message || "").includes("초당 거래건수")
	);
};

const isKisTokenLimitError = (error: any): boolean => {
	const data = error?.response?.data;

	return (
		data?.error_code === "EGW00133" ||
		String(data?.error_description || "").includes("1분당 1회") ||
		String(error?.message || "").includes("1분당 1회")
	);
};

const getAppKeyTail = (appKey: string): string => {
	return appKey.slice(-8);
};

const readTokenFromDisk = (
	baseUrl: string,
	appKey: string,
): { token: string; expiresAt: number } | null => {
	try {
		if (!fs.existsSync(TOKEN_CACHE_FILE)) {
			return null;
		}

		const raw = fs.readFileSync(TOKEN_CACHE_FILE, "utf8");
		const saved = JSON.parse(raw) as SavedKisToken;

		if (
			saved.baseUrl === baseUrl &&
			saved.appKeyTail === getAppKeyTail(appKey) &&
			saved.expiresAt > Date.now() + 60_000
		) {
			return {
				token: saved.token,
				expiresAt: saved.expiresAt,
			};
		}

		return null;
	} catch {
		return null;
	}
};

const saveTokenToDisk = (
	token: string,
	expiresAt: number,
	baseUrl: string,
	appKey: string,
) => {
	try {
		const saved: SavedKisToken = {
			token,
			expiresAt,
			baseUrl,
			appKeyTail: getAppKeyTail(appKey),
		};

		fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(saved, null, 2), "utf8");
	} catch (error) {
		console.error("KIS token disk cache save failed:", error);
	}
};

const requestNewKisAccessToken = async (
	retryOnTokenLimit = true,
): Promise<string> => {
	const { appKey, appSecret, baseUrl } = getKisConfig();

	try {
		const res = await axios.post<KisToken>(
			`${baseUrl}/oauth2/tokenP`,
			{
				grant_type: "client_credentials",
				appkey: appKey,
				appsecret: appSecret,
			},
			{
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
			},
		);

		if (!res.data.access_token) {
			throw createHttpError(502, "KIS access token was not returned");
		}

		const expiresIn = parseNumber(res.data.expires_in || 60 * 60 * 23);

		const tokenData = {
			token: res.data.access_token,
			expiresAt: Date.now() + Math.max(expiresIn - 60, 60) * 1000,
		};

		kisToken = tokenData;
		saveTokenToDisk(tokenData.token, tokenData.expiresAt, baseUrl, appKey);

		return tokenData.token;
	} catch (error: any) {
		console.error("KIS token request failed");
		console.error("KIS token status:", error.response?.status);
		console.error("KIS token data:", error.response?.data);
		console.error("KIS token message:", error.message);
		console.error("KIS baseUrl:", baseUrl);

		if (retryOnTokenLimit && isKisTokenLimitError(error)) {
			console.error("KIS token limit detected. Retrying after 65 seconds...");
			await sleep(65_000);
			return requestNewKisAccessToken(false);
		}

		throw createHttpError(
			error.response?.status || error.statusCode || 502,
			`KIS 토큰 발급 실패: ${getKisErrorMessage(error)}`,
		);
	}
};

const getKisAccessToken = async (): Promise<string> => {
	if (kisToken && kisToken.expiresAt > Date.now() + 60_000) {
		return kisToken.token;
	}

	const { appKey, baseUrl } = getKisConfig();

	const diskToken = readTokenFromDisk(baseUrl, appKey);

	if (diskToken) {
		kisToken = diskToken;
		return diskToken.token;
	}

	if (kisTokenPromise) {
		return kisTokenPromise;
	}

	kisTokenPromise = requestNewKisAccessToken().finally(() => {
		kisTokenPromise = null;
	});

	return kisTokenPromise;
};

const kisGet = async <T>(
	pathName: string,
	trId: string,
	params: Record<string, string>,
): Promise<KisResponse<T>> => {
	return enqueueKisRequest(async () => {
		const runRequest = async (): Promise<KisResponse<T>> => {
			const { appKey, appSecret, baseUrl } = getKisConfig();
			const accessToken = await getKisAccessToken();

			const res = await axios.get<KisResponse<T>>(`${baseUrl}${pathName}`, {
				params,
				headers: {
					"Content-Type": "application/json; charset=utf-8",
					authorization: `Bearer ${accessToken}`,
					appkey: appKey,
					appsecret: appSecret,
					tr_id: trId,
					custtype: "P",
				},
			});

			if (res.data.rt_cd && res.data.rt_cd !== "0") {
				throw createHttpError(
					400,
					`KIS API error ${res.data.msg_cd || ""}: ${res.data.msg1 || ""}`,
				);
			}

			return res.data;
		};

		try {
			return await runRequest();
		} catch (error: any) {
			if (isKisRateLimitError(error)) {
				console.error("KIS rate limit detected. Retrying after 1.5 seconds...");
				await sleep(1500);

				try {
					return await runRequest();
				} catch (retryError: any) {
					console.error("KIS retry failed");
					console.error("KIS GET path:", pathName);
					console.error("KIS GET tr_id:", trId);
					console.error("KIS GET params:", params);
					console.error(
						"KIS GET status:",
						retryError.response?.status || retryError.statusCode,
					);
					console.error("KIS GET data:", retryError.response?.data);
					console.error("KIS GET message:", retryError.message);

					throw createHttpError(
						retryError.response?.status || retryError.statusCode || 502,
						`KIS API 요청 실패: ${getKisErrorMessage(retryError)}`,
					);
				}
			}

			console.error("KIS GET request failed");
			console.error("KIS GET path:", pathName);
			console.error("KIS GET tr_id:", trId);
			console.error("KIS GET params:", params);
			console.error("KIS GET status:", error.response?.status || error.statusCode);
			console.error("KIS GET data:", error.response?.data);
			console.error("KIS GET message:", error.message);

			throw createHttpError(
				error.response?.status || error.statusCode || 502,
				`KIS API 요청 실패: ${getKisErrorMessage(error)}`,
			);
		}
	});
};

const getSignedChange = (rawChange: any, signCode: any): number => {
	const change = Math.abs(parseNumber(rawChange));

	if (signCode === "4" || signCode === "5") return -change;
	if (signCode === "3") return 0;

	return change;
};

const parseKisDate = (date: string, time = "000000"): number => {
	const safeDate = date || "";
	const safeTime = (time || "000000").padEnd(6, "0");

	if (safeDate.length !== 8) {
		return Date.now();
	}

	const year = parseInt(safeDate.slice(0, 4), 10);
	const month = parseInt(safeDate.slice(4, 6), 10) - 1;
	const day = parseInt(safeDate.slice(6, 8), 10);
	const hour = parseInt(safeTime.slice(0, 2), 10);
	const minute = parseInt(safeTime.slice(2, 4), 10);
	const second = parseInt(safeTime.slice(4, 6), 10);

	return Date.UTC(year, month, day, hour, minute, second);
};

const formatKisDate = (date: Date): string => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	return `${year}${month}${day}`;
};

const getDailyStartDate = (period: Exclude<ChartPeriod, "1d">): Date => {
	const date = new Date();

	if (period === "5d") {
		date.setDate(date.getDate() - 14);
	} else if (period === "1m") {
		date.setDate(date.getDate() - 45);
	} else if (period === "6m") {
		date.setDate(date.getDate() - 210);
	} else if (period === "YTD") {
		date.setMonth(0, 1);
	} else {
		date.setDate(date.getDate() - 430);
	}

	return date;
};
const INTRADAY_ANCHOR_TIMES = [
	"153000",
	"150000",
	"143000",
	"140000",
	"133000",
	"130000",
	"123000",
	"120000",
	"113000",
	"110000",
	"103000",
	"100000",
	"093000",
	"090000",
];

const getIntradayAnchorTimes = (): string[] => {
	const maxPages = Number(process.env.STOTRA_KIS_INTRADAY_PAGES || 13);

	return INTRADAY_ANCHOR_TIMES.slice(
		0,
		Math.min(maxPages, INTRADAY_ANCHOR_TIMES.length),
	);
};

const dedupeOhlcvPoints = (points: OhlcvPoint[]): OhlcvPoint[] => {
	const map = new Map<number, OhlcvPoint>();

	for (const point of points) {
		if (!point.time || point.close <= 0) continue;
		map.set(point.time, point);
	}

	return Array.from(map.values()).sort((a, b) => a.time - b.time);
};

const fetchIntradayStockDataPage = async (
	symbol: string,
	anchorTime: string,
): Promise<OhlcvPoint[]> => {
	const res = await kisGet<any>(
		"/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice",
		"FHKST03010200",
		{
			FID_COND_MRKT_DIV_CODE: KIS_MARKET_DIV_CODE,
			FID_INPUT_ISCD: symbol,
			FID_INPUT_HOUR_1: anchorTime,
			FID_PW_DATA_INCU_YN: "Y",
			FID_ETC_CLS_CODE: "",
		},
	);

	return (res.output2 || [])
		.map((item: any) => {
			const price = parseNumber(item.stck_prpr);
			const volume = parseNumber(item.cntg_vol || item.acml_vol);

			return {
				time: Math.floor(
					parseKisDate(item.stck_bsop_date, item.stck_cntg_hour) / 1000,
				),
				open: price,
				high: price,
				low: price,
				close: price,
				volume,
			};
		})
		.filter((point: OhlcvPoint) => point.close > 0)
		.sort((a: OhlcvPoint, b: OhlcvPoint) => a.time - b.time);
};

const intervalToMinutes = (interval: ChartInterval): number => {
	if (interval === "1m") return 1;
	if (interval === "5m") return 5;
	if (interval === "15m") return 15;
	if (interval === "1h") return 60;
	if (interval === "4h") return 240;
	return 1440;
};

const aggregateOhlcv = (
	points: OhlcvPoint[],
	interval: ChartInterval,
): OhlcvPoint[] => {
	if (interval === "1m" || interval === "1d") {
		return points;
	}

	const intervalSeconds = intervalToMinutes(interval) * 60;
	const groups = new Map<number, OhlcvPoint[]>();

	for (const point of points) {
		const bucket = Math.floor(point.time / intervalSeconds) * intervalSeconds;

		if (!groups.has(bucket)) {
			groups.set(bucket, []);
		}

		groups.get(bucket)!.push(point);
	}

	return Array.from(groups.entries())
		.map(([time, group]) => {
			const sorted = group.sort((a, b) => a.time - b.time);

			return {
				time,
				open: sorted[0].open,
				high: Math.max(...sorted.map((p) => p.high)),
				low: Math.min(...sorted.map((p) => p.low)),
				close: sorted[sorted.length - 1].close,
				volume: sorted.reduce((sum, p) => sum + p.volume, 0),
			};
		})
		.sort((a, b) => a.time - b.time);
};

const fetchExactStockInfo = async (symbol: string): Promise<any | null> => {
	const normalizedSymbol = normalizeStockSymbol(symbol);
	const cacheKey = `${normalizedSymbol}-kis-stock-info`;

	if (stockCache.has(cacheKey)) {
		return stockCache.get(cacheKey);
	}

	if (!isKisQuoteSupportedSymbol(normalizedSymbol)) {
		return null;
	}

	try {
		const res = await kisGet<any>(
			"/uapi/domestic-stock/v1/quotations/search-stock-info",
			"CTPF1002R",
			{
				PDNO: normalizedSymbol,
				PRDT_TYPE_CD: KIS_PRODUCT_TYPE_CD,
			},
		);

		const output = res.output || null;
		stockCache.set(cacheKey, output, 60 * 60 * 24);

		return output;
	} catch (error) {
		console.error(
			`fetchExactStockInfo failed: ${normalizedSymbol}`,
			getKisErrorMessage(error),
		);

		return null;
	}
};

export const fetchStockData = async (symbol: string): Promise<any> => {
	const normalizedSymbol = normalizeStockSymbol(symbol);
	const cacheKey = normalizedSymbol + "-quote";

	if (!isKisQuoteSupportedSymbol(normalizedSymbol)) {
		throw createHttpError(
			400,
			`현재 상세조회는 6자리 국내 주식/ETF 코드만 지원합니다: ${normalizedSymbol}`,
		);
	}

	try {
		if (stockCache.has(cacheKey)) {
			return stockCache.get(cacheKey);
		}

		const quoteRes = await kisGet<any>(
			"/uapi/domestic-stock/v1/quotations/inquire-price",
			"FHKST01010100",
			{
				FID_COND_MRKT_DIV_CODE: KIS_MARKET_DIV_CODE,
				FID_INPUT_ISCD: normalizedSymbol,
			},
		);

		const quote = quoteRes.output;

		if (!quote || !quote.stck_prpr) {
			throw createHttpError(
				404,
				`No KIS quote data returned for ${normalizedSymbol}`,
			);
		}

		const regularMarketPrice = parseNumber(quote.stck_prpr);
		const signedChange = getSignedChange(quote.prdy_vrss, quote.prdy_vrss_sign);
		const regularMarketPreviousClose =
			parseNumber(quote.stck_sdpr) || regularMarketPrice - signedChange;
		const regularMarketChangePercent = parseNumber(quote.prdy_ctrt);

		let masterStock: MasterStock | null = null;

		try {
			const masterStocks = await getDomesticMasterStocks();
			masterStock =
				masterStocks.find((stock) => stock.symbol === normalizedSymbol) || null;
		} catch {
			masterStock = null;
		}

		let stockInfo: any | null = null;

		let stockName =
			quote.hts_kor_isnm || masterStock?.name || normalizedSymbol;

		if (stockName === normalizedSymbol) {
			stockInfo = await fetchExactStockInfo(normalizedSymbol).catch(() => null);

			stockName =
				stockInfo?.prdt_name || stockInfo?.prdt_abrv_name || stockName;
		}

		const stockData = {
			symbol: normalizedSymbol,
			name: stockName,
			shortName: stockName,
			longName: stockName,

			market: masterStock?.market || stockInfo?.mket_id_cd || "KRX",
			assetType: masterStock?.assetType || "STOCK",
			tradable: true,

			price: regularMarketPrice,
			changePrice: signedChange,
			changeRate: regularMarketChangePercent,
			open: parseNumber(quote.stck_oprc),
			high: parseNumber(quote.stck_hgpr),
			low: parseNumber(quote.stck_lwpr),
			volume: parseNumber(quote.acml_vol),
			fetchedAt: new Date().toISOString(),

			marketCap: pickNumber(quote, ["hts_avls", "marketCap", "mkt_cap"]),
			per: pickNumber(quote, ["per", "PER"]),
			pbr: pickNumber(quote, ["pbr", "PBR"]),
			eps: pickNumber(quote, ["eps", "EPS"]),
			bps: pickNumber(quote, ["bps", "BPS"]),

			regularMarketPrice,
			regularMarketPreviousClose,
			regularMarketChange: signedChange,
			regularMarketChangePercent,
			regularMarketVolume: parseNumber(quote.acml_vol),
			regularMarketOpen: parseNumber(quote.stck_oprc),
			regularMarketDayHigh: parseNumber(quote.stck_hgpr),
			regularMarketDayLow: parseNumber(quote.stck_lwpr),
		};

		stockCache.set(cacheKey, stockData, 10);

		return stockData;
	} catch (error: any) {
		console.error(
			`Error fetching ${normalizedSymbol} KIS stock data:`,
			error.message || error,
		);

		throw error;
	}
};
export type OrderBookLevel = {
	level: number;
	askPrice: number;
	askVolume: number;
	bidPrice: number;
	bidVolume: number;
};

export type OrderBookData = {
	symbol: string;
	totalAskVolume: number;
	totalBidVolume: number;
	expectedPrice: number;
	expectedVolume: number;
	levels: OrderBookLevel[];
	fetchedAt: string;
};

const pickNum = (source: any, keys: string[]): number => {
	if (!source) return 0;

	for (const key of keys) {
		const value = source[key];

		if (value !== undefined && value !== null && value !== "") {
			const parsed = parseNumber(value);

			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
	}

	return 0;
};

export const fetchOrderBookData = async (
	symbol: string,
): Promise<OrderBookData> => {
	const normalizedSymbol = normalizeStockSymbol(symbol);
	const cacheKey = `${normalizedSymbol}-orderbook`;

	if (!isKisQuoteSupportedSymbol(normalizedSymbol)) {
		throw createHttpError(
			400,
			`호가 조회는 6자리 국내 주식 코드만 지원합니다: ${normalizedSymbol}`,
		);
	}

	const cached = stockCache.get(cacheKey) as OrderBookData | undefined;

		if (cached) {
			return cached;
		}

	const res = await kisGet<any>(
		"/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn",
		"FHKST01010200",
		{
			FID_COND_MRKT_DIV_CODE: KIS_MARKET_DIV_CODE,
			FID_INPUT_ISCD: normalizedSymbol,
		},
	);

	const output1 = res.output1 || {};
	const output2 = res.output2 || {};

	const levels: OrderBookLevel[] = Array.from({ length: 10 }).map((_, index) => {
		const level = index + 1;

		return {
			level,
			askPrice: pickNum(output1, [`askp${level}`, `askp${level}_prpr`]),
			askVolume: pickNum(output1, [`askp_rsqn${level}`, `askp${level}_rsqn`]),
			bidPrice: pickNum(output1, [`bidp${level}`, `bidp${level}_prpr`]),
			bidVolume: pickNum(output1, [`bidp_rsqn${level}`, `bidp${level}_rsqn`]),
		};
	});

	const data: OrderBookData = {
		symbol: normalizedSymbol,
		totalAskVolume: pickNum(output1, ["total_askp_rsqn", "askp_rsqn"]),
		totalBidVolume: pickNum(output1, ["total_bidp_rsqn", "bidp_rsqn"]),
		expectedPrice: pickNum(output2, ["antc_cnpr", "stck_prpr"]),
		expectedVolume: pickNum(output2, ["antc_cntg_vrss", "cntg_vol"]),
		levels,
		fetchedAt: new Date().toISOString(),
	};

	// 호가창은 자주 바뀌므로 짧게 캐시
	stockCache.set(cacheKey, data, 3);

	return data;
};
const pickNumber = (source: any, keys: string[]): number | null => {
	if (!source) return null;

	for (const key of keys) {
		const value = source[key];

		if (value !== undefined && value !== null && value !== "") {
			const parsed = parseNumber(value);

			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
	}

	return null;
};

const firstOutput = (response: KisResponse<any>): any => {
	if (Array.isArray(response.output)) {
		return response.output[0] || null;
	}

	if (Array.isArray(response.output1)) {
		return response.output1[0] || null;
	}

	if (Array.isArray(response.output2)) {
		return response.output2[0] || null;
	}

	return response.output || response.output1 || response.output2 || null;
};

const fetchFinanceEndpoint = async (
	pathName: string,
	trId: string,
	symbol: string,
): Promise<any | null> => {
	try {
		const res = await kisGet<any>(pathName, trId, {
			FID_COND_MRKT_DIV_CODE: KIS_MARKET_DIV_CODE,
			FID_INPUT_ISCD: symbol,
			FID_DIV_CLS_CODE: "0",
		});

		console.log("================================");
		console.log("PATH:", pathName);
		console.log("TR_ID:", trId);
		console.log(
			"OUTPUT:",
			JSON.stringify(firstOutput(res), null, 2),
		);
		console.log("================================");

		return firstOutput(res);
	} catch (error: any) {
		console.error(
			`KIS finance endpoint failed: ${pathName}`,
			error.message || error,
		);

		return null;
	}
};

export const fetchStockFinancialData = async (symbol: string): Promise<any> => {
	const normalizedSymbol = normalizeStockSymbol(symbol);
	const cacheKey = `${normalizedSymbol}-financial-detail`;

	if (!isKisQuoteSupportedSymbol(normalizedSymbol)) {
		throw createHttpError(
			400,
			`현재 재무정보 조회는 6자리 국내 주식 코드만 지원합니다: ${normalizedSymbol}`,
		);
	}

	if (stockCache.has(cacheKey)) {
		return stockCache.get(cacheKey);
	}

	/*
		KIS 국내주식 종목정보 계열 API.
		문서 버전에 따라 필드명이 조금 다를 수 있으므로 아래에서 여러 후보명을 동시에 매핑한다.
	*/
	const financialRatio = await fetchFinanceEndpoint(
		"/uapi/domestic-stock/v1/finance/financial-ratio",
		"FHKST66430300",
		normalizedSymbol,
	);

	const incomeStatement = await fetchFinanceEndpoint(
		"/uapi/domestic-stock/v1/finance/income-statement",
		"FHKST66430200",
		normalizedSymbol,
	);

	const otherMajorRatio = await fetchFinanceEndpoint(
		"/uapi/domestic-stock/v1/finance/other-major-ratios",
		"FHKST66430500",
		normalizedSymbol,
	);

	const balanceSheet = await fetchFinanceEndpoint(
		"/uapi/domestic-stock/v1/finance/balance-sheet",
		"FHKST66430100",
		normalizedSymbol,
	);

	const financialData = {
		per: pickNumber(otherMajorRatio, [
			"per",
			"PER",
			"prdy_vrss_per",
			"stck_prpr_per",
		]),
		pbr: pickNumber(otherMajorRatio, [
			"pbr",
			"PBR",
			"prdy_vrss_pbr",
			"stck_prpr_pbr",
		]),
		eps: pickNumber(financialRatio, ["eps", "EPS", "eps_val"]),
		bps: pickNumber(financialRatio, ["bps", "BPS", "bps_val"]),
		roe: pickNumber(financialRatio, [
			"roe",
			"ROE",
			"roe_val",
			"self_cptl_ntin_rate",
		]),

		revenue: pickNumber(incomeStatement, [
			"revenue",
			"sale_account",
			"sale_account_ttam",
			"sales",
		]),
		operatingProfit: pickNumber(incomeStatement, [
			"operatingProfit",
			"bsop_prti",
			"op_prfi",
			"operating_profit",
		]),
		netIncome: pickNumber(incomeStatement, [
			"netIncome",
			"thtr_ntin",
			"net_income",
			"ntin",
		]),

		totalAssets: pickNumber(balanceSheet, [
			"totalAssets",
			"total_aset",
			"asst_ttam",
			"total_asset",
		]),
		totalLiabilities: pickNumber(balanceSheet, [
			"totalLiabilities",
			"total_lblt",
			"lblt_ttam",
			"total_liability",
		]),
		totalEquity: pickNumber(balanceSheet, [
			"totalEquity",
			"total_cptl",
			"cptl_ttam",
			"total_equity",
		]),
		fetchedAt: new Date().toISOString(),
	};

	stockCache.set(cacheKey, financialData, 60 * 60 * 6);

	return financialData;
};

const fetchIntradayStockData = async (
	symbol: string,
	interval: ChartInterval = "1m",
): Promise<OhlcvPoint[]> => {
	const rawCacheKey = `${symbol}-intraday-raw-expanded`;

	if (stockCache.has(rawCacheKey)) {
		const cachedRawPoints = stockCache.get(rawCacheKey) as OhlcvPoint[];
		return aggregateOhlcv(cachedRawPoints, interval);
	}

	const anchorTimes = getIntradayAnchorTimes();
	const allPoints: OhlcvPoint[] = [];

	for (const anchorTime of anchorTimes) {
		try {
			const pagePoints = await fetchIntradayStockDataPage(symbol, anchorTime);
			allPoints.push(...pagePoints);
		} catch (error: any) {
			console.error(
				`Failed to fetch intraday page: ${symbol} ${anchorTime}`,
				error.message || error,
			);
		}
	}

	const dedupedPoints = dedupeOhlcvPoints(allPoints);

	if (dedupedPoints.length === 0) {
		throw createHttpError(
			404,
			`No intraday chart data returned for ${symbol}`,
		);
	}

	stockCache.set(rawCacheKey, dedupedPoints, 60);

	return aggregateOhlcv(dedupedPoints, interval);
};

const fetchDailyStockData = async (
	symbol: string,
	period: Exclude<ChartPeriod, "1d">,
): Promise<OhlcvPoint[]> => {
	const endDate = new Date();
	const startDate = getDailyStartDate(period);

	const res = await kisGet<any>(
		"/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice",
		"FHKST03010100",
		{
			FID_COND_MRKT_DIV_CODE: KIS_MARKET_DIV_CODE,
			FID_INPUT_ISCD: symbol,
			FID_INPUT_DATE_1: formatKisDate(startDate),
			FID_INPUT_DATE_2: formatKisDate(endDate),
			FID_PERIOD_DIV_CODE: "D",
			FID_ORG_ADJ_PRC: "0",
		},
	);

	let points: OhlcvPoint[] = (res.output2 || [])
		.map((item: any) => {
			const close = parseNumber(item.stck_clpr);

			return {
				time: Math.floor(parseKisDate(item.stck_bsop_date) / 1000),
				open: parseNumber(item.stck_oprc) || close,
				high: parseNumber(item.stck_hgpr) || close,
				low: parseNumber(item.stck_lwpr) || close,
				close,
				volume: parseNumber(item.acml_vol),
			};
		})
		.filter((point) => point.close > 0)
		.sort((a, b) => a.time - b.time);

	if (period === "5d") {
		points = points.slice(-5);
	}

	return points;
};

export const fetchHistoricalStockData = async (
	symbol: string,
	period: ChartPeriod = "1d",
	interval: ChartInterval = "1d",
): Promise<OhlcvPoint[]> => {
	const normalizedSymbol = normalizeStockSymbol(symbol);

	const safePeriod: ChartPeriod = [
		"1d",
		"5d",
		"1m",
		"6m",
		"YTD",
		"1y",
		"all",
	].includes(period)
		? period
		: "1d";

	const safeInterval: ChartInterval = [
		"1m",
		"5m",
		"15m",
		"1h",
		"4h",
		"1d",
	].includes(interval)
		? interval
		: "1d";

	const cacheKey =
		normalizedSymbol + "-historical-" + safePeriod + "-" + safeInterval;

	if (!isKisQuoteSupportedSymbol(normalizedSymbol)) {
		throw createHttpError(
			400,
			`현재 차트조회는 6자리 국내 주식/ETF 코드만 지원합니다: ${normalizedSymbol}`,
		);
	}

	try {
		if (stockCache.has(cacheKey)) {
			return stockCache.get(cacheKey) as OhlcvPoint[];
		}

		let chartData: OhlcvPoint[];

		if (safePeriod === "1d") {
			chartData = await fetchIntradayStockData(normalizedSymbol, safeInterval);
		} else {
			chartData = await fetchDailyStockData(normalizedSymbol, safePeriod);
		}

		if (safePeriod === "1d" && chartData.length === 0) {
			chartData = await fetchDailyStockData(normalizedSymbol, "5d");
		}

		const ttl = safePeriod === "1d" ? 60 : 60 * 60;

		stockCache.set(cacheKey, chartData, ttl);

		return chartData;
	} catch (error: any) {
		console.error(
			`Error fetching ${normalizedSymbol} KIS historical data:`,
			error.message || error,
		);

		throw error;
	}
};

const findZipSignature = (buffer: Buffer, signature: number): number => {
	for (let i = buffer.length - 4; i >= 0; i--) {
		if (buffer.readUInt32LE(i) === signature) return i;
	}

	return -1;
};

const toSafeUint8Array = (input: ArrayLike<number>): Uint8Array => {
	const view = new Uint8Array(input.length);

	for (let i = 0; i < input.length; i++) {
		view[i] = input[i] ?? 0;
	}

	return view;
};

const unzipFirstTextFile = (buffer: Buffer): string => {
	const eocdOffset = findZipSignature(buffer, 0x06054b50);

	if (eocdOffset < 0) {
		throw new Error("Could not find ZIP end of central directory");
	}

	const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
	let centralOffset = buffer.readUInt32LE(eocdOffset + 16);

	for (let i = 0; i < totalEntries; i++) {
		if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) {
			throw new Error("Invalid ZIP central directory");
		}

		const method = buffer.readUInt16LE(centralOffset + 10);
		const compressedSize = buffer.readUInt32LE(centralOffset + 20);
		const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
		const extraLength = buffer.readUInt16LE(centralOffset + 30);
		const commentLength = buffer.readUInt16LE(centralOffset + 32);
		const localHeaderOffset = buffer.readUInt32LE(centralOffset + 42);

		const fileName = buffer
			.subarray(centralOffset + 46, centralOffset + 46 + fileNameLength)
			.toString("utf8");

		centralOffset += 46 + fileNameLength + extraLength + commentLength;

		if (fileName.endsWith("/")) {
			continue;
		}

		if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
			throw new Error("Invalid ZIP local file header");
		}

		const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
		const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
		const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;

		const compressedBuffer = buffer.subarray(
			dataStart,
			dataStart + compressedSize,
		);

		const compressed = toSafeUint8Array(compressedBuffer);

		const raw =
			method === 8
				? toSafeUint8Array(zlib.inflateRawSync(compressed))
				: compressed;

		return new TextDecoder("euc-kr").decode(raw);
	}

	throw new Error("ZIP file did not contain a readable file");
};

const fetchMasterFile = async (
	url: string,
	market: "KOSPI" | "KOSDAQ",
	tailLength: number,
): Promise<MasterStock[]> => {
	const res = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer" });
	const text = unzipFirstTextFile(Buffer.from(res.data));

	return text
		.split(/\r?\n/)
		.map((row) => {
			const header = row.slice(0, Math.max(row.length - tailLength, 0));
			const symbol = header.slice(0, 9).trim();
			const name = header.slice(21).trim();
			const tradable = /^\d{6}$/.test(symbol);

			return {
				symbol,
				name,
				market,
				assetType: tradable ? "STOCK" : "UNKNOWN",
				tradable,
			};
		})
		.filter((stock) => stock.symbol && stock.name);
};

const getDomesticMasterStocks = async (): Promise<MasterStock[]> => {
	if (stockCache.has(KIS_MASTER_CACHE_KEY)) {
		return stockCache.get(KIS_MASTER_CACHE_KEY) as MasterStock[];
	}

	const [kospi, kosdaq] = await Promise.all([
		fetchMasterFile(
			"https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip",
			"KOSPI",
			228,
		),
		fetchMasterFile(
			"https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip",
			"KOSDAQ",
			222,
		),
	]);

	const stocks = [...kospi, ...kosdaq];

	stockCache.set(KIS_MASTER_CACHE_KEY, stocks, 60 * 60 * 24);

	return stocks;
};

const toSearchResult = (stock: MasterStock): StockSearchResult => ({
	symbol: stock.symbol,
	shortname: stock.name,
	longname: stock.name,
	exchDisp: stock.market,
	exchange: stock.market,
	quoteType: stock.tradable ? "EQUITY" : "OTHER",
	assetType: stock.assetType,
	tradable: stock.tradable,
});

export const searchStocks = async (query: string): Promise<any> => {
	try {
		const normalizedQuery = query.trim().toUpperCase();

		if (!normalizedQuery) {
			return [];
		}

		const stocks = await getDomesticMasterStocks();
		const queryLower = query.trim().toLowerCase();

		const results = stocks
			.filter(
				(stock) =>
					stock.symbol.includes(normalizedQuery) ||
					stock.name.toLowerCase().includes(queryLower),
			)
			.sort((a, b) => {
				const aExact = a.symbol === normalizedQuery || a.name === query;
				const bExact = b.symbol === normalizedQuery || b.name === query;

				const aStarts =
					a.symbol.startsWith(normalizedQuery) || a.name.startsWith(query);
				const bStarts =
					b.symbol.startsWith(normalizedQuery) || b.name.startsWith(query);

				if (aExact !== bExact) return aExact ? -1 : 1;
				if (aStarts !== bStarts) return aStarts ? -1 : 1;

				if (a.tradable !== b.tradable) return a.tradable ? -1 : 1;

				return a.symbol.localeCompare(b.symbol);
			})
			.slice(0, 20)
			.map(toSearchResult);

		if (results.length > 0) {
			return results;
		}

		if (/^Q?\d{6}$/.test(normalizedQuery)) {
			const normalizedSymbol = normalizeStockSymbol(normalizedQuery);
			const info = await fetchExactStockInfo(normalizedSymbol).catch(() => null);

			if (info) {
				return [
					{
						symbol: normalizedSymbol,
						shortname:
							info.prdt_abrv_name || info.prdt_name || normalizedSymbol,
						longname:
							info.prdt_name || info.prdt_abrv_name || normalizedSymbol,
						exchDisp: info.mket_id_cd || "KRX",
						exchange: info.mket_id_cd || "KRX",
						quoteType: "EQUITY",
						assetType: "STOCK",
						tradable: true,
					},
				];
			}
		}

		return [];
	} catch (error: any) {
		console.error("searchStocks KIS error:", error.message || error);

		return [];
	}
};

export type UsChartPeriod =
	| "1m"
	| "6m"
	| "1y";

export const normalizeUsStockSymbol = (
	symbol: string,
): string => {
	return String(symbol || "")
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9.-]/g, "")
		.slice(0, 15);
};

const assertUsExchange = (
	exchange: string,
): UsExchangeCode => {
	const normalized =
		String(exchange || "")
			.trim()
			.toUpperCase();

	if (
		normalized !== "NAS" &&
		normalized !== "NYS" &&
		normalized !== "AMS"
	) {
		throw createHttpError(
			400,
			`지원하지 않는 미국 거래소 코드입니다: ${exchange}`,
		);
	}

	return normalized;
};

const getUsCatalogItem = (
	symbol: string,
	exchange?: UsExchangeCode,
) => {
	return (
		US_STOCK_CATALOG.find(
			(item) =>
				item.symbol === symbol &&
				(!exchange ||
					item.exchange === exchange),
		) ?? null
	);
};

const fetchUsExactStockInfo = async (
	symbol: string,
	exchange: UsExchangeCode,
): Promise<any | null> => {
	const normalizedSymbol =
		normalizeUsStockSymbol(symbol);

	if (!normalizedSymbol) {
		return null;
	}

	const cacheKey =
		`us-stock-info-${exchange}-${normalizedSymbol}`;

	if (stockCache.has(cacheKey)) {
		return stockCache.get(cacheKey);
	}

	try {
		const response =
			await kisGet<any>(
				"/uapi/overseas-price/v1/quotations/search-info",
				"CTPF1702R",
				{
					PRDT_TYPE_CD:
						US_PRODUCT_TYPE_CODE[
							exchange
						],
					PDNO: normalizedSymbol,
				},
			);

		const output =
			Array.isArray(
				response.output,
			)
				? response.output[0]
				: response.output;

		if (!output) {
			return null;
		}

		stockCache.set(
			cacheKey,
			output,
			60 * 60 * 24,
		);

		return output;
	} catch (error) {
		console.error(
			`fetchUsExactStockInfo failed: ${exchange}:${normalizedSymbol}`,
			getKisErrorMessage(error),
		);

		return null;
	}
};

export const searchUsStocks = async (
	query: string,
): Promise<any[]> => {
	const normalizedQuery =
		String(query || "")
			.trim()
			.toUpperCase();

	if (!normalizedQuery) {
		return [];
	}

	const localResults =
		US_STOCK_CATALOG.filter(
			(item) => {
				const searchable = [
					item.symbol,
					item.name,
					item.nameKo,
					...item.keywords,
				]
					.join(" ")
					.toUpperCase();

				return searchable.includes(
					normalizedQuery,
				);
			},
		)
			.sort((a, b) => {
				const aExact =
					a.symbol ===
					normalizedQuery;
				const bExact =
					b.symbol ===
					normalizedQuery;

				if (aExact !== bExact) {
					return aExact ? -1 : 1;
				}

				const aStarts =
					a.symbol.startsWith(
						normalizedQuery,
					);
				const bStarts =
					b.symbol.startsWith(
						normalizedQuery,
					);

				if (aStarts !== bStarts) {
					return aStarts ? -1 : 1;
				}

				return a.symbol.localeCompare(
					b.symbol,
				);
			})
			.slice(0, 20)
			.map((item) => ({
				symbol: item.symbol,
				shortname:
					item.nameKo ||
					item.name,
				longname: item.name,
				name: item.nameKo
					? `${item.nameKo} (${item.name})`
					: item.name,
				exchange: item.exchange,
				exchDisp: item.market,
				market: item.market,
				currency: "USD",
				assetType:
					item.assetType ??
					"STOCK",
				quoteType:
					item.assetType ===
					"ETF"
						? "ETF"
						: "EQUITY",
				category:
					item.category ??
					null,
				summary:
					item.summary ??
					null,
				benchmark:
					item.benchmark ??
					null,
				issuer:
					item.issuer ??
					null,
				tradable: true,
			}));

	if (localResults.length > 0) {
		return localResults;
	}

	/*
	 * 목록에 없는 종목도 정확한 영문 티커를 입력하면
	 * KIS 종목정보 API로 거래소를 순차 확인합니다.
	 */
	if (
		!/^[A-Z][A-Z0-9.-]{0,14}$/.test(
			normalizedQuery,
		)
	) {
		return [];
	}

	for (const exchange of [
		"NAS",
		"NYS",
		"AMS",
	] as UsExchangeCode[]) {
		const info =
			await fetchUsExactStockInfo(
				normalizedQuery,
				exchange,
			);

		const productName =
			info?.prdt_name ||
			info?.prdt_abrv_name ||
			info?.ovrs_item_name ||
			info?.item_name;

		if (productName) {
			return [
				{
					symbol:
						normalizedQuery,
					shortname:
						productName,
					longname:
						productName,
					name: productName,
					exchange,
					exchDisp:
						US_EXCHANGE_NAME[
							exchange
						],
					market:
						US_EXCHANGE_NAME[
							exchange
						],
					currency: "USD",
					assetType:
						"STOCK",
					quoteType:
						"EQUITY",
					tradable: true,
				},
			];
		}
	}

	return [];
};

const fetchUsPriceDetail =
	async (
		symbol: string,
		exchange: UsExchangeCode,
	): Promise<any | null> => {
		const cacheKey =
			`us-price-detail-${exchange}-${symbol}`;

		if (stockCache.has(cacheKey)) {
			return stockCache.get(
				cacheKey,
			);
		}

		try {
			const response =
				await kisGet<any>(
					"/uapi/overseas-price/v1/quotations/price-detail",
					"HHDFS76200200",
					{
						AUTH: "",
						EXCD:
							exchange,
						SYMB:
							symbol,
					},
				);

			const output =
				Array.isArray(
					response.output,
				)
					? response.output[0]
					: response.output;

			if (!output) {
				return null;
			}

			stockCache.set(
				cacheKey,
				output,
				60,
			);

			return output;
		} catch (error) {
			/*
			 * 현재가상세 API는 KIS 모의 환경에서
			 * 지원되지 않을 수 있습니다.
			 * 기본 현재가는 정상 표시하고
			 * 재무지표만 빈 값으로 유지합니다.
			 */
			console.warn(
				`fetchUsPriceDetail skipped: ${exchange}:${symbol}`,
				getKisErrorMessage(error),
			);

			return null;
		}
	};

export const fetchUsStockData = async (
	symbol: string,
	exchangeInput: string,
): Promise<any> => {
	const normalizedSymbol =
		normalizeUsStockSymbol(symbol);

	const requestedExchange =
		assertUsExchange(exchangeInput);

	if (!normalizedSymbol) {
		throw createHttpError(
			400,
			"미국 종목 티커가 필요합니다.",
		);
	}

	const cacheKey =
		`us-quote-${requestedExchange}-${normalizedSymbol}`;

	if (stockCache.has(cacheKey)) {
		return stockCache.get(cacheKey);
	}

	const exchangeCandidates = [
		requestedExchange,
		...(
			[
				"NAS",
				"NYS",
				"AMS",
			] as UsExchangeCode[]
		).filter(
			(candidate) =>
				candidate !==
				requestedExchange,
		),
	];

	let quote: any | null = null;
	let actualExchange =
		requestedExchange;
	let lastError: unknown = null;

	for (
		const candidate of
		exchangeCandidates
	) {
		try {
			const response =
				await kisGet<any>(
					"/uapi/overseas-price/v1/quotations/price",
					"HHDFS00000300",
					{
						AUTH: "",
						EXCD:
							candidate,
						SYMB:
							normalizedSymbol,
					},
				);

			const output =
				Array.isArray(
					response.output,
				)
					? response.output[0]
					: response.output;

			const candidatePrice =
				parseNumber(
					output?.last ??
						output?.clos ??
						output?.price,
				);

			if (
				output &&
				candidatePrice > 0
			) {
				quote = output;
				actualExchange =
					candidate;
				break;
			}
		} catch (error) {
			lastError = error;
		}
	}

	const price =
		parseNumber(
			quote?.last ??
				quote?.clos ??
				quote?.price,
		);

	if (!quote || price <= 0) {
		console.error(
			`fetchUsStockData failed: ${requestedExchange}:${normalizedSymbol}`,
			lastError,
		);

		throw createHttpError(
			404,
			`${normalizedSymbol} 미국 주식·ETF 시세를 찾지 못했습니다.`,
		);
	}

	const priceDetail =
		await fetchUsPriceDetail(
			normalizedSymbol,
			actualExchange,
		);

	const catalogItem =
		getUsCatalogItem(
			normalizedSymbol,
			actualExchange,
		) ??
		getUsCatalogItem(
			normalizedSymbol,
		);

	let info: any | null = null;

	if (!catalogItem) {
		info =
			await fetchUsExactStockInfo(
				normalizedSymbol,
				actualExchange,
			);
	}

	const name =
		catalogItem?.nameKo ||
		info?.prdt_name ||
		info?.prdt_abrv_name ||
		info?.ovrs_item_name ||
		normalizedSymbol;

	const longName =
		catalogItem?.name ||
		info?.prdt_name ||
		info?.ovrs_item_name ||
		name;

	const previousClose =
		parseNumber(
			quote?.base ??
				quote?.pymd ??
				quote?.prev_close,
		);

	const changePrice =
		parseNumber(
			quote?.diff ??
				quote?.change,
		);

	const changeRate =
		parseNumber(
			quote?.rate ??
				quote?.change_rate,
		);

	const assetType =
		catalogItem?.assetType ??
		(
			String(
				priceDetail?.etyp_nm ??
					"",
			).trim()
				? "ETF"
				: "STOCK"
		);

	const result = {
		symbol: normalizedSymbol,
		name,
		shortName: name,
		longName,

		exchange:
			actualExchange,
		market:
			US_EXCHANGE_NAME[
				actualExchange
			],
		currency: "USD",
		assetType,
		category:
			catalogItem?.category ??
			null,
		summary:
			catalogItem?.summary ??
			null,
		benchmark:
			catalogItem?.benchmark ??
			null,
		issuer:
			catalogItem?.issuer ??
			null,
		tradable: true,

		price,
		changePrice,
		changeRate,
		previousClose,

		open:
			parseNumber(
				priceDetail?.open ??
					quote?.open,
			),
		high:
			parseNumber(
				priceDetail?.high ??
					quote?.high,
			),
		low:
			parseNumber(
				priceDetail?.low ??
					quote?.low,
			),
		volume:
			parseNumber(
				priceDetail?.tvol ??
					quote?.tvol ??
					quote?.volume,
			),
		tradingValue:
			parseNumber(
				priceDetail?.tamt ??
					quote?.tamt,
			),

		marketCap:
			parseNumber(
				priceDetail?.tomv,
			),
		per:
			parseNumber(
				priceDetail?.perx,
			),
		pbr:
			parseNumber(
				priceDetail?.pbrx,
			),
		eps:
			parseNumber(
				priceDetail?.epsx,
			),
		bps:
			parseNumber(
				priceDetail?.bpsx,
			),
		sharesOutstanding:
			parseNumber(
				priceDetail?.shar,
			),
		fiftyTwoWeekHigh:
			parseNumber(
				priceDetail?.h52p,
			),
		fiftyTwoWeekHighDate:
			priceDetail?.h52d ??
			null,
		fiftyTwoWeekLow:
			parseNumber(
				priceDetail?.l52p,
			),
		fiftyTwoWeekLowDate:
			priceDetail?.l52d ??
			null,
		sectorCode:
			priceDetail?.e_icod ??
			null,
		etpTypeName:
			priceDetail?.etyp_nm ??
			null,

		fetchedAt:
			new Date().toISOString(),

		regularMarketPrice:
			price,
		regularMarketPreviousClose:
			previousClose,
		regularMarketChange:
			changePrice,
		regularMarketChangePercent:
			changeRate,
		regularMarketVolume:
			parseNumber(
				quote?.tvol,
			),
		regularMarketOpen:
			parseNumber(
				quote?.open,
			),
		regularMarketDayHigh:
			parseNumber(
				quote?.high,
			),
		regularMarketDayLow:
			parseNumber(
				quote?.low,
			),
	};

	stockCache.set(
		cacheKey,
		result,
		10,
	);

	stockCache.set(
		`us-quote-${actualExchange}-${normalizedSymbol}`,
		result,
		10,
	);

	return result;
};

const getUsHistoricalStartDate = (
	period: UsChartPeriod,
): Date => {
	const date = new Date();

	if (period === "1m") {
		date.setDate(
			date.getDate() - 45,
		);
	} else if (period === "6m") {
		date.setDate(
			date.getDate() - 210,
		);
	} else {
		date.setDate(
			date.getDate() - 430,
		);
	}

	return date;
};

export const fetchUsHistoricalStockData =
	async (
		symbol: string,
		exchangeInput: string,
		period: UsChartPeriod = "1m",
	): Promise<OhlcvPoint[]> => {
		const normalizedSymbol =
			normalizeUsStockSymbol(
				symbol,
			);

		const exchange =
			assertUsExchange(
				exchangeInput,
			);

		const safePeriod:
			UsChartPeriod = [
				"1m",
				"6m",
				"1y",
			].includes(period)
				? period
				: "1m";

		if (!normalizedSymbol) {
			throw createHttpError(
				400,
				"미국 종목 티커가 필요합니다.",
			);
		}

		const cacheKey =
			`us-history-${exchange}-${normalizedSymbol}-${safePeriod}`;

		if (stockCache.has(cacheKey)) {
			return (
				stockCache.get(
					cacheKey,
				) as OhlcvPoint[]
			);
		}

		const response =
			await kisGet<any>(
				"/uapi/overseas-price/v1/quotations/dailyprice",
				"HHDFS76240000",
				{
					AUTH: "",
					EXCD: exchange,
					SYMB:
						normalizedSymbol,
					GUBN:
						safePeriod ===
						"1y"
							? "1"
							: "0",
					BYMD: "",
					MODP: "1",
				},
			);

		const startDate =
			getUsHistoricalStartDate(
				safePeriod,
			);

		const startTimestamp =
			Math.floor(
				Date.UTC(
					startDate.getUTCFullYear(),
					startDate.getUTCMonth(),
					startDate.getUTCDate(),
				) / 1000,
			);

		const points:
			OhlcvPoint[] = (
				response.output2 || []
			)
				.map((item: any) => {
					const date =
						String(
							item.xymd ||
								item.date ||
								"",
						);

					const close =
						parseNumber(
							item.clos ??
								item.close,
						);

					return {
						time:
							Math.floor(
								parseKisDate(
									date,
								) /
									1000,
							),
						open:
							parseNumber(
								item.open,
							) ||
							close,
						high:
							parseNumber(
								item.high,
							) ||
							close,
						low:
							parseNumber(
								item.low,
							) ||
							close,
						close,
						volume:
							parseNumber(
								item.tvol ??
									item.volume,
							),
					};
				})
				.filter(
					(point: OhlcvPoint) =>
						point.close > 0 &&
						point.time >=
							startTimestamp,
				)
				.sort(
					(a: OhlcvPoint, b: OhlcvPoint) =>
						a.time - b.time,
				);

		stockCache.set(
			cacheKey,
			points,
			60 * 30,
		);

		return points;
	};
