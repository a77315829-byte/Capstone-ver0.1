import {
	Request,
	Response,
} from "express";
import mongoose from "mongoose";

import {
	cancelTradeOrder,
	checkPendingOrders,
	createTradeOrder,
	getPortfolio,
	getTradeOrders,
	getTradingAccountSummary,
	resetDemoTradingAccount,
} from "../services/trading.service";

interface AuthenticatedRequest extends Request {
	userId?: string;
}

const getErrorMessage = (
	error: unknown,
): string => {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
};

const getStatusCode = (
	error: unknown,
): number => {
	const target = error as {
		statusCode?: number;
		response?: {
			status?: number;
		};
	};

	const statusCode = Number(
		target?.statusCode ??
			target?.response?.status ??
			500,
	);

	return statusCode >= 400 &&
		statusCode < 600
		? statusCode
		: 500;
};

const sendError = (
	res: Response,
	error: unknown,
	fallbackMessage: string,
) => {
	return res
		.status(getStatusCode(error))
		.json({
			success: false,
			error: fallbackMessage,
			message: getErrorMessage(error),
		});
};

/**
 * authJwt.verifyToken이 토큰에서 추출해 넣은
 * 로그인 사용자 ID만 사용합니다.
 */
const getAuthenticatedUserId = (
	req: Request,
): string => {
	const userId = String(
		(req as AuthenticatedRequest).userId ??
			"",
	);

	if (
		!userId ||
		!mongoose.Types.ObjectId.isValid(userId)
	) {
		const error = new Error(
			"로그인 사용자 정보를 확인할 수 없습니다.",
		) as Error & {
			statusCode: number;
		};

		error.statusCode = 401;
		throw error;
	}

	return userId;
};

export const getAccount = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId =
			getAuthenticatedUserId(req);

		const account =
			await getTradingAccountSummary(
				userId,
			);

		return res.status(200).json({
			success: true,
			data: account,
		});
	} catch (error) {
		console.error(
			"getAccount error:",
			error,
		);

		return sendError(
			res,
			error,
			"계좌 정보를 불러오지 못했습니다.",
		);
	}
};

export const getUserPortfolio = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId =
			getAuthenticatedUserId(req);

		const evaluate =
			req.query.evaluate === "true";

		const portfolio =
			await getPortfolio(userId, {
				evaluate,
			});

		return res.status(200).json({
			success: true,
			data: portfolio,
		});
	} catch (error) {
		console.error(
			"getUserPortfolio error:",
			error,
		);

		return sendError(
			res,
			error,
			"포트폴리오를 불러오지 못했습니다.",
		);
	}
};

export const getOrders = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId =
			getAuthenticatedUserId(req);

		const status =
			req.query.status?.toString();

		const limit = Number(
			req.query.limit ?? 50,
		);

		const orders =
			await getTradeOrders({
				userId,
				status,
				limit,
			});

		return res.status(200).json({
			success: true,
			data: orders,
		});
	} catch (error) {
		console.error(
			"getOrders error:",
			error,
		);

		return sendError(
			res,
			error,
			"주문내역을 불러오지 못했습니다.",
		);
	}
};

export const postOrder = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId =
			getAuthenticatedUserId(req);

		const order =
			await createTradeOrder({
				userId,
				symbol: req.body.symbol,
				name: req.body.name,
				side: req.body.side,
				orderType:
					req.body.orderType,
				quantity:
					req.body.quantity,
				limitPrice:
					req.body.limitPrice,
			});

		return res.status(201).json({
			success: true,
			data: order,
		});
	} catch (error) {
		console.error(
			"postOrder error:",
			error,
		);

		return sendError(
			res,
			error,
			"주문 처리에 실패했습니다.",
		);
	}
};

export const cancelOrder = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId =
			getAuthenticatedUserId(req);

		const order =
			await cancelTradeOrder({
				userId,
				orderId:
					req.params.orderId,
			});

		return res.status(200).json({
			success: true,
			data: order,
		});
	} catch (error) {
		console.error(
			"cancelOrder error:",
			error,
		);

		return sendError(
			res,
			error,
			"주문 취소에 실패했습니다.",
		);
	}
};

export const checkPending = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId =
			getAuthenticatedUserId(req);

		const result =
			await checkPendingOrders(userId);

		return res.status(200).json({
			success: true,
			data: result,
		});
	} catch (error) {
		console.error(
			"checkPending error:",
			error,
		);

		return sendError(
			res,
			error,
			"미체결 주문 확인에 실패했습니다.",
		);
	}
};

export const resetDemo = async (
	req: Request,
	res: Response,
) => {
	try {
		const userId =
			getAuthenticatedUserId(req);

		const account =
			await resetDemoTradingAccount(
				userId,
			);

		return res.status(200).json({
			success: true,
			data: account,
		});
	} catch (error) {
		console.error(
			"resetDemo error:",
			error,
		);

		return sendError(
			res,
			error,
			"모의투자 계좌 초기화에 실패했습니다.",
		);
	}
};

export default {
	getAccount,
	getUserPortfolio,
	getPortfolio: getUserPortfolio,
	getOrders,
	postOrder,
	cancelOrder,
	checkPending,
	resetDemo,
};