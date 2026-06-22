import {
	Request,
	Response,
} from "express";

import {
	cancelUsTradeOrder,
	checkUsPendingOrders,
	createUsTradeOrder,
	getUsAccountSummary,
	getUsPortfolio,
	getUsTradeOrders,
	resetUsTradingAccount,
} from "../services/usTrading.service";

function getAuthenticatedUserId(
	req: Request,
): string {
	return String(
		(req as any).userId ??
			req.body?.userId ??
			"",
	);
}

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

export async function getAccount(
	req: Request,
	res: Response,
) {
	try {
		const data =
			await getUsAccountSummary(
				getAuthenticatedUserId(
					req,
				),
			);

		return res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		return sendError(
			res,
			error,
			"미국 모의계좌 조회에 실패했습니다.",
		);
	}
}

export async function getPortfolio(
	req: Request,
	res: Response,
) {
	try {
		const data =
			await getUsPortfolio(
				getAuthenticatedUserId(
					req,
				),
				{
					evaluate:
						req.query
							.evaluate ===
						"true",
				},
			);

		return res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		return sendError(
			res,
			error,
			"미국 포트폴리오 조회에 실패했습니다.",
		);
	}
}

export async function getOrders(
	req: Request,
	res: Response,
) {
	try {
		const data =
			await getUsTradeOrders({
				userId:
					getAuthenticatedUserId(
						req,
					),
				status:
					req.query.status?.toString(),
				limit:
					Number(
						req.query.limit ||
							50,
					),
			});

		return res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		return sendError(
			res,
			error,
			"미국 주문내역 조회에 실패했습니다.",
		);
	}
}

export async function postOrder(
	req: Request,
	res: Response,
) {
	try {
		const data =
			await createUsTradeOrder({
				userId:
					getAuthenticatedUserId(
						req,
					),
				symbol:
					req.body.symbol,
				name:
					req.body.name,
				exchange:
					req.body.exchange,
				side:
					req.body.side,
				orderType:
					req.body.orderType,
				quantity:
					req.body.quantity,
				limitPrice:
					req.body.limitPrice,
			});

		return res.status(201).json({
			success: true,
			data,
		});
	} catch (error) {
		return sendError(
			res,
			error,
			"미국 주식 주문 처리에 실패했습니다.",
		);
	}
}

export async function cancelOrder(
	req: Request,
	res: Response,
) {
	try {
		const data =
			await cancelUsTradeOrder({
				userId:
					getAuthenticatedUserId(
						req,
					),
				orderId:
					req.params.orderId,
			});

		return res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		return sendError(
			res,
			error,
			"미국 주문 취소에 실패했습니다.",
		);
	}
}

export async function checkPending(
	req: Request,
	res: Response,
) {
	try {
		const data =
			await checkUsPendingOrders(
				getAuthenticatedUserId(
					req,
				),
			);

		return res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		return sendError(
			res,
			error,
			"미국 미체결 주문 확인에 실패했습니다.",
		);
	}
}

export async function reset(
	req: Request,
	res: Response,
) {
	try {
		const data =
			await resetUsTradingAccount(
				getAuthenticatedUserId(
					req,
				),
			);

		return res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		return sendError(
			res,
			error,
			"미국 모의계좌 초기화에 실패했습니다.",
		);
	}
}

export default {
	getAccount,
	getPortfolio,
	getOrders,
	postOrder,
	cancelOrder,
	checkPending,
	reset,
};
