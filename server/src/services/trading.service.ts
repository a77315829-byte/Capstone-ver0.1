import TradingAccount from "../models/tradingAccount.model";
import FundingTransaction from "../models/fundingTransaction.model";
import SalaryAiPlan from "../models/salaryAiPlan.model";
import Holding from "../models/holding.model";
import TradeOrder, {
	TradeOrderDocument,
	TradeOrderType,
	TradeSide,
} from "../models/tradeOrder.model";

import { fetchStockData, normalizeStockSymbol } from "../utils/requests";
import { getKrxMarketStatus } from "./marketSession.service";

const DEFAULT_INITIAL_CASH = 0;
export const MANUAL_TOP_UP_AMOUNT = 1_000_000;

type CreateOrderInput = {
	userId?: string;
	symbol: string;
	name?: string;
	side: TradeSide;
	orderType: TradeOrderType;
	quantity: number;
	limitPrice?: number;
};

const getUserId = (userId?: string) => {
	const normalizedUserId =
		userId?.trim();

	if (!normalizedUserId) {
		throw createServiceError(
			401,
			"로그인 사용자 정보를 확인할 수 없습니다.",
		);
	}

	return normalizedUserId;
};

const toPositiveInteger = (value: any, fieldName: string): number => {
	const parsed = Number(value);

	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw createServiceError(400, `${fieldName}은 1 이상이어야 합니다.`);
	}

	return Math.floor(parsed);
};

const toPositiveNumber = (value: any, fieldName: string): number => {
	const parsed = Number(value);

	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw createServiceError(400, `${fieldName}은 0보다 커야 합니다.`);
	}

	return parsed;
};

const createServiceError = (statusCode: number, message: string) => {
	const error = new Error(message) as Error & { statusCode?: number };
	error.statusCode = statusCode;
	return error;
};

export const getOrCreateAccount = async (userIdInput?: string) => {
	const userId = getUserId(userIdInput);

	let account = await TradingAccount.findOne({ userId });

	if (!account) {
		account = await TradingAccount.create({
			userId,
			cash: DEFAULT_INITIAL_CASH,
			reservedCash: 0,
			initialCash: DEFAULT_INITIAL_CASH,
			totalDeposits: 0,
			manualDeposits: 0,
			salaryPlanDeposits: 0,
			salaryPlanFundingEnabled: false,
			salaryPlanFundingAmount: 0,
			currency: "KRW",
		});
	}

	return account;
};

const getAvailableCash = (account: any) => {
	return Math.max(Number(account.cash || 0) - Number(account.reservedCash || 0), 0);
};



const getKoreaMonthKey = (date = new Date()): string => {
	const koreaTime = new Date(
		date.getTime() +
			9 * 60 * 60 * 1000,
	);

	const year =
		koreaTime.getUTCFullYear();
	const month = String(
		koreaTime.getUTCMonth() + 1,
	).padStart(2, "0");

	return `${year}-${month}`;
};

const isDuplicateKeyError = (
	error: any,
): boolean =>
	Number(error?.code) === 11000;

const getLatestSalaryPlanFunding = async (
	userId: string,
) => {
	const plan =
		await SalaryAiPlan.findOne({
			userId,
		})
			.select(
				"_id result generatedAt",
			)
			.lean();

	const amount = Math.floor(
		Number(
			plan?.result
				?.allocation
				?.investmentPractice ??
				0,
		),
	);

	return {
		plan,
		amount:
			Number.isFinite(amount) &&
			amount > 0
				? amount
				: 0,
	};
};

const serializeTradingAccount = (
	account: any,
) => {
	const initialCash = Number(
		account.initialCash ?? 0,
	);
	const totalDeposits = Number(
		account.totalDeposits ?? 0,
	);

	return {
		userId: account.userId,
		cash: Number(account.cash ?? 0),
		reservedCash: Number(
			account.reservedCash ?? 0,
		),
		availableCash:
			getAvailableCash(account),
		initialCash,
		totalDeposits,
		manualDeposits: Number(
			account.manualDeposits ?? 0,
		),
		salaryPlanDeposits: Number(
			account.salaryPlanDeposits ?? 0,
		),
		salaryPlanFunding: {
			enabled:
				account.salaryPlanFundingEnabled ===
				true,
			amount: Number(
				account.salaryPlanFundingAmount ??
					0,
			),
			planId:
				account.salaryPlanId ?? null,
			lastAppliedPeriod:
				account.lastSalaryFundingPeriod ??
				null,
		},
		currency: account.currency,
	};
};

export const applyMonthlySalaryPlanFundingIfDue =
	async (
		userIdInput?: string,
	) => {
		const userId = getUserId(
			userIdInput,
		);
		const account =
			await getOrCreateAccount(userId);

		if (
			account.salaryPlanFundingEnabled !==
			true
		) {
			return {
				applied: false,
				reason: "DISABLED",
			};
		}

		const { plan, amount } =
			await getLatestSalaryPlanFunding(
				userId,
			);

		if (!plan || amount <= 0) {
			return {
				applied: false,
				reason: "NO_FUNDING_AMOUNT",
			};
		}

		const periodKey =
			getKoreaMonthKey();
		const planId = String(plan._id);
		const fundingKey =
			`SALARY_PLAN_MONTHLY:${periodKey}`;

		let fundingRecord: any;

		try {
			fundingRecord =
				await FundingTransaction.create({
					userId,
					market: "KR",
					type: "SALARY_PLAN_MONTHLY",
					amount,
					currency: "KRW",
					fundingKey,
					referenceId: planId,
					periodKey,
				});
		} catch (error) {
			if (isDuplicateKeyError(error)) {
				return {
					applied: false,
					reason: "ALREADY_APPLIED",
					periodKey,
				};
			}

			throw error;
		}

		try {
			await TradingAccount.updateOne(
				{
					_id: account._id,
				},
				{
					$inc: {
						cash: amount,
						totalDeposits: amount,
						salaryPlanDeposits:
							amount,
					},
					$set: {
						salaryPlanFundingAmount:
							amount,
						salaryPlanId: planId,
						lastSalaryFundingPeriod:
							periodKey,
					},
				},
			);
		} catch (error) {
			await FundingTransaction.deleteOne({
				_id: fundingRecord._id,
			});
			throw error;
		}

		return {
			applied: true,
			amount,
			periodKey,
			planId,
		};
	};

export async function enableSalaryPlanMonthlyFunding(
	userIdInput?: string,
) {
		const userId = getUserId(
			userIdInput,
		);
		const { plan, amount } =
			await getLatestSalaryPlanFunding(
				userId,
			);

		if (!plan) {
			throw createServiceError(
				404,
				"저장된 전역 자금 플랜이 없습니다.",
			);
		}

		if (amount <= 0) {
			throw createServiceError(
				400,
				"플랜의 모의투자 학습 금액이 0원입니다.",
			);
		}

		const account =
			await getOrCreateAccount(userId);

		account.salaryPlanFundingEnabled =
			true;
		account.salaryPlanFundingAmount =
			amount;
		account.salaryPlanId = String(
			plan._id,
		);
		await account.save();

		const funding =
			await applyMonthlySalaryPlanFundingIfDue(
				userId,
			);
		const updatedAccount =
			await TradingAccount.findOne({
				userId,
			});

		if (!updatedAccount) {
			throw createServiceError(
				500,
				"모의투자 계좌를 갱신하지 못했습니다.",
			);
		}

		return {
			funding,
			account:
				serializeTradingAccount(
					updatedAccount,
				),
		};
}

export async function topUpTradingAccount(
	userIdInput?: string,
) {
		const userId = getUserId(
			userIdInput,
		);
		const account =
			await getOrCreateAccount(userId);

		const fundingRecord =
			await FundingTransaction.create({
				userId,
				market: "KR",
				type: "MANUAL_TOP_UP",
				amount: MANUAL_TOP_UP_AMOUNT,
				currency: "KRW",
			});

		try {
			await TradingAccount.updateOne(
				{
					_id: account._id,
				},
				{
					$inc: {
						cash: MANUAL_TOP_UP_AMOUNT,
						totalDeposits:
							MANUAL_TOP_UP_AMOUNT,
						manualDeposits:
							MANUAL_TOP_UP_AMOUNT,
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
			await TradingAccount.findOne({
				userId,
			});

		if (!updatedAccount) {
			throw createServiceError(
				500,
				"모의투자 계좌를 갱신하지 못했습니다.",
			);
		}

		return {
			amount: MANUAL_TOP_UP_AMOUNT,
			account:
				serializeTradingAccount(
					updatedAccount,
				),
		};
}

const getAvailableQuantity = (holding: any) => {
	if (!holding) return 0;

	return Math.max(
		Number(holding.quantity || 0) - Number(holding.reservedQuantity || 0),
		0,
	);
};

const getCurrentQuote = async (symbol: string) => {
	const normalizedSymbol = normalizeStockSymbol(symbol);
	const stock = await fetchStockData(normalizedSymbol);

	const price = Number(stock.price ?? stock.regularMarketPrice ?? 0);

	if (!Number.isFinite(price) || price <= 0) {
		throw createServiceError(502, "현재가를 불러오지 못했습니다.");
	}

	return {
		symbol: normalizedSymbol,
		name: stock.name ?? stock.longName ?? stock.shortName ?? normalizedSymbol,
		market: stock.market ?? "KRX",
		price,
		changeRate: Number(stock.changeRate ?? stock.regularMarketChangePercent ?? 0),
	};
};

const upsertBuyHolding = async (params: {
	userId: string;
	symbol: string;
	name: string;
	market: string;
	quantity: number;
	price: number;
}) => {
	const { userId, symbol, name, market, quantity, price } = params;

	const holding = await Holding.findOne({ userId, symbol });

	if (!holding) {
		return Holding.create({
			userId,
			symbol,
			name,
			market,
			quantity,
			reservedQuantity: 0,
			avgPrice: price,
			totalBuyAmount: price * quantity,
		});
	}

	const oldQuantity = Number(holding.quantity || 0);
	const oldTotal = Number(holding.avgPrice || 0) * oldQuantity;
	const newTotal = oldTotal + price * quantity;
	const newQuantity = oldQuantity + quantity;

	holding.quantity = newQuantity;
	holding.avgPrice = newQuantity > 0 ? newTotal / newQuantity : 0;
	holding.totalBuyAmount = newTotal;
	holding.name = name;
	holding.market = market;

	await holding.save();

	return holding;
};

const applySellHolding = async (params: {
	userId: string;
	symbol: string;
	quantity: number;
	price: number;
}) => {
	const { userId, symbol, quantity, price } = params;

	const holding = await Holding.findOne({ userId, symbol });

	if (!holding) {
		throw createServiceError(400, "보유하지 않은 종목입니다.");
	}

	const availableQuantity = getAvailableQuantity(holding);

	if (availableQuantity < quantity) {
		throw createServiceError(400, "매도 가능 수량이 부족합니다.");
	}

	const avgPrice = Number(holding.avgPrice || 0);
	const realizedProfit = (price - avgPrice) * quantity;

	holding.quantity -= quantity;

	if (holding.quantity <= 0) {
		await Holding.deleteOne({ _id: holding._id });
	} else {
		holding.totalBuyAmount = holding.avgPrice * holding.quantity;
		await holding.save();
	}

	return {
		realizedProfit,
		avgPrice,
	};
};

const fillMarketBuy = async (params: {
	userId: string;
	symbol: string;
	name: string;
	market: string;
	quantity: number;
	price: number;
	order?: TradeOrderDocument;
}) => {
	const { userId, symbol, name, market, quantity, price, order } = params;

	const account = await getOrCreateAccount(userId);
	const amount = price * quantity;

	if (getAvailableCash(account) < amount) {
		throw createServiceError(400, "주문 가능 현금이 부족합니다.");
	}

	account.cash -= amount;
	await account.save();

	await upsertBuyHolding({
		userId,
		symbol,
		name,
		market,
		quantity,
		price,
	});

	if (order) {
		order.status = "FILLED";
		order.filledQuantity = quantity;
		order.executedPrice = price;
		order.orderPrice = price;
		order.executedAt = new Date();
		await order.save();

		return order;
	}

	return TradeOrder.create({
		userId,
		symbol,
		name,
		market,
		side: "BUY",
		orderType: "MARKET",
		status: "FILLED",
		quantity,
		filledQuantity: quantity,
		orderPrice: price,
		executedPrice: price,
		reservedAmount: 0,
		reservedQuantity: 0,
		executedAt: new Date(),
	});
};

const fillMarketSell = async (params: {
	userId: string;
	symbol: string;
	name: string;
	market: string;
	quantity: number;
	price: number;
	order?: TradeOrderDocument;
}) => {
	const { userId, symbol, name, market, quantity, price, order } = params;

	const account = await getOrCreateAccount(userId);

	const sellResult = await applySellHolding({
		userId,
		symbol,
		quantity,
		price,
	});

	account.cash += price * quantity;
	await account.save();

	if (order) {
		order.status = "FILLED";
		order.filledQuantity = quantity;
		order.executedPrice = price;
		order.orderPrice = price;
		order.realizedProfit = sellResult.realizedProfit;
		order.executedAt = new Date();
		await order.save();

		return order;
	}

	return TradeOrder.create({
		userId,
		symbol,
		name,
		market,
		side: "SELL",
		orderType: "MARKET",
		status: "FILLED",
		quantity,
		filledQuantity: quantity,
		orderPrice: price,
		executedPrice: price,
		reservedAmount: 0,
		reservedQuantity: 0,
		realizedProfit: sellResult.realizedProfit,
		executedAt: new Date(),
	});
};

const createPendingLimitOrder = async (params: {
	userId: string;
	symbol: string;
	name: string;
	market: string;
	side: TradeSide;
	quantity: number;
	limitPrice: number;
}) => {
	const { userId, symbol, name, market, side, quantity, limitPrice } = params;

	const account = await getOrCreateAccount(userId);

	if (side === "BUY") {
		const reservedAmount = limitPrice * quantity;

		if (getAvailableCash(account) < reservedAmount) {
			throw createServiceError(400, "예약 매수 가능 현금이 부족합니다.");
		}

		account.reservedCash += reservedAmount;
		await account.save();

		return TradeOrder.create({
			userId,
			symbol,
			name,
			market,
			side,
			orderType: "LIMIT",
			status: "PENDING",
			quantity,
			filledQuantity: 0,
			orderPrice: limitPrice,
			limitPrice,
			reservedAmount,
			reservedQuantity: 0,
		});
	}

	const holding = await Holding.findOne({ userId, symbol });
	const availableQuantity = getAvailableQuantity(holding);

	if (availableQuantity < quantity) {
		throw createServiceError(400, "예약 매도 가능 수량이 부족합니다.");
	}

	holding!.reservedQuantity += quantity;
	await holding!.save();

	return TradeOrder.create({
		userId,
		symbol,
		name,
		market,
		side,
		orderType: "LIMIT",
		status: "PENDING",
		quantity,
		filledQuantity: 0,
		orderPrice: limitPrice,
		limitPrice,
		reservedAmount: 0,
		reservedQuantity: quantity,
	});
};

export const createTradeOrder = async (
	input: CreateOrderInput,
) => {
	const userId =
		getUserId(input.userId);

	const symbol =
		normalizeStockSymbol(
			input.symbol || "",
		);

	const quantity =
		toPositiveInteger(
			input.quantity,
			"수량",
		);

	if (!symbol) {
		throw createServiceError(
			400,
			"종목 코드가 필요합니다.",
		);
	}

	if (
		!["BUY", "SELL"].includes(
			input.side,
		)
	) {
		throw createServiceError(
			400,
			"side는 BUY 또는 SELL이어야 합니다.",
		);
	}

	if (
		!["MARKET", "LIMIT"].includes(
			input.orderType,
		)
	) {
		throw createServiceError(
			400,
			"orderType은 MARKET 또는 LIMIT이어야 합니다.",
		);
	}

	const marketStatus =
		getKrxMarketStatus();

	const marketExecutionAllowed =
		marketStatus.isOpen ||
		marketStatus
			.orderAllowedByOverride;

	if (
		input.orderType === "MARKET" &&
		!marketExecutionAllowed
	) {
		throw createServiceError(
			409,
			"시장가 주문은 국내 정규장 운영시간에만 가능합니다.",
		);
	}

	const quote =
		await getCurrentQuote(symbol);

	const name =
		input.name || quote.name;

	const market =
		quote.market || "KRX";

	if (
		input.orderType === "MARKET"
	) {
		if (input.side === "BUY") {
			return fillMarketBuy({
				userId,
				symbol,
				name,
				market,
				quantity,
				price: quote.price,
			});
		}

		return fillMarketSell({
			userId,
			symbol,
			name,
			market,
			quantity,
			price: quote.price,
		});
	}

	const limitPrice =
		toPositiveNumber(
			input.limitPrice,
			"지정가",
		);

	const priceConditionMet =
		input.side === "BUY"
			? quote.price <= limitPrice
			: quote.price >= limitPrice;

	/*
	 * 지정가 주문은 장이 닫혀 있으면 현재가가 조건을
	 * 만족해도 즉시 체결하지 않고 PENDING으로 예약합니다.
	 */
	const shouldFillNow =
		marketExecutionAllowed &&
		priceConditionMet;

	if (shouldFillNow) {
		if (input.side === "BUY") {
			const order =
				await fillMarketBuy({
					userId,
					symbol,
					name,
					market,
					quantity,
					price: quote.price,
				});

			order.orderType = "LIMIT";
			order.limitPrice =
				limitPrice;
			order.orderPrice =
				limitPrice;

			await order.save();

			return order;
		}

		const order =
			await fillMarketSell({
				userId,
				symbol,
				name,
				market,
				quantity,
				price: quote.price,
			});

		order.orderType = "LIMIT";
		order.limitPrice =
			limitPrice;
		order.orderPrice =
			limitPrice;

		await order.save();

		return order;
	}

	return createPendingLimitOrder({
		userId,
		symbol,
		name,
		market,
		side: input.side,
		quantity,
		limitPrice,
	});
};

export const cancelTradeOrder = async (params: {
	userId?: string;
	orderId: string;
}) => {
	const userId = getUserId(params.userId);

	const order = await TradeOrder.findOne({
		_id: params.orderId,
		userId,
		status: "PENDING",
	});

	if (!order) {
		throw createServiceError(404, "취소 가능한 미체결 주문을 찾을 수 없습니다.");
	}

	const account = await getOrCreateAccount(userId);

	if (order.side === "BUY") {
		account.reservedCash = Math.max(
			Number(account.reservedCash || 0) - Number(order.reservedAmount || 0),
			0,
		);
		await account.save();
	} else {
		const holding = await Holding.findOne({ userId, symbol: order.symbol });

		if (holding) {
			holding.reservedQuantity = Math.max(
				Number(holding.reservedQuantity || 0) -
					Number(order.reservedQuantity || 0),
				0,
			);
			await holding.save();
		}
	}

	order.status = "CANCELED";
	order.canceledAt = new Date();
	await order.save();

	return order;
};

export const checkPendingOrders = async (
	userIdInput?: string,
) => {
	const userId =
		getUserId(userIdInput);

	const marketStatus =
		getKrxMarketStatus();

	const marketExecutionAllowed =
		marketStatus.isOpen ||
		marketStatus
			.orderAllowedByOverride;

	if (!marketExecutionAllowed) {
		const pendingCount =
			await TradeOrder.countDocuments({
				userId,
				status: "PENDING",
				orderType: "LIMIT",
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
		await TradeOrder.find({
			userId,
			status: "PENDING",
			orderType: "LIMIT",
		}).sort({
			createdAt: 1,
		});

	const filledOrders:
		TradeOrderDocument[] = [];

	for (
		const order of pendingOrders
	) {
		try {
			const quote =
				await getCurrentQuote(
					order.symbol,
				);

			const limitPrice =
				Number(
					order.limitPrice || 0,
				);

			const shouldFill =
				order.side === "BUY"
					? quote.price <=
						limitPrice
					: quote.price >=
						limitPrice;

			if (!shouldFill) {
				continue;
			}

			if (
				order.side === "BUY"
			) {
				const account =
					await getOrCreateAccount(
						userId,
					);

				const reservedAmount =
					Number(
						order.reservedAmount ||
							0,
					);

				const actualAmount =
					quote.price *
					order.quantity;

				account.reservedCash =
					Math.max(
						Number(
							account.reservedCash ||
								0,
						) -
							reservedAmount,
						0,
					);

				if (
					Number(
						account.cash || 0,
					) < actualAmount
				) {
					order.status =
						"REJECTED";
					order.rejectReason =
						"체결 시점의 현금이 부족합니다.";
					order.reservedAmount =
						0;

					await Promise.all([
						order.save(),
						account.save(),
					]);

					continue;
				}

				account.cash -=
					actualAmount;

				await account.save();

				await upsertBuyHolding({
					userId,
					symbol:
						order.symbol,
					name: order.name,
					market:
						order.market,
					quantity:
						order.quantity,
					price: quote.price,
				});

				order.status =
					"FILLED";
				order.filledQuantity =
					order.quantity;
				order.executedPrice =
					quote.price;
				order.executedAt =
					new Date();
				order.reservedAmount =
					0;

				await order.save();

				filledOrders.push(
					order,
				);

				continue;
			}

			const holding =
				await Holding.findOne({
					userId,
					symbol:
						order.symbol,
				});

			if (!holding) {
				order.status =
					"REJECTED";
				order.rejectReason =
					"보유 종목이 없습니다.";
				order.reservedQuantity =
					0;

				await order.save();

				continue;
			}

			const reservedQuantity =
				Number(
					order.reservedQuantity ||
						0,
				);

			holding.reservedQuantity =
				Math.max(
					Number(
						holding.reservedQuantity ||
							0,
					) -
						reservedQuantity,
					0,
				);

			await holding.save();

			try {
				const filled =
					await fillMarketSell({
						userId,
						symbol:
							order.symbol,
						name:
							order.name,
						market:
							order.market,
						quantity:
							order.quantity,
						price:
							quote.price,
						order,
					});

				filled.reservedQuantity =
					0;

				await filled.save();

				filledOrders.push(
					filled,
				);
			} catch (sellError) {
				const latestHolding =
					await Holding.findOne({
						userId,
						symbol:
							order.symbol,
					});

				if (latestHolding) {
					latestHolding.reservedQuantity +=
						reservedQuantity;

					await latestHolding.save();
				}

				throw sellError;
			}
		} catch (error: any) {
			console.error(
				`checkPendingOrders failed: ${order.symbol}`,
				error?.message ||
					error,
			);
		}
	}

	return {
		marketOpen: true,
		marketStatus,
		checkedCount:
			pendingOrders.length,
		pendingCount:
			pendingOrders.length -
			filledOrders.length,
		filledCount:
			filledOrders.length,
		filledOrders,
	};
};

export const checkAllPendingOrders =
	async () => {
		const marketStatus =
			getKrxMarketStatus();

		const marketExecutionAllowed =
			marketStatus.isOpen ||
			marketStatus
				.orderAllowedByOverride;

		if (!marketExecutionAllowed) {
			return {
				marketOpen: false,
				marketStatus,
				userCount: 0,
				checkedCount: 0,
				filledCount: 0,
			};
		}

		const userIds =
			await TradeOrder.distinct(
				"userId",
				{
					status: "PENDING",
					orderType: "LIMIT",
				},
			);

		let checkedCount = 0;
		let filledCount = 0;

		for (const rawUserId of userIds) {
			const userId =
				String(rawUserId);

			const result =
				await checkPendingOrders(
					userId,
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
	};

export const getTradingAccountSummary = async (userIdInput?: string) => {
	const userId = getUserId(userIdInput);

	await applyMonthlySalaryPlanFundingIfDue(
		userId,
	);

	const account = await getOrCreateAccount(userId);

	return serializeTradingAccount(account);
};

export const getPortfolio = async (
	userIdInput?: string,
	options?: { evaluate?: boolean },
) => {
	const userId = getUserId(userIdInput);

	await applyMonthlySalaryPlanFundingIfDue(
		userId,
	);

	const account = await getOrCreateAccount(userId);

	const shouldEvaluate = options?.evaluate === true;

	const holdings = await Holding.find({ userId }).sort({ updatedAt: -1 });

	const evaluatedHoldings = [];

	let totalEvaluationAmount = 0;
	let totalBuyAmount = 0;

	for (const holding of holdings) {
		const quantity = Number(holding.quantity || 0);
		const avgPrice = Number(holding.avgPrice || 0);

		let currentPrice = avgPrice;
		let changeRate = 0;

		// 느린 KIS 현재가 조회는 evaluate=true일 때만 실행
		if (shouldEvaluate) {
			try {
				const quote = await getCurrentQuote(holding.symbol);
				currentPrice = quote.price;
				changeRate = quote.changeRate;
			} catch {
				currentPrice = avgPrice;
				changeRate = 0;
			}
		}

		const evaluationAmount = currentPrice * quantity;
		const buyAmount = avgPrice * quantity;
		const profitLoss = evaluationAmount - buyAmount;
		const profitLossRate = buyAmount > 0 ? (profitLoss / buyAmount) * 100 : 0;

		totalEvaluationAmount += evaluationAmount;
		totalBuyAmount += buyAmount;

		evaluatedHoldings.push({
			id: holding._id,
			userId: holding.userId,
			symbol: holding.symbol,
			name: holding.name,
			market: holding.market,
			quantity,
			reservedQuantity: holding.reservedQuantity,
			availableQuantity: getAvailableQuantity(holding),
			avgPrice,
			currentPrice,
			changeRate,
			evaluationAmount,
			buyAmount,
			profitLoss,
			profitLossRate,
			isEvaluated: shouldEvaluate,
		});
	}

	const totalAsset = Number(account.cash || 0) + totalEvaluationAmount;
	const totalProfitLoss = totalEvaluationAmount - totalBuyAmount;
	const totalProfitLossRate =
		totalBuyAmount > 0 ? (totalProfitLoss / totalBuyAmount) * 100 : 0;

	return {
		account: {
			...serializeTradingAccount(account),
			totalAsset,
			totalEvaluationAmount,
			totalBuyAmount,
			totalProfitLoss,
			totalProfitLossRate,
			adjustedProfit:
				totalAsset -
				Number(account.initialCash ?? 0) -
				Number(account.totalDeposits ?? 0),
			adjustedReturnRate:
				Number(account.initialCash ?? 0) +
					Number(account.totalDeposits ?? 0) >
				0
					? ((totalAsset -
						Number(account.initialCash ?? 0) -
						Number(account.totalDeposits ?? 0)) /
						(Number(account.initialCash ?? 0) +
							Number(account.totalDeposits ?? 0))) *
						100
					: 0,
			isEvaluated: shouldEvaluate,
		},
		holdings: evaluatedHoldings,
	};
};

export const getTradeOrders = async (params: {
	userId?: string;
	status?: string;
	limit?: number;
}) => {
	const userId = getUserId(params.userId);
	const query: Record<string, any> = { userId };

	if (params.status) {
		query.status = params.status;
	}

	const limit = Math.min(Number(params.limit || 50), 100);

	return TradeOrder.find(query).sort({ createdAt: -1 }).limit(limit).lean();
};

export const resetDemoTradingAccount = async (userIdInput?: string) => {
	const userId = getUserId(userIdInput);

	await TradingAccount.deleteOne({ userId });
	await Holding.deleteMany({ userId });
	await TradeOrder.deleteMany({ userId });
	await FundingTransaction.deleteMany({
		userId,
		market: "KR",
	});

	return getTradingAccountSummary(userId);
};