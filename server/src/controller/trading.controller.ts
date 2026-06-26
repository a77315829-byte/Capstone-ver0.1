import {
	Request,
	Response,
} from "express";

import {
	cancelTradeOrder,
	checkPendingOrders,
	createTradeOrder,
	enableSalaryPlanMonthlyFunding,
	getPortfolio,
	getTradeOrders,
	getTradingAccountSummary,
	resetDemoTradingAccount,
	topUpTradingAccount,
} from "../services/trading.service";

type AuthenticatedRequest =
	Request & {
		userId?: string;
	};

const getErrorMessage = (
	error: any,
): string => {
	return (
		error?.message ||
		String(error)
	);
};

const getStatusCode = (
	error: any,
): number => {
	const statusCode =
		Number(
			error?.statusCode ||
				error?.response
					?.status ||
				500,
		);

	return statusCode >= 400 &&
		statusCode < 600
		? statusCode
		: 500;
};

const sendError = (
	res: Response,
	error: any,
	fallbackMessage: string,
) => {
	return res
		.status(
			getStatusCode(
				error,
			),
		)
		.json({
			success: false,
			error:
				fallbackMessage,
			message:
				getErrorMessage(
					error,
				),
		});
};

const getRequestUserId = (
	req: Request,
): string | undefined => {
	const authenticatedReq =
		req as AuthenticatedRequest;

	return (
		authenticatedReq.userId ||
		req.body?.userId ||
		req.query.userId?.toString()
	);
};

export const getAccount =
	async (
		req: Request,
		res: Response,
	) => {
		try {
			const userId =
				getRequestUserId(
					req,
				);

			const account =
				await getTradingAccountSummary(
					userId,
				);

			return res
				.status(200)
				.json({
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

export const getUserPortfolio =
	async (
		req: Request,
		res: Response,
	) => {
		try {
			const userId =
				getRequestUserId(
					req,
				);

			const evaluate =
				req.query
					.evaluate ===
				"true";

			const portfolio =
				await getPortfolio(
					userId,
					{
						evaluate,
					},
				);

			return res
				.status(200)
				.json({
					success: true,
					data:
						portfolio,
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

export const getOrders =
	async (
		req: Request,
		res: Response,
	) => {
		try {
			const userId =
				getRequestUserId(
					req,
				);

			const status =
				req.query.status
					?.toString();

			const limit =
				Number(
					req.query
						.limit ||
						50,
				);

			const orders =
				await getTradeOrders({
					userId,
					status,
					limit,
				});

			return res
				.status(200)
				.json({
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

export const postOrder =
	async (
		req: Request,
		res: Response,
	) => {
		try {
			const order =
				await createTradeOrder({
					userId:
						getRequestUserId(
							req,
						),
					symbol:
						req.body
							.symbol,
					name:
						req.body
							.name,
					side:
						req.body
							.side,
					orderType:
						req.body
							.orderType,
					quantity:
						req.body
							.quantity,
					limitPrice:
						req.body
							.limitPrice,
				});

			return res
				.status(201)
				.json({
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

export const cancelOrder =
	async (
		req: Request,
		res: Response,
	) => {
		try {
			const order =
				await cancelTradeOrder({
					userId:
						getRequestUserId(
							req,
						),
					orderId:
						req.params
							.orderId,
				});

			return res
				.status(200)
				.json({
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

export const checkPending =
	async (
		req: Request,
		res: Response,
	) => {
		try {
			const result =
				await checkPendingOrders(
					getRequestUserId(
						req,
					),
				);

			return res
				.status(200)
				.json({
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

export const topUp =
	async (
		req: Request,
		res: Response,
	) => {
		try {
			const result =
				await topUpTradingAccount(
					getRequestUserId(
						req,
					),
				);

			return res
				.status(200)
				.json({
					success: true,
					data: result,
				});
		} catch (error) {
			console.error(
				"topUp error:",
				error,
			);

			return sendError(
				res,
				error,
				"모의투자 충전에 실패했습니다.",
			);
		}
	};

export const enableSalaryFunding =
	async (
		req: Request,
		res: Response,
	) => {
		try {
			const result =
				await enableSalaryPlanMonthlyFunding(
					getRequestUserId(
						req,
					),
				);

			return res
				.status(200)
				.json({
					success: true,
					data: result,
				});
		} catch (error) {
			console.error(
				"enableSalaryFunding error:",
				error,
			);

			return sendError(
				res,
				error,
				"월 모의투자 입금 설정에 실패했습니다.",
			);
		}
	};

export const resetDemo =
	async (
		req: Request,
		res: Response,
	) => {
		try {
			const account =
				await resetDemoTradingAccount(
					getRequestUserId(
						req,
					),
				);

			return res
				.status(200)
				.json({
					success: true,
					data:
						account,
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
	getPortfolio:
		getUserPortfolio,
	getOrders,
	postOrder,
	cancelOrder,
	checkPending,
	topUp,
	enableSalaryFunding,
	resetDemo,
};
