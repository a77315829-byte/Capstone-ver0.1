import {
	US_EXCHANGE_NAME,
	UsExchangeCode,
	UsMarketName,
} from "../data/usStocks";

import UsTradingAccount, {
	UsTradingAccountDocument,
} from "../models/usTradingAccount.model";

import FundingTransaction from "../models/fundingTransaction.model";

import UsHolding, {
	UsHoldingDocument,
} from "../models/usHolding.model";

import UsTradeOrder, {
	UsTradeOrderDocument,
	UsTradeOrderStatus,
	UsTradeOrderType,
	UsTradeSide,
} from "../models/usTradeOrder.model";

import {
	fetchUsStockData,
	normalizeUsStockSymbol,
} from "../utils/requests";

import {
	getUsMarketStatus,
} from "./usMarketSession.service";

const DEFAULT_INITIAL_USD =
	0;

export const MANUAL_US_TOP_UP_AMOUNT =
	1_000;

type CreateUsOrderInput = {
	userId?: string;

	symbol: string;
	name?: string;

	exchange: UsExchangeCode;

	side: UsTradeSide;
	orderType: UsTradeOrderType;

	quantity: number;
	limitPrice?: number;
};

function createServiceError(
	statusCode: number,
	message: string,
) {
	const error =
		new Error(message) as Error & {
			statusCode?: number;
		};

	error.statusCode =
		statusCode;

	return error;
}

function getUserId(
	userId?: string,
): string {
	const normalized =
		userId?.trim();

	if (!normalized) {
		throw createServiceError(
			401,
			"로그인 사용자 정보를 확인할 수 없습니다.",
		);
	}

	return normalized;
}

function assertExchange(
	exchange: string,
): UsExchangeCode {
	const normalized =
		String(exchange || "")
			.trim()
			.toUpperCase();

	if (
		normalized !== "NAS" &&
		normalized !== "NYS" &&
		normalized !== "AMS"
	) {
		throw createServiceError(
			400,
			"지원하지 않는 미국 거래소입니다.",
		);
	}

	return normalized;
}

function toPositiveInteger(
	value: unknown,
	fieldName: string,
): number {
	const parsed =
		Number(value);

	if (
		!Number.isFinite(parsed) ||
		parsed <= 0
	) {
		throw createServiceError(
			400,
			`${fieldName}은 1 이상이어야 합니다.`,
		);
	}

	return Math.floor(parsed);
}

function toPositiveMoney(
	value: unknown,
	fieldName: string,
): number {
	const parsed =
		Number(value);

	if (
		!Number.isFinite(parsed) ||
		parsed <= 0
	) {
		throw createServiceError(
			400,
			`${fieldName}은 0보다 커야 합니다.`,
		);
	}

	return roundUsd(parsed);
}

function roundUsd(
	value: number,
): number {
	return (
		Math.round(
			(value +
				Number.EPSILON) *
				100,
		) / 100
	);
}

async function getOrCreateAccount(
	userId: string,
): Promise<UsTradingAccountDocument> {
	let account =
		await UsTradingAccount.findOne({
			userId,
		});

	if (!account) {
		account =
			await UsTradingAccount.create({
				userId,
				cash:
					DEFAULT_INITIAL_USD,
				reservedCash: 0,
				initialCash:
					DEFAULT_INITIAL_USD,
				totalDeposits: 0,
				manualDeposits: 0,
				currency: "USD",
			});
	}

	return account;
}

function getAvailableCash(
	account:
		UsTradingAccountDocument,
): number {
	return roundUsd(
		Math.max(
			Number(account.cash || 0) -
				Number(
					account.reservedCash ||
						0,
				),
			0,
		),
	);
}

function getAvailableQuantity(
	holding:
		| UsHoldingDocument
		| null,
): number {
	if (!holding) {
		return 0;
	}

	return Math.max(
		Number(holding.quantity || 0) -
			Number(
				holding.reservedQuantity ||
					0,
			),
		0,
	);
}

async function getQuote(
	symbol: string,
	exchange: UsExchangeCode,
) {
	const quote =
		await fetchUsStockData(
			symbol,
			exchange,
		);

	if (
		!quote ||
		Number(quote.price) <= 0
	) {
		throw createServiceError(
			502,
			"미국 주식 현재가를 불러오지 못했습니다.",
		);
	}

	return {
		...quote,
		price:
			roundUsd(
				Number(
					quote.price,
				),
			),
	};
}

async function upsertBuyHolding(
	params: {
		userId: string;
		symbol: string;
		name: string;

		exchange:
			UsExchangeCode;
		market:
			UsMarketName;

		quantity: number;
		price: number;
	},
) {
	const {
		userId,
		symbol,
		name,
		exchange,
		market,
		quantity,
		price,
	} = params;

	let holding =
		await UsHolding.findOne({
			userId,
			exchange,
			symbol,
		});

	if (!holding) {
		return UsHolding.create({
			userId,
			symbol,
			name,
			exchange,
			market,
			currency: "USD",
			quantity,
			reservedQuantity: 0,
			avgPrice: price,
			totalBuyAmount:
				roundUsd(
					price *
						quantity,
				),
		});
	}

	const oldQuantity =
		Number(
			holding.quantity ||
				0,
		);

	const oldTotal =
		Number(
			holding.totalBuyAmount ||
				holding.avgPrice *
					oldQuantity,
		);

	const newTotal =
		roundUsd(
			oldTotal +
				price * quantity,
		);

	const newQuantity =
		oldQuantity +
		quantity;

	holding.quantity =
		newQuantity;

	holding.totalBuyAmount =
		newTotal;

	holding.avgPrice =
		newQuantity > 0
			? roundUsd(
					newTotal /
						newQuantity,
				)
			: 0;

	holding.name = name;
	holding.market = market;

	await holding.save();

	return holding;
}

async function executeBuy(
	params: {
		userId: string;
		symbol: string;
		name: string;

		exchange:
			UsExchangeCode;
		market:
			UsMarketName;

		quantity: number;
		price: number;

		orderType:
			UsTradeOrderType;
		limitPrice?:
			number | null;

		order?:
			UsTradeOrderDocument;
	},
): Promise<UsTradeOrderDocument> {
	const {
		userId,
		symbol,
		name,
		exchange,
		market,
		quantity,
		price,
		orderType,
		limitPrice,
		order,
	} = params;

	const account =
		await getOrCreateAccount(
			userId,
		);

	const amount =
		roundUsd(
			price * quantity,
		);

	if (order) {
		account.reservedCash =
			roundUsd(
				Math.max(
					Number(
						account.reservedCash ||
							0,
					) -
						Number(
							order.reservedAmount ||
								0,
						),
					0,
				),
			);

		if (
			Number(account.cash || 0) <
			amount
		) {
			order.status =
				"REJECTED";
			order.rejectReason =
				"체결 시점의 달러 현금이 부족합니다.";
			order.reservedAmount =
				0;

			await Promise.all([
				account.save(),
				order.save(),
			]);

			return order;
		}
	} else if (
		getAvailableCash(account) <
		amount
	) {
		throw createServiceError(
			400,
			"주문 가능한 달러 현금이 부족합니다.",
		);
	}

	account.cash =
		roundUsd(
			Number(account.cash || 0) -
				amount,
		);

	await account.save();

	await upsertBuyHolding({
		userId,
		symbol,
		name,
		exchange,
		market,
		quantity,
		price,
	});

	if (order) {
		order.status =
			"FILLED";
		order.filledQuantity =
			quantity;
		order.executedPrice =
			price;
		order.executedAt =
			new Date();
		order.reservedAmount =
			0;

		await order.save();

		return order;
	}

	return UsTradeOrder.create({
		userId,
		symbol,
		name,
		exchange,
		market,
		currency: "USD",

		side: "BUY",
		orderType,
		status: "FILLED",

		quantity,
		filledQuantity:
			quantity,

		orderPrice:
			limitPrice ??
			price,
		limitPrice:
			limitPrice ??
			null,
		executedPrice:
			price,

		reservedAmount: 0,
		reservedQuantity: 0,

		executedAt:
			new Date(),
	});
}

async function executeSell(
	params: {
		userId: string;
		symbol: string;
		name: string;

		exchange:
			UsExchangeCode;
		market:
			UsMarketName;

		quantity: number;
		price: number;

		orderType:
			UsTradeOrderType;
		limitPrice?:
			number | null;

		order?:
			UsTradeOrderDocument;
	},
): Promise<UsTradeOrderDocument> {
	const {
		userId,
		symbol,
		name,
		exchange,
		market,
		quantity,
		price,
		orderType,
		limitPrice,
		order,
	} = params;

	const account =
		await getOrCreateAccount(
			userId,
		);

	const holding =
		await UsHolding.findOne({
			userId,
			exchange,
			symbol,
		});

	if (!holding) {
		if (order) {
			order.status =
				"REJECTED";
			order.rejectReason =
				"보유 종목이 없습니다.";
			order.reservedQuantity =
				0;

			await order.save();

			return order;
		}

		throw createServiceError(
			400,
			"보유하지 않은 미국 종목입니다.",
		);
	}

	if (order) {
		holding.reservedQuantity =
			Math.max(
				Number(
					holding.reservedQuantity ||
						0,
				) -
					Number(
						order.reservedQuantity ||
							0,
					),
				0,
			);
	}

	if (
		Number(holding.quantity || 0) <
		quantity
	) {
		if (order) {
			order.status =
				"REJECTED";
			order.rejectReason =
				"체결 시점의 보유 수량이 부족합니다.";
			order.reservedQuantity =
				0;

			await Promise.all([
				holding.save(),
				order.save(),
			]);

			return order;
		}

		throw createServiceError(
			400,
			"매도 가능한 미국 주식 수량이 부족합니다.",
		);
	}

	if (
		!order &&
		getAvailableQuantity(
			holding,
		) < quantity
	) {
		throw createServiceError(
			400,
			"매도 가능한 미국 주식 수량이 부족합니다.",
		);
	}

	const avgPrice =
		Number(
			holding.avgPrice ||
				0,
		);

	const realizedProfit =
		roundUsd(
			(price -
				avgPrice) *
				quantity,
		);

	holding.quantity -=
		quantity;

	if (holding.quantity <= 0) {
		await UsHolding.deleteOne({
			_id: holding._id,
		});
	} else {
		holding.totalBuyAmount =
			roundUsd(
				Number(
					holding.avgPrice ||
						0,
				) *
					holding.quantity,
			);

		await holding.save();
	}

	account.cash =
		roundUsd(
			Number(account.cash || 0) +
				price * quantity,
		);

	await account.save();

	if (order) {
		order.status =
			"FILLED";
		order.filledQuantity =
			quantity;
		order.executedPrice =
			price;
		order.realizedProfit =
			realizedProfit;
		order.executedAt =
			new Date();
		order.reservedQuantity =
			0;

		await order.save();

		return order;
	}

	return UsTradeOrder.create({
		userId,
		symbol,
		name,
		exchange,
		market,
		currency: "USD",

		side: "SELL",
		orderType,
		status: "FILLED",

		quantity,
		filledQuantity:
			quantity,

		orderPrice:
			limitPrice ??
			price,
		limitPrice:
			limitPrice ??
			null,
		executedPrice:
			price,

		reservedAmount: 0,
		reservedQuantity: 0,

		realizedProfit,

		executedAt:
			new Date(),
	});
}

async function createPendingOrder(
	params: {
		userId: string;
		symbol: string;
		name: string;

		exchange:
			UsExchangeCode;
		market:
			UsMarketName;

		side: UsTradeSide;

		quantity: number;
		limitPrice: number;
	},
) {
	const {
		userId,
		symbol,
		name,
		exchange,
		market,
		side,
		quantity,
		limitPrice,
	} = params;

	const account =
		await getOrCreateAccount(
			userId,
		);

	if (side === "BUY") {
		const reservedAmount =
			roundUsd(
				limitPrice *
					quantity,
			);

		if (
			getAvailableCash(account) <
			reservedAmount
		) {
			throw createServiceError(
				400,
				"예약 매수 가능한 달러 현금이 부족합니다.",
			);
		}

		account.reservedCash =
			roundUsd(
				Number(
					account.reservedCash ||
						0,
				) +
					reservedAmount,
			);

		await account.save();

		return UsTradeOrder.create({
			userId,
			symbol,
			name,
			exchange,
			market,
			currency: "USD",

			side,
			orderType:
				"LIMIT",
			status:
				"PENDING",

			quantity,
			filledQuantity: 0,

			orderPrice:
				limitPrice,
			limitPrice,

			reservedAmount,
			reservedQuantity: 0,
		});
	}

	const holding =
		await UsHolding.findOne({
			userId,
			exchange,
			symbol,
		});

	if (
		getAvailableQuantity(
			holding,
		) < quantity
	) {
		throw createServiceError(
			400,
			"예약 매도 가능한 미국 주식 수량이 부족합니다.",
		);
	}

	holding!.reservedQuantity +=
		quantity;

	await holding!.save();

	return UsTradeOrder.create({
		userId,
		symbol,
		name,
		exchange,
		market,
		currency: "USD",

		side,
		orderType: "LIMIT",
		status: "PENDING",

		quantity,
		filledQuantity: 0,

		orderPrice:
			limitPrice,
		limitPrice,

		reservedAmount: 0,
		reservedQuantity:
			quantity,
	});
}

export async function createUsTradeOrder(
	input: CreateUsOrderInput,
) {
	const userId =
		getUserId(input.userId);

	const symbol =
		normalizeUsStockSymbol(
			input.symbol,
		);

	const exchange =
		assertExchange(
			input.exchange,
		);

	const quantity =
		toPositiveInteger(
			input.quantity,
			"수량",
		);

	if (!symbol) {
		throw createServiceError(
			400,
			"미국 종목 티커가 필요합니다.",
		);
	}

	if (
		input.side !== "BUY" &&
		input.side !== "SELL"
	) {
		throw createServiceError(
			400,
			"주문 방향이 올바르지 않습니다.",
		);
	}

	if (
		input.orderType !==
			"MARKET" &&
		input.orderType !==
			"LIMIT"
	) {
		throw createServiceError(
			400,
			"주문 방식이 올바르지 않습니다.",
		);
	}

	const marketStatus =
		getUsMarketStatus();

	const executionAllowed =
		marketStatus.isOpen ||
		marketStatus
			.orderAllowedByOverride;

	if (
		input.orderType ===
			"MARKET" &&
		!executionAllowed
	) {
		throw createServiceError(
			409,
			"시장가 주문은 미국 정규장 운영시간에만 가능합니다.",
		);
	}

	const quote =
		await getQuote(
			symbol,
			exchange,
		);

	const name =
		input.name ||
		quote.name ||
		symbol;

	const market =
		US_EXCHANGE_NAME[
			exchange
		];

	if (
		input.orderType ===
			"MARKET"
	) {
		if (
			input.side === "BUY"
		) {
			return executeBuy({
				userId,
				symbol,
				name,
				exchange,
				market,
				quantity,
				price:
					quote.price,
				orderType:
					"MARKET",
			});
		}

		return executeSell({
			userId,
			symbol,
			name,
			exchange,
			market,
			quantity,
			price:
				quote.price,
			orderType:
				"MARKET",
		});
	}

	const limitPrice =
		toPositiveMoney(
			input.limitPrice,
			"지정가",
		);

	const conditionMet =
		input.side === "BUY"
			? quote.price <=
				limitPrice
			: quote.price >=
				limitPrice;

	if (
		executionAllowed &&
		conditionMet
	) {
		if (
			input.side === "BUY"
		) {
			return executeBuy({
				userId,
				symbol,
				name,
				exchange,
				market,
				quantity,
				price:
					quote.price,
				orderType:
					"LIMIT",
				limitPrice,
			});
		}

		return executeSell({
			userId,
			symbol,
			name,
			exchange,
			market,
			quantity,
			price:
				quote.price,
			orderType:
				"LIMIT",
			limitPrice,
		});
	}

	return createPendingOrder({
		userId,
		symbol,
		name,
		exchange,
		market,
		side: input.side,
		quantity,
		limitPrice,
	});
}

export async function cancelUsTradeOrder(
	params: {
		userId?: string;
		orderId: string;
	},
) {
	const userId =
		getUserId(
			params.userId,
		);

	const order =
		await UsTradeOrder.findOne({
			_id:
				params.orderId,
			userId,
			status:
				"PENDING",
		});

	if (!order) {
		throw createServiceError(
			404,
			"취소할 수 있는 미국 미체결 주문을 찾지 못했습니다.",
		);
	}

	if (
		order.side === "BUY"
	) {
		const account =
			await getOrCreateAccount(
				userId,
			);

		account.reservedCash =
			roundUsd(
				Math.max(
					Number(
						account.reservedCash ||
							0,
					) -
						Number(
							order.reservedAmount ||
								0,
						),
					0,
				),
			);

		await account.save();
	} else {
		const holding =
			await UsHolding.findOne({
				userId,
				exchange:
					order.exchange,
				symbol:
					order.symbol,
			});

		if (holding) {
			holding.reservedQuantity =
				Math.max(
					Number(
						holding.reservedQuantity ||
							0,
					) -
						Number(
							order.reservedQuantity ||
								0,
						),
					0,
				);

			await holding.save();
		}
	}

	order.status =
		"CANCELED";
	order.canceledAt =
		new Date();
	order.reservedAmount =
		0;
	order.reservedQuantity =
		0;

	await order.save();

	return order;
}

export async function checkUsPendingOrders(
	userIdInput?: string,
) {
	const userId =
		getUserId(
			userIdInput,
		);

	const marketStatus =
		getUsMarketStatus();

	const executionAllowed =
		marketStatus.isOpen ||
		marketStatus
			.orderAllowedByOverride;

	if (!executionAllowed) {
		const pendingCount =
			await UsTradeOrder.countDocuments({
				userId,
				status:
					"PENDING",
				orderType:
					"LIMIT",
			});

		return {
			marketOpen: false,
			marketStatus,
			checkedCount: 0,
			pendingCount,
			filledCount: 0,
			filledOrders: [],
		};
	}

	const pendingOrders =
		await UsTradeOrder.find({
			userId,
			status:
				"PENDING",
			orderType:
				"LIMIT",
		}).sort({
			createdAt: 1,
		});

	const filledOrders:
		UsTradeOrderDocument[] = [];

	for (const order of pendingOrders) {
		try {
			const quote =
				await getQuote(
					order.symbol,
					order.exchange,
				);

			const limitPrice =
				Number(
					order.limitPrice ||
						0,
				);

			const conditionMet =
				order.side === "BUY"
					? quote.price <=
						limitPrice
					: quote.price >=
						limitPrice;

			if (!conditionMet) {
				continue;
			}

			const filled =
				order.side === "BUY"
					? await executeBuy({
							userId,
							symbol:
								order.symbol,
							name:
								order.name,
							exchange:
								order.exchange,
							market:
								order.market,
							quantity:
								order.quantity,
							price:
								quote.price,
							orderType:
								"LIMIT",
							limitPrice,
							order,
						})
					: await executeSell({
							userId,
							symbol:
								order.symbol,
							name:
								order.name,
							exchange:
								order.exchange,
							market:
								order.market,
							quantity:
								order.quantity,
							price:
								quote.price,
							orderType:
								"LIMIT",
							limitPrice,
							order,
						});

			if (
				filled.status ===
				"FILLED"
			) {
				filledOrders.push(
					filled,
				);
			}
		} catch (error) {
			console.error(
				`미국 지정가 체결 확인 실패: ${order.exchange}:${order.symbol}`,
				error,
			);
		}
	}

	const remainingPending =
		await UsTradeOrder.countDocuments({
			userId,
			status:
				"PENDING",
			orderType:
				"LIMIT",
		});

	return {
		marketOpen: true,
		marketStatus,
		checkedCount:
			pendingOrders.length,
		pendingCount:
			remainingPending,
		filledCount:
			filledOrders.length,
		filledOrders,
	};
}

export async function checkAllUsPendingOrders() {
	const marketStatus =
		getUsMarketStatus();

	const executionAllowed =
		marketStatus.isOpen ||
		marketStatus
			.orderAllowedByOverride;

	if (!executionAllowed) {
		return {
			marketOpen: false,
			marketStatus,
			userCount: 0,
			checkedCount: 0,
			filledCount: 0,
		};
	}

	const userIds =
		await UsTradeOrder.distinct(
			"userId",
			{
				status:
					"PENDING",
				orderType:
					"LIMIT",
			},
		);

	let checkedCount = 0;
	let filledCount = 0;

	for (const rawUserId of userIds) {
		const result =
			await checkUsPendingOrders(
				String(
					rawUserId,
				),
			);

		checkedCount +=
			Number(
				result.checkedCount ||
					0,
			);

		filledCount +=
			Number(
				result.filledCount ||
					0,
			);
	}

	return {
		marketOpen: true,
		marketStatus,
		userCount:
			userIds.length,
		checkedCount,
		filledCount,
	};
}

function serializeAccount(
	account:
		UsTradingAccountDocument,
) {
	return {
		userId:
			account.userId,
		cash:
			roundUsd(
				Number(
					account.cash ||
						0,
				),
			),
		reservedCash:
			roundUsd(
				Number(
					account.reservedCash ||
						0,
				),
			),
		availableCash:
			getAvailableCash(
				account,
			),
		initialCash:
			roundUsd(
				Number(
					account.initialCash ??
						DEFAULT_INITIAL_USD,
				),
			),
		totalDeposits:
			roundUsd(
				Number(
					account.totalDeposits ??
						0,
				),
			),
		manualDeposits:
			roundUsd(
				Number(
					account.manualDeposits ??
						0,
				),
			),
		currency: "USD",
	};
}

export async function getUsAccountSummary(
	userIdInput?: string,
) {
	const userId =
		getUserId(
			userIdInput,
		);

	const account =
		await getOrCreateAccount(
			userId,
		);

	return serializeAccount(
		account,
	);
}

export async function getUsPortfolio(
	userIdInput?: string,
	options?: {
		evaluate?: boolean;
	},
) {
	const userId =
		getUserId(
			userIdInput,
		);

	const account =
		await getOrCreateAccount(
			userId,
		);

	const holdings =
		await UsHolding.find({
			userId,
		}).sort({
			createdAt: 1,
		});

	const evaluatedHoldings =
		await Promise.all(
			holdings.map(
				async (holding) => {
					let currentPrice =
						Number(
							holding.avgPrice ||
								0,
						);

					let changeRate = 0;

					if (
						options?.evaluate
					) {
						try {
							const quote =
								await getQuote(
									holding.symbol,
									holding.exchange,
								);

							currentPrice =
								quote.price;
							changeRate =
								Number(
									quote.changeRate ||
										0,
								);
						} catch (error) {
							console.error(
								`미국 보유종목 평가 실패: ${holding.symbol}`,
								error,
							);
						}
					}

					const evaluationAmount =
						roundUsd(
							currentPrice *
								holding.quantity,
						);

					const buyAmount =
						roundUsd(
							Number(
								holding.avgPrice ||
									0,
							) *
								holding.quantity,
						);

					const profitLoss =
						roundUsd(
							evaluationAmount -
								buyAmount,
						);

					const profitLossRate =
						buyAmount > 0
							? roundUsd(
									(profitLoss /
										buyAmount) *
										100,
								)
							: 0;

					return {
						id:
							String(
								holding._id,
							),
						symbol:
							holding.symbol,
						name:
							holding.name,
						exchange:
							holding.exchange,
						market:
							holding.market,
						currency:
							"USD",
						quantity:
							holding.quantity,
						reservedQuantity:
							holding.reservedQuantity,
						availableQuantity:
							getAvailableQuantity(
								holding,
							),
						avgPrice:
							roundUsd(
								holding.avgPrice,
							),
						currentPrice,
						changeRate,
						evaluationAmount,
						buyAmount,
						profitLoss,
						profitLossRate,
					};
				},
			),
		);

	const totalEvaluationAmount =
		roundUsd(
			evaluatedHoldings.reduce(
				(sum, holding) =>
					sum +
					holding.evaluationAmount,
				0,
			),
		);

	const totalBuyAmount =
		roundUsd(
			evaluatedHoldings.reduce(
				(sum, holding) =>
					sum +
					holding.buyAmount,
				0,
			),
		);

	const totalAsset =
		roundUsd(
			Number(
				account.cash ||
					0,
			) +
				totalEvaluationAmount,
		);

	const initialCash =
		Number(
			account.initialCash ??
				DEFAULT_INITIAL_USD,
		);

	const totalDeposits =
		Number(
			account.totalDeposits ??
				0,
		);

	const totalProfitLoss =
		roundUsd(
			totalAsset -
				initialCash -
				totalDeposits,
		);

	const investedCapital =
		roundUsd(
			initialCash +
				totalDeposits,
		);

	return {
		account: {
			...serializeAccount(
				account,
			),
			totalAsset,
			totalEvaluationAmount,
			totalBuyAmount,
			totalProfitLoss,
			totalProfitLossRate:
				investedCapital > 0
					? roundUsd(
							(totalProfitLoss /
								investedCapital) *
								100,
						)
					: 0,
		},
		holdings:
			evaluatedHoldings,
	};
}

export async function getUsTradeOrders(
	params: {
		userId?: string;
		status?: string;
		limit?: number;
	},
) {
	const userId =
		getUserId(
			params.userId,
		);

	const filter: {
		userId: string;
		status?:
			UsTradeOrderStatus;
	} = {
		userId,
	};

	if (
		params.status &&
		[
			"PENDING",
			"FILLED",
			"CANCELED",
			"REJECTED",
		].includes(
			params.status,
		)
	) {
		filter.status =
			params.status as
				UsTradeOrderStatus;
	}

	const limit =
		Math.min(
			Math.max(
				Number(
					params.limit ||
						50,
				),
				1,
			),
			200,
		);

	return UsTradeOrder.find(
		filter,
	)
		.sort({
			createdAt: -1,
		})
		.limit(limit)
		.lean();
}

export async function topUpUsTradingAccount(
	userIdInput?: string,
) {
	const userId =
		getUserId(
			userIdInput,
		);

	const account =
		await getOrCreateAccount(
			userId,
		);

	const fundingRecord =
		await FundingTransaction.create({
			userId,
			market: "US",
			type: "MANUAL_TOP_UP",
			amount:
				MANUAL_US_TOP_UP_AMOUNT,
			currency: "USD",
		});

	try {
		await UsTradingAccount.updateOne(
			{
				_id: account._id,
			},
			{
				$inc: {
					cash:
						MANUAL_US_TOP_UP_AMOUNT,
					totalDeposits:
						MANUAL_US_TOP_UP_AMOUNT,
					manualDeposits:
						MANUAL_US_TOP_UP_AMOUNT,
				},
			},
		);
	} catch (error) {
		await FundingTransaction.deleteOne({
			_id: fundingRecord._id,
		});
		throw error;
	}

	const updatedAccount =
		await UsTradingAccount.findOne({
			userId,
		});

	if (!updatedAccount) {
		throw createServiceError(
			500,
			"미국 모의계좌를 갱신하지 못했습니다.",
		);
	}

	return {
		amount:
			MANUAL_US_TOP_UP_AMOUNT,
		account:
			serializeAccount(
				updatedAccount,
			),
	};
}

export async function resetUsTradingAccount(
	userIdInput?: string,
) {
	const userId =
		getUserId(
			userIdInput,
		);

	await Promise.all([
		UsHolding.deleteMany({
			userId,
		}),
		UsTradeOrder.deleteMany({
			userId,
		}),
		FundingTransaction.deleteMany({
			userId,
			market: "US",
		}),
	]);

	const account =
		await UsTradingAccount.findOneAndUpdate(
			{
				userId,
			},
			{
				$set: {
					cash:
						DEFAULT_INITIAL_USD,
					reservedCash: 0,
					initialCash:
						DEFAULT_INITIAL_USD,
					totalDeposits: 0,
					manualDeposits: 0,
					currency: "USD",
				},
				$setOnInsert: {
					userId,
				},
			},
			{
				new: true,
				upsert: true,
				runValidators: true,
			},
		);

	return serializeAccount(
		account,
	);
}
