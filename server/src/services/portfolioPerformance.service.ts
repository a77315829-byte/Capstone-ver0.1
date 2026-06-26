import mongoose from "mongoose";

import TradingAccount from "../models/tradingAccount.model";
import User from "../models/user.model";
import Holding from "../models/holding.model";
import TradeOrder from "../models/tradeOrder.model";
import FundingTransaction from "../models/fundingTransaction.model";
import CommunityProfile from "../models/communityProfile.model";
import MilitaryProfile, {
	type MilitaryBranch,
} from "../models/militaryProfile.model";
import MonthlyTradingPerformance, {
	type EquityHistoryPoint,
} from "../models/monthlyTradingPerformance.model";
import CommunityMonthlyRank from "../models/communityMonthlyRank.model";

import {
	fetchStockData,
	normalizeStockSymbol,
} from "../utils/requests";
import {
	createCommunityAuthorCode,
} from "../utils/communityAuthorCode";
import {
	calculateMonthlyInvestmentScore,
} from "./communityLeaderboard.service";

export const BRANCH_LABELS: Record<
	MilitaryBranch,
	string
> = {
	ARMY: "육군",
	NAVY: "해군",
	AIR_FORCE: "공군",
	MARINE: "해병대",
	SOCIAL_SERVICE: "사회복무요원",
	ETC: "기타",
};

export const PUBLIC_BRANCHES: MilitaryBranch[] = [
	"ARMY",
	"NAVY",
	"AIR_FORCE",
	"MARINE",
	"SOCIAL_SERVICE",
];

export interface PerformanceEntry {
	id: string;
	userId: string;
	month: string;
	branch: MilitaryBranch;
	branchName: string;
	nickname: string;
	authorCode: string;
	currentEquity: number;
	startEquity: number;
	returnRate: number;
	maxDrawdown: number;
	consistencyScore: number;
	activityScore: number;
	totalScore: number;
	filledTradeCount: number;
	activeTradingDays: number;
	isEligible: boolean;
	branchRank: number | null;
	overallRank: number | null;
	badge:
		| "투자왕"
		| "수익왕"
		| "안정왕"
		| null;
}

interface AccountPerformanceBase {
	userId: string;
	accountUserId: string;
	branch: MilitaryBranch;
	branchName: string;
	nickname: string;
	authorCode: string;
	currentEquity: number;
	initialCash: number;
	totalDeposits: number;
	monthlyDeposits: number;
	depositsBeforeMonth: number;
	investedCapital: number;
	filledTradeCount: number;
	activeTradingDays: number;
}

interface TimedCacheEntry<T> {
	value: T;
	expiresAt: number;
}

const QUOTE_CACHE_TTL_MS = 60_000;
const ACCOUNT_BASE_CACHE_TTL_MS = 20_000;
const LIVE_PERFORMANCE_CACHE_TTL_MS = 30_000;
const MONTHLY_PERFORMANCE_CACHE_TTL_MS = 60_000;

const quoteCache = new Map<
	string,
	TimedCacheEntry<number>
>();
const quoteRequests = new Map<
	string,
	Promise<number | null>
>();
const accountBaseCache = new Map<
	string,
	TimedCacheEntry<AccountPerformanceBase[]>
>();
const accountBaseRequests = new Map<
	string,
	Promise<AccountPerformanceBase[]>
>();
const livePerformanceCache = new Map<
	string,
	TimedCacheEntry<PerformanceEntry[]>
>();
const livePerformanceRequests = new Map<
	string,
	Promise<PerformanceEntry[]>
>();
const monthlyPerformanceCache = new Map<
	string,
	TimedCacheEntry<PerformanceEntry[]>
>();
const monthlyPerformanceRequests = new Map<
	string,
	Promise<PerformanceEntry[]>
>();

function round(
	value: number,
	digits = 2,
): number {
	const multiplier = 10 ** digits;
	return Math.round(value * multiplier) /
		multiplier;
}

export function getMonthKey(
	date = new Date(),
): string {
	return [
		date.getUTCFullYear(),
		String(
			date.getUTCMonth() + 1,
		).padStart(2, "0"),
	].join("-");
}

function getMonthRange(month: string) {
	const [yearText, monthText] =
		month.split("-");

	const year = Number(yearText);
	const monthIndex =
		Number(monthText) - 1;

	if (
		!Number.isInteger(year) ||
		!Number.isInteger(monthIndex) ||
		monthIndex < 0 ||
		monthIndex > 11
	) {
		throw new Error(
			"INVALID_MONTH",
		);
	}

	return {
		start: new Date(
			Date.UTC(
				year,
				monthIndex,
				1,
				0,
				0,
				0,
			),
		),
		end: new Date(
			Date.UTC(
				year,
				monthIndex + 1,
				1,
				0,
				0,
				0,
			),
		),
	};
}

function getDateKey(
	date = new Date(),
): string {
	return date.toISOString().slice(0, 10);
}

function calculateMaxDrawdown(
	history: EquityHistoryPoint[],
): number {
	if (history.length < 2) {
		return 0;
	}

	let peak = Math.max(
		0,
		Number(history[0].equity || 0),
	);
	let maxDrawdown = 0;

	for (const point of history) {
		const equity = Math.max(
			0,
			Number(point.equity || 0),
		);

		peak = Math.max(peak, equity);

		if (peak <= 0) {
			continue;
		}

		const drawdown =
			((peak - equity) / peak) *
			100;

		maxDrawdown = Math.max(
			maxDrawdown,
			drawdown,
		);
	}

	return round(maxDrawdown);
}

function calculateDailyVolatility(
	history: EquityHistoryPoint[],
): number {
	if (history.length < 3) {
		return 0;
	}

	const returns: number[] = [];

	for (
		let index = 1;
		index < history.length;
		index += 1
	) {
		const previous = Number(
			history[index - 1].equity || 0,
		);
		const current = Number(
			history[index].equity || 0,
		);

		if (previous <= 0) {
			continue;
		}

		returns.push(
			((current - previous) /
				previous) *
				100,
		);
	}

	if (returns.length < 2) {
		return 0;
	}

	const average =
		returns.reduce(
			(sum, value) =>
				sum + value,
			0,
		) / returns.length;

	const variance =
		returns.reduce(
			(sum, value) =>
				sum +
				(value - average) ** 2,
			0,
		) / returns.length;

	return round(
		Math.sqrt(variance),
	);
}

async function fetchQuote(
	symbol: string,
	forceRefresh = false,
): Promise<number | null> {
	const cached = quoteCache.get(symbol);
	const now = Date.now();

	if (
		!forceRefresh &&
		cached &&
		cached.expiresAt > now
	) {
		return cached.value;
	}

	const pending = quoteRequests.get(symbol);

	if (pending) {
		return pending;
	}

	const request = (async () => {
		try {
			const stock =
				await fetchStockData(
					symbol,
				);

			const price = Number(
				stock.price ??
					stock.regularMarketPrice ??
					0,
			);

			if (
				Number.isFinite(price) &&
				price > 0
			) {
				quoteCache.set(symbol, {
					value: price,
					expiresAt:
						now +
						QUOTE_CACHE_TTL_MS,
				});
				return price;
			}
		} catch (error) {
			console.warn(
				`랭킹 시세 조회 실패: ${symbol}`,
				error,
			);
		}

		/*
		 * 외부 시세 API가 잠시 실패하면 마지막 정상 가격을 사용합니다.
		 * 캐시 만료 여부와 관계없이 0원으로 떨어지는 것을 방지합니다.
		 */
		return cached?.value ?? null;
	})().finally(() => {
		quoteRequests.delete(symbol);
	});

	quoteRequests.set(symbol, request);
	return request;
}

async function fetchQuoteMap(
	symbols: string[],
	forceRefresh = false,
): Promise<Map<string, number>> {
	const quoteMap = new Map<
		string,
		number
	>();

	const uniqueSymbols = [
		...new Set(
			symbols
				.map((symbol) =>
					normalizeStockSymbol(
						symbol,
					),
				)
				.filter(Boolean),
		),
	];

	await Promise.all(
		uniqueSymbols.map(
			async (symbol) => {
				const price =
					await fetchQuote(
						symbol,
						forceRefresh,
					);

				if (
					price !== null &&
					price > 0
				) {
					quoteMap.set(
						symbol,
						price,
					);
				}
			},
		),
	);

	return quoteMap;
}

async function loadIdentityMap(
	accountUserIds: string[],
) {
	const validObjectIds =
		accountUserIds.filter(
			(userId) =>
				mongoose.Types.ObjectId.isValid(
					userId,
				),
		);

	const users = await User.find({
		$or: [
			{
				_id: {
					$in: validObjectIds,
				},
			},
			{
				username: {
					$in: accountUserIds,
				},
			},
		],
	})
		.select("_id username")
		.lean();

	const canonicalByAccountKey =
		new Map<string, string>();

	for (const user of users) {
		const canonicalId = String(user._id);
		canonicalByAccountKey.set(
			canonicalId,
			canonicalId,
		);

		if (user.username) {
			canonicalByAccountKey.set(
				String(user.username),
				canonicalId,
			);
		}
	}

	for (const accountUserId of accountUserIds) {
		if (
			!canonicalByAccountKey.has(
				accountUserId,
			)
		) {
			canonicalByAccountKey.set(
				accountUserId,
				accountUserId,
			);
		}
	}

	const canonicalIds = [
		...new Set(
			[...canonicalByAccountKey.values()].filter(
				(userId) =>
					mongoose.Types.ObjectId.isValid(
						userId,
					),
			),
		),
	];

	const [communityProfiles, militaryProfiles] =
		await Promise.all([
			CommunityProfile.find({
				userId: {
					$in: canonicalIds,
				},
			})
				.select(
					"userId nickname branch",
				)
				.lean(),
			MilitaryProfile.find({
				userId: {
					$in: canonicalIds,
				},
			})
				.select(
					"userId branch",
				)
				.lean(),
		]);

	const communityMap = new Map<
		string,
		any
	>();
	const militaryMap = new Map<
		string,
		any
	>();

	for (const profile of communityProfiles) {
		communityMap.set(
			String(profile.userId),
			profile,
		);
	}

	for (const profile of militaryProfiles) {
		militaryMap.set(
			String(profile.userId),
			profile,
		);
	}

	return {
		canonicalByAccountKey,
		communityMap,
		militaryMap,
	};
}

async function loadAccountPerformanceBase(
	month: string,
	forceQuoteRefresh = false,
): Promise<AccountPerformanceBase[]> {
	const { start, end } =
		getMonthRange(month);

	const accounts =
		await TradingAccount.find({})
			.lean();

	if (accounts.length === 0) {
		return [];
	}

	const userIds = accounts.map(
		(account) =>
			String(account.userId),
	);

	const [
		holdings,
		orders,
		fundingTransactions,
		identity,
	] = await Promise.all([
			Holding.find({
				userId: {
					$in: userIds,
				},
			})
				.lean(),
			TradeOrder.find({
				userId: {
					$in: userIds,
				},
				status: "FILLED",
				executedAt: {
					$gte: start,
					$lt: end,
				},
			})
				.select(
					"userId executedAt createdAt",
				)
				.lean(),
			FundingTransaction.find({
				userId: {
					$in: userIds,
				},
				market: "KR",
			})
				.select(
					"userId amount createdAt",
				)
				.lean(),
			loadIdentityMap(userIds),
		]);

	const quoteMap = await fetchQuoteMap(
		holdings.map(
			(holding) =>
				holding.symbol,
		),
		forceQuoteRefresh,
	);

	const holdingsByUser = new Map<
		string,
		any[]
	>();

	for (const holding of holdings) {
		const userId = String(
			holding.userId,
		);
		const list =
			holdingsByUser.get(userId) ??
			[];
		list.push(holding);
		holdingsByUser.set(userId, list);
	}

	const ordersByUser = new Map<
		string,
		any[]
	>();

	for (const order of orders) {
		const userId = String(
			order.userId,
		);
		const list =
			ordersByUser.get(userId) ??
			[];
		list.push(order);
		ordersByUser.set(userId, list);
	}

	const totalDepositsByUser =
		new Map<string, number>();
	const monthlyDepositsByUser =
		new Map<string, number>();

	for (const transaction of fundingTransactions) {
		const userId = String(
			transaction.userId,
		);
		const amount = Math.max(
			0,
			Number(transaction.amount || 0),
		);

		totalDepositsByUser.set(
			userId,
			(totalDepositsByUser.get(userId) ?? 0) +
				amount,
		);

		const createdAt = new Date(
			transaction.createdAt,
		);

		if (
			createdAt >= start &&
			createdAt < end
		) {
			monthlyDepositsByUser.set(
				userId,
				(monthlyDepositsByUser.get(
					userId,
				) ?? 0) + amount,
			);
		}
	}

	return accounts.map((account) => {
		const accountUserId = String(
			account.userId,
		);

		const userId =
			identity.canonicalByAccountKey.get(
				accountUserId,
			) ?? accountUserId;

		const communityProfile =
			identity.communityMap.get(
				userId,
			);
		const militaryProfile =
			identity.militaryMap.get(
				userId,
			);

		const branch =
			(communityProfile?.branch ??
				militaryProfile?.branch ??
				"ETC") as MilitaryBranch;

		const branchName =
			BRANCH_LABELS[branch] ??
			"기타";

		const nickname =
			String(
				communityProfile?.nickname ??
					"ㅇㅇ",
			).trim() || "ㅇㅇ";

		const currentHoldings =
			holdingsByUser.get(
				accountUserId,
			) ?? [];

		const stockValue =
			currentHoldings.reduce(
				(sum, holding) => {
					const symbol =
						normalizeStockSymbol(
							holding.symbol,
						);
					const currentPrice =
						quoteMap.get(symbol) ??
						Number(
							holding.avgPrice ||
								0,
						);

					return (
						sum +
						Number(
							holding.quantity ||
								0,
						) * currentPrice
					);
				},
				0,
			);

		const monthlyOrders =
			ordersByUser.get(
				accountUserId,
			) ?? [];

		const initialCash = Math.max(
			0,
			Number(account.initialCash || 0),
		);
		const totalDeposits = Math.max(
			0,
			totalDepositsByUser.get(
				accountUserId,
			) ?? 0,
		);
		const monthlyDeposits = Math.max(
			0,
			monthlyDepositsByUser.get(
				accountUserId,
			) ?? 0,
		);
		const depositsBeforeMonth = Math.max(
			0,
			totalDeposits - monthlyDeposits,
		);
		const investedCapital =
			initialCash + totalDeposits;

		const activeTradingDays =
			new Set(
				monthlyOrders.map(
					(order) =>
						new Date(
							order.executedAt ??
								order.createdAt,
						)
							.toISOString()
							.slice(0, 10),
				),
			).size;

		return {
			userId,
			accountUserId,
			branch,
			branchName,
			nickname,
			authorCode:
				createCommunityAuthorCode({
					userId,
					boardKey:
						`leaderboard:${branch}`,
				}),
			currentEquity: round(
				Number(account.cash || 0) +
					stockValue,
				0,
			),
			initialCash,
			totalDeposits,
			monthlyDeposits,
			depositsBeforeMonth,
			investedCapital,
			filledTradeCount:
				monthlyOrders.length,
			activeTradingDays,
		};
	});
}


async function buildAccountPerformanceBase(
	month: string,
	forceRefresh = false,
): Promise<AccountPerformanceBase[]> {
	const cached = accountBaseCache.get(month);
	const now = Date.now();

	if (
		!forceRefresh &&
		cached &&
		cached.expiresAt > now
	) {
		return cached.value;
	}

	const pending =
		accountBaseRequests.get(month);

	if (pending) {
		return pending;
	}

	const request =
		loadAccountPerformanceBase(
			month,
			forceRefresh,
		)
			.then((value) => {
				accountBaseCache.set(month, {
					value,
					expiresAt:
						Date.now() +
						ACCOUNT_BASE_CACHE_TTL_MS,
				});
				return value;
			})
			.finally(() => {
				accountBaseRequests.delete(
					month,
				);
			});

	accountBaseRequests.set(
		month,
		request,
	);

	return request;
}

function assignLiveRanks(
	entries: PerformanceEntry[],
): PerformanceEntry[] {
	const sorted = [...entries].sort(
		(a, b) =>
			b.returnRate - a.returnRate ||
			b.currentEquity -
				a.currentEquity,
	);

	const overallRank = new Map<
		string,
		number
	>();

	sorted.forEach((entry, index) => {
		overallRank.set(
			entry.userId,
			index + 1,
		);
	});

	const branchRank = new Map<
		string,
		number
	>();

	for (const branch of Object.keys(
		BRANCH_LABELS,
	) as MilitaryBranch[]) {
		const branchEntries = sorted.filter(
			(entry) =>
				entry.branch === branch,
		);

		branchEntries.forEach(
			(entry, index) => {
				branchRank.set(
					entry.userId,
					index + 1,
				);
			},
		);
	}

	return entries.map((entry) => ({
		...entry,
		overallRank:
			overallRank.get(
				entry.userId,
			) ?? null,
		branchRank:
			branchRank.get(
				entry.userId,
			) ?? null,
	}));
}

async function calculateLivePerformanceEntries(
	month: string,
	forceRefresh = false,
): Promise<PerformanceEntry[]> {
	const bases =
		await buildAccountPerformanceBase(
			month,
			forceRefresh,
		);

	const entries: PerformanceEntry[] =
		bases.map((base) => {
			const adjustedProfit =
				base.currentEquity -
					base.investedCapital;
			const returnRate =
				base.investedCapital > 0
					? round(
						(adjustedProfit /
							base.investedCapital) *
							100,
					)
					: 0;

			return {
				id: `live:${base.userId}`,
				userId: base.userId,
				month,
				branch: base.branch,
				branchName:
					base.branchName,
				nickname: base.nickname,
				authorCode:
					base.authorCode,
				currentEquity:
					base.currentEquity,
				startEquity:
					base.investedCapital,
				returnRate,
				maxDrawdown: 0,
				consistencyScore: 0,
				activityScore: 0,
				totalScore: 0,
				filledTradeCount:
					base.filledTradeCount,
				activeTradingDays:
					base.activeTradingDays,
				isEligible:
					base.investedCapital > 0,
				branchRank: null,
				overallRank: null,
				badge: null,
			};
		});

	return assignLiveRanks(entries);
}

export async function getLivePerformanceEntries(
	month = getMonthKey(),
	forceRefresh = false,
): Promise<PerformanceEntry[]> {
	const cached =
		livePerformanceCache.get(month);
	const now = Date.now();

	if (
		!forceRefresh &&
		cached &&
		cached.expiresAt > now
	) {
		return cached.value;
	}

	const pending =
		livePerformanceRequests.get(month);

	if (pending) {
		return pending;
	}

	const request =
		calculateLivePerformanceEntries(
			month,
			forceRefresh,
		)
			.then((value) => {
				livePerformanceCache.set(
					month,
					{
						value,
						expiresAt:
							Date.now() +
							LIVE_PERFORMANCE_CACHE_TTL_MS,
					},
				);
				return value;
			})
			.finally(() => {
				livePerformanceRequests.delete(
					month,
				);
			});

	livePerformanceRequests.set(
		month,
		request,
	);

	return request;
}

function updateTodayHistory(
	history: EquityHistoryPoint[],
	currentEquity: number,
): EquityHistoryPoint[] {
	const date = getDateKey();
	const next = history
		.map((item) => ({
			date: item.date,
			equity: Number(
				item.equity || 0,
			),
		}))
		.filter(
			(item) =>
				Boolean(item.date),
		);

	const existingIndex =
		next.findIndex(
			(item) =>
				item.date === date,
		);

	if (existingIndex >= 0) {
		next[existingIndex] = {
			date,
			equity: currentEquity,
		};
	} else {
		next.push({
			date,
			equity: currentEquity,
		});
	}

	return next
		.sort((a, b) =>
			a.date.localeCompare(
				b.date,
			),
		)
		.slice(-40);
}

function assignMonthlyRanksAndBadges(
	entries: PerformanceEntry[],
): PerformanceEntry[] {
	const eligible = entries
		.filter(
			(entry) =>
				entry.isEligible,
		)
		.sort(
			(a, b) =>
				b.totalScore -
					a.totalScore ||
				b.returnRate -
					a.returnRate,
		);

	const overallRank = new Map<
		string,
		number
	>();

	eligible.forEach((entry, index) => {
		overallRank.set(
			entry.userId,
			index + 1,
		);
	});

	const branchRank = new Map<
		string,
		number
	>();
	const badges = new Map<
		string,
		PerformanceEntry["badge"]
	>();

	for (const branch of Object.keys(
		BRANCH_LABELS,
	) as MilitaryBranch[]) {
		const branchEntries =
			eligible.filter(
				(entry) =>
					entry.branch ===
					branch,
			);

		branchEntries.forEach(
			(entry, index) => {
				branchRank.set(
					entry.userId,
					index + 1,
				);
			},
		);

		const investorKing =
			branchEntries[0];

		if (investorKing) {
			badges.set(
				investorKing.userId,
				"투자왕",
			);
		}

		const returnKing =
			[...branchEntries].sort(
				(a, b) =>
					b.returnRate -
					a.returnRate,
			)[0];

		if (
			returnKing &&
			!badges.has(
				returnKing.userId,
			)
		) {
			badges.set(
				returnKing.userId,
				"수익왕",
			);
		}

		const stabilityKing =
			[...branchEntries].sort(
				(a, b) =>
					a.maxDrawdown -
					b.maxDrawdown ||
					b.consistencyScore -
						a.consistencyScore,
			)[0];

		if (
			stabilityKing &&
			!badges.has(
				stabilityKing.userId,
			)
		) {
			badges.set(
				stabilityKing.userId,
				"안정왕",
			);
		}
	}

	return entries.map((entry) => ({
		...entry,
		overallRank:
			overallRank.get(
				entry.userId,
			) ?? null,
		branchRank:
			branchRank.get(
				entry.userId,
			) ?? null,
		badge:
			badges.get(
				entry.userId,
			) ?? null,
	}));
}

async function calculateAndPersistMonthlyPerformance(
	month: string,
	forceRefresh = false,
): Promise<PerformanceEntry[]> {
	const bases =
		await buildAccountPerformanceBase(
			month,
			forceRefresh,
		);

	const currentDocuments =
		await MonthlyTradingPerformance.find({
			month,
			market: "DOMESTIC",
		}).lean();

	const currentMap = new Map<
		string,
		any
	>();

	for (const document of currentDocuments) {
		currentMap.set(
			String(document.userId),
			document,
		);
	}

	const entries: PerformanceEntry[] = [];
	const performanceOperations: any[] = [];

	for (const base of bases) {
		const existing =
			currentMap.get(
				base.userId,
			);

		const monthStartEquity =
			Math.max(
				0,
				Number(
					existing?.monthStartEquity ??
						(base.initialCash +
							base.depositsBeforeMonth),
				),
			);
		const monthlyCapital =
			monthStartEquity +
				base.monthlyDeposits;

		const history = updateTodayHistory(
			Array.isArray(
				existing?.equityHistory,
			)
				? existing.equityHistory
				: [],
			base.currentEquity,
		);

		const returnRate =
			monthlyCapital > 0
				? round(
					((base.currentEquity -
						monthStartEquity -
						base.monthlyDeposits) /
						monthlyCapital) *
						100,
				)
				: 0;

		const maxDrawdown =
			calculateMaxDrawdown(
				history,
			);

		const dailyVolatility =
			calculateDailyVolatility(
				history,
			);

		const reasonEntryCount =
			Number(
				existing?.reasonEntryCount ??
					0,
			);

		const score =
			calculateMonthlyInvestmentScore({
				returnRate,
				maxDrawdown,
				dailyVolatility,
				activeTradingDays:
					base.activeTradingDays,
				reasonEntryCount,
			});

		const isEligible =
			monthlyCapital > 0 &&
			base.filledTradeCount >= 3 &&
			base.activeTradingDays >= 3;

		entries.push({
			id:
				String(existing?._id ??
					`monthly:${base.userId}`),
			userId: base.userId,
			month,
			branch: base.branch,
			branchName:
				base.branchName,
			nickname: base.nickname,
			authorCode:
				base.authorCode,
			currentEquity:
				base.currentEquity,
			startEquity:
				monthStartEquity,
			returnRate,
			maxDrawdown,
			consistencyScore:
				score.consistencyScore,
			activityScore:
				score.activityScore,
			totalScore:
				score.totalScore,
			filledTradeCount:
				base.filledTradeCount,
			activeTradingDays:
				base.activeTradingDays,
			isEligible,
			branchRank: null,
			overallRank: null,
			badge: null,
		});

		performanceOperations.push({
			updateOne: {
				filter: {
					month,
					userId: base.userId,
					market: "DOMESTIC",
				},
				update: {
					$set: {
						branch: base.branch,
						branchName:
							base.branchName,
						nickname:
							base.nickname,
						authorCode:
							base.authorCode,
						monthStartEquity,
						currentEquity:
							base.currentEquity,
						returnRate,
						maxDrawdown,
						dailyVolatility,
						filledTradeCount:
							base.filledTradeCount,
						activeTradingDays:
							base.activeTradingDays,
						reasonEntryCount,
						isEligible,
						returnScore:
							score.returnScore,
						drawdownScore:
							score.drawdownScore,
						consistencyScore:
							score.consistencyScore,
						activityScore:
							score.activityScore,
						totalScore:
							score.totalScore,
						equityHistory:
							history,
					},
					$setOnInsert: {
						month,
						userId: base.userId,
						market: "DOMESTIC",
					},
				},
				upsert: true,
			},
		});
	}

	if (performanceOperations.length > 0) {
		await MonthlyTradingPerformance.bulkWrite(
			performanceOperations,
			{
				ordered: false,
			},
		);
	}

	const ranked =
		assignMonthlyRanksAndBadges(
			entries,
		);

	if (ranked.length > 0) {
		const rankOperations: any[] =
			ranked.map((entry) => ({
				updateOne: {
					filter: {
						month,
						userId:
							entry.userId,
						market:
							"DOMESTIC",
					},
					update: {
						$set: {
							branchRank:
								entry.branchRank,
							overallRank:
								entry.overallRank,
							badge:
								entry.badge,
						},
					},
				},
			}));

		const communityRankOperations: any[] =
			ranked.map((entry) => ({
				updateOne: {
					filter: {
						month,
						userId:
							entry.userId,
						market:
							"DOMESTIC",
					},
					update: {
						$set: {
							branch:
								entry.branch,
							branchName:
								entry.branchName,
							nickname:
								entry.nickname,
							authorCode:
								entry.authorCode,
							startEquity:
								entry.startEquity,
							currentEquity:
								entry.currentEquity,
							returnRate:
								entry.returnRate,
							maxDrawdown:
								entry.maxDrawdown,
							consistencyScore:
								entry.consistencyScore,
							activityScore:
								entry.activityScore,
							totalScore:
								entry.totalScore,
							filledTradeCount:
								entry.filledTradeCount,
							activeTradingDays:
								entry.activeTradingDays,
							isEligible:
								entry.isEligible,
							branchRank:
								entry.branchRank,
							overallRank:
								entry.overallRank,
							badge:
								entry.badge,
						},
						$setOnInsert: {
							month,
							userId:
								entry.userId,
							market:
								"DOMESTIC",
						},
					},
					upsert: true,
				},
			}));

		await Promise.all([
			MonthlyTradingPerformance.bulkWrite(
				rankOperations,
				{
					ordered: false,
				},
			),
			CommunityMonthlyRank.bulkWrite(
				communityRankOperations,
				{
					ordered: false,
				},
			),
		]);
	}

	return ranked;
}

export async function syncMonthlyPerformance(
	month = getMonthKey(),
	forceRefresh = false,
): Promise<PerformanceEntry[]> {
	const cached =
		monthlyPerformanceCache.get(month);
	const now = Date.now();

	if (
		!forceRefresh &&
		cached &&
		cached.expiresAt > now
	) {
		return cached.value;
	}

	const pending =
		monthlyPerformanceRequests.get(
			month,
		);

	if (pending) {
		return pending;
	}

	const request =
		calculateAndPersistMonthlyPerformance(
			month,
			forceRefresh,
		)
			.then((value) => {
				monthlyPerformanceCache.set(
					month,
					{
						value,
						expiresAt:
							Date.now() +
							MONTHLY_PERFORMANCE_CACHE_TTL_MS,
					},
				);
				return value;
			})
			.finally(() => {
				monthlyPerformanceRequests.delete(
					month,
				);
			});

	monthlyPerformanceRequests.set(
		month,
		request,
	);

	return request;
}

export function serializePerformanceEntry(
	entry: PerformanceEntry | any,
): PerformanceEntry {
	return {
		id: String(
			entry.id ??
				entry._id ??
				`performance:${entry.userId}`,
		),
		userId: String(entry.userId),
		month: String(entry.month),
		branch:
			entry.branch as MilitaryBranch,
		branchName:
			String(
				entry.branchName ??
					BRANCH_LABELS[
						entry.branch as MilitaryBranch
					] ??
					"기타",
			),
		nickname:
			String(entry.nickname ?? "ㅇㅇ"),
		authorCode:
			String(entry.authorCode ?? "0.0"),
		currentEquity:
			Number(entry.currentEquity || 0),
		startEquity:
			Number(
				entry.startEquity ??
					entry.monthStartEquity ??
					0,
			),
		returnRate:
			Number(entry.returnRate || 0),
		maxDrawdown:
			Number(entry.maxDrawdown || 0),
		consistencyScore:
			Number(
				entry.consistencyScore || 0,
			),
		activityScore:
			Number(entry.activityScore || 0),
		totalScore:
			Number(entry.totalScore || 0),
		filledTradeCount:
			Number(
				entry.filledTradeCount || 0,
			),
		activeTradingDays:
			Number(
				entry.activeTradingDays || 0,
			),
		isEligible:
			Boolean(entry.isEligible),
		branchRank:
			entry.branchRank == null
				? null
				: Number(entry.branchRank),
		overallRank:
			entry.overallRank == null
				? null
				: Number(entry.overallRank),
		badge:
			entry.badge ?? null,
	};
}
