import { Request, Response } from "express";
import User from "../models/user.model";
import { fetchOrderBookData } from "../utils/requests";

import {
	fetchStockData,
	fetchHistoricalStockData,
	fetchDomesticExecutionData,
	fetchDomesticInvestorTrend,
	normalizeStockSymbol,
	searchStocks,
	InvestorTrendPeriod,
} from "../utils/requests";
import { ITransaction } from "../models/transaction.model";
import { IPosition } from "../models/position.model";
import {
	getChartDataWithCache,
	normalizeChartPeriod,
	normalizeChartInterval,
} from "../services/stockChartCache.service";
import { getStockDetailWithCache } from "../services/stockDetail.service";

type Period = "1d" | "5d" | "1m" | "6m" | "YTD" | "1y" | "all";

const allowedPeriods: Period[] = ["1d", "5d", "1m", "6m", "YTD", "1y", "all"];

const getErrorMessage = (error: any): string => {
	return (
		error?.response?.data?.msg1 ||
		error?.response?.data?.message ||
		error?.message ||
		String(error)
	);
};

const getStatusCode = (error: any): number => {
	return error?.statusCode || error?.response?.status || 500;
};
const getOrderBook = async (req: Request, res: Response) => {
	const symbol = normalizeStockSymbol(req.params.symbol || "");

	if (!symbol) {
		return res.status(400).json({
			success: false,
			error: "종목 코드가 필요합니다.",
		});
	}

	try {
		const data = await fetchOrderBookData(symbol);

		return res.status(200).json({
			success: true,
			symbol,
			data,
		});
	} catch (error) {
		console.error(`getOrderBook error: ${symbol}`, error);

		return sendError(res, error, "호가 정보를 불러오지 못했습니다.", {
			symbol,
		});
	}
};

const sendError = (
	res: Response,
	error: any,
	defaultMessage: string,
	extra: Record<string, any> = {},
) => {
	const statusCode = getStatusCode(error);
	const message = getErrorMessage(error);

	return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
		success: false,
		error: defaultMessage,
		message,
		...extra,
	});
};


const getExecutions = async (req: Request, res: Response) => {
	const symbol = normalizeStockSymbol(req.params.symbol || "");
	const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);

	if (!symbol) {
		return res.status(400).json({ success: false, error: "종목 코드가 필요합니다." });
	}

	try {
		const data = await fetchDomesticExecutionData(symbol, limit);
		return res.status(200).json({ success: true, data });
	} catch (error) {
		console.error(`getExecutions error: ${symbol}`, error);
		return sendError(res, error, "실시간 체결 정보를 불러오지 못했습니다.", { symbol });
	}
};

const getInvestors = async (req: Request, res: Response) => {
	const symbol = normalizeStockSymbol(req.params.symbol || "");
	const requestedPeriod = String(req.query.period || "1d");
	const period: InvestorTrendPeriod = ["1d", "5d", "30d", "60d"].includes(requestedPeriod)
		? (requestedPeriod as InvestorTrendPeriod)
		: "1d";

	if (!symbol) {
		return res.status(400).json({ success: false, error: "종목 코드가 필요합니다." });
	}

	try {
		const data = await fetchDomesticInvestorTrend(symbol, period);
		return res.status(200).json({ success: true, data });
	} catch (error) {
		console.error(`getInvestors error: ${symbol}`, error);
		return sendError(res, error, "투자자별 매매동향을 불러오지 못했습니다.", { symbol, period });
	}
};

const getInfo = async (req: Request, res: Response) => {
	/*
	#swagger.tags = ['Stock Data']
	*/
	const symbol = normalizeStockSymbol(req.params.symbol || "");

	if (!symbol) {
		return res.status(400).json({
			success: false,
			error: "종목 코드가 필요합니다.",
		});
	}

	try {
		const quote = await fetchStockData(symbol);

		return res.status(200).json({
			success: true,
			data: quote,
		});
	} catch (error) {
		console.error(`getInfo controller error: ${symbol}`, error);

		return sendError(res, error, "종목 정보를 불러오지 못했습니다.", {
			symbol,
		});
	}
};

const getHistorical = async (req: Request, res: Response) => {
	/*
	#swagger.tags = ['Stock Data']
	*/
	const symbol = normalizeStockSymbol(req.params.symbol || "");

	const period = normalizeChartPeriod(req.query.period?.toString());
	const interval = normalizeChartInterval(req.query.interval?.toString(), period);

	if (!symbol) {
		return res.status(400).json({
			success: false,
			error: "종목 코드가 필요합니다.",
		});
	}

	try {
		const chartResult = await getChartDataWithCache(symbol, period, interval);

		return res.status(200).json({
			success: true,
			symbol: chartResult.symbol,
			period: chartResult.period,
			interval: chartResult.interval,
			source: chartResult.source,
			fetchedAt: chartResult.fetchedAt,
			data: chartResult.points,
		});
	} catch (error) {
		console.error(`getHistorical controller error: ${symbol}`, error);

		return sendError(res, error, "차트 데이터를 불러오지 못했습니다.", {
			symbol,
			period,
			interval,
		});
	}
};
const getDetail = async (req: Request, res: Response) => {
	/*
	#swagger.tags = ['Stock Data']
	*/
	const symbol = normalizeStockSymbol(req.params.symbol || "");

	if (!symbol) {
		return res.status(400).json({
			success: false,
			error: "종목 코드가 필요합니다.",
		});
	}

	try {
		const result = await getStockDetailWithCache(symbol);

		return res.status(200).json({
			success: true,
			symbol,
			source: result.source,
			data: result.detail,
		});
	} catch (error) {
		console.error(`getDetail controller error: ${symbol}`, error);

		return sendError(res, error, "종목 상세 정보를 불러오지 못했습니다.", {
			symbol,
		});
	}
};

const buyStock = async (req: Request, res: Response) => {
	/*
	#swagger.tags = ['Stock Transaction']
	*/
	const symbol = normalizeStockSymbol(req.params.symbol || "");
	const quantity = Number(req.body.quantity);

	if (!symbol || !Number.isFinite(quantity) || quantity <= 0) {
		return res.status(400).json({
			success: false,
			message: "유효한 종목 코드와 수량이 필요합니다.",
		});
	}

	try {
		const data = await fetchStockData(symbol);
		const price = data.regularMarketPrice || data.price;

		let user = await User.findById(req.body.userId);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "사용자를 찾을 수 없습니다.",
			});
		}

		if (user.cash! < price * quantity) {
			return res.status(400).json({
				success: false,
				message: "Not enough cash",
			});
		}

		user.cash! -= price * quantity;

		const transaction: ITransaction = {
			symbol,
			price,
			quantity,
			type: "buy",
			date: Date.now(),
		} as ITransaction;

		user.ledger.push(transaction);

		const position = {
			symbol,
			quantity,
			purchasePrice: price,
			purchaseDate: Date.now(),
		} as IPosition;

		user.positions.push(position);

		await user.save();

		return res.status(200).json({
			success: true,
			message: "Stock was bought successfully!",
		});
	} catch (error) {
		console.error(`buyStock controller error: ${symbol}`, error);

		return sendError(res, error, "매수 처리 중 오류가 발생했습니다.", {
			symbol,
		});
	}
};

const sellStock = async (req: Request, res: Response) => {
	/*
	#swagger.tags = ['Stock Transaction']
	*/
	const symbol = normalizeStockSymbol(req.params.symbol || "");
	let quantity = Number(req.body.quantity);

	if (!symbol || !Number.isFinite(quantity) || quantity <= 0) {
		return res.status(400).json({
			success: false,
			message: "유효한 종목 코드와 수량이 필요합니다.",
		});
	}

	try {
		const data = await fetchStockData(symbol);
		const price = data.regularMarketPrice || data.price;

		let user = await User.findById(req.body.userId);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "사용자를 찾을 수 없습니다.",
			});
		}

		let quantityOwned = 0;
		user.positions.forEach((position) => {
			if (position.symbol === symbol) {
				quantityOwned += position.quantity;
			}
		});

		if (quantityOwned < quantity) {
			return res.status(400).json({
				success: false,
				message: "Not enough shares",
			});
		}

		user.cash! += price * quantity;

		const transaction: ITransaction = {
			symbol,
			price,
			quantity,
			type: "sell",
			date: Date.now(),
		} as ITransaction;

		user.ledger.push(transaction);

		for (let i = 0; i < user.positions.length; i++) {
			if (user.positions[i].symbol === symbol) {
				if (user.positions[i].quantity > quantity) {
					user.positions[i].quantity -= quantity;
					break;
				} else {
					quantity -= user.positions[i].quantity;
					user.positions.splice(i, 1);
					i--;
				}
			}
		}

		await user.save();

		return res.status(200).json({
			success: true,
			message: "Stock was sold successfully!",
		});
	} catch (error) {
		console.error(`sellStock controller error: ${symbol}`, error);

		return sendError(res, error, "매도 처리 중 오류가 발생했습니다.", {
			symbol,
		});
	}
};

const search = async (req: Request, res: Response) => {
	/*
	#swagger.tags = ['Stock Data']
	*/
	const { query } = req.params;

	if (!query) {
		return res.status(400).json({
			success: false,
			message: "No query provided",
		});
	}

	try {
		const quotes = await searchStocks(query);

		return res.status(200).json({
			success: true,
			data: quotes || [],
		});
	} catch (error) {
		console.error("search controller error:", error);

		return sendError(res, error, "종목 검색 중 오류가 발생했습니다.", {
			query,
		});
	}
};

export default {
	getInfo,
	getHistorical,
	getDetail,
	getOrderBook,
	getExecutions,
	getInvestors,
	buyStock,
	sellStock,
	search,
};