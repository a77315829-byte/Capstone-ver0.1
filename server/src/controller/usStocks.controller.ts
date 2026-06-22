import {
	Request,
	Response,
} from "express";

import {
	fetchUsHistoricalStockData,
	fetchUsStockData,
	searchUsStocks,
	UsChartPeriod,
} from "../utils/requests";

import {
	getUsMarketStatus,
} from "../services/usMarketSession.service";

function getStatusCode(
	error: any,
): number {
	const status =
		Number(
			error?.statusCode ||
				error?.response?.status ||
				500,
		);

	return (
		status >= 400 &&
		status < 600
			? status
			: 500
	);
}

function sendError(
	res: Response,
	error: any,
	fallbackMessage: string,
) {
	return res
		.status(
			getStatusCode(error),
		)
		.json({
			success: false,
			message:
				error?.message ||
				fallbackMessage,
		});
}

export async function search(
	req: Request,
	res: Response,
) {
	try {
		const results =
			await searchUsStocks(
				req.params.query ||
					"",
			);

		return res.status(200).json({
			success: true,
			data: results,
		});
	} catch (error) {
		return sendError(
			res,
			error,
			"미국 종목 검색에 실패했습니다.",
		);
	}
}

export async function getInfo(
	req: Request,
	res: Response,
) {
	try {
		const data =
			await fetchUsStockData(
				req.params.symbol,
				req.params.exchange,
			);

		return res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		return sendError(
			res,
			error,
			"미국 종목 시세 조회에 실패했습니다.",
		);
	}
}

export async function getHistorical(
	req: Request,
	res: Response,
) {
	try {
		const period =
			String(
				req.query.period ||
					"1m",
			) as UsChartPeriod;

		const data =
			await fetchUsHistoricalStockData(
				req.params.symbol,
				req.params.exchange,
				period,
			);

		return res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		return sendError(
			res,
			error,
			"미국 종목 차트 조회에 실패했습니다.",
		);
	}
}

export function getMarketStatus(
	_req: Request,
	res: Response,
) {
	return res.status(200).json({
		success: true,
		data:
			getUsMarketStatus(),
	});
}

export default {
	search,
	getInfo,
	getHistorical,
	getMarketStatus,
};
