import mongoose from "mongoose";

import TradingAccount from "../models/tradingAccount.model";
import User from "../models/user.model";
import Holding from "../models/holding.model";
import TradeOrder from "../models/tradeOrder.model";
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
	filledTradeCount: number;
	activeTradingDays: number;
}

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

async function fetchQuoteMap(
	symbols: string[],
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
						Number.isFinite(
							price,
						) &&
						price > 0
					) {
						quoteMap.set(
							symbol,
							price,
						);
					}
				} catch (error) {
					console.warn(
						`랭킹 시세 조회 실패: ${symbol}`,
						error,
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

async function buildAccountPerformanceBase(
	month: string,
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

	const [holdings, orders, identity] =
		await Promise.all([
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
			loadIdentityMap(userIds),
		]);

	const quoteMap = await fetchQuoteMap(
		holdings.map(
			(holding) =>
				holding.symbol,
		),
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
			initialCash: Math.max(
				1,
				Number(
					account.initialCash ||
						1,
				),
			),
			filledTradeCount:
				monthlyOrders.length,
			activeTradingDays,
		};
	});
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

export async function getLivePerformanceEntries(
	month = getMonthKey(),
): Promise<PerformanceEntry[]> {
	const bases =
		await buildAccountPerformanceBase(
			month,
		);

	const entries: PerformanceEntry[] =
		bases.map((base) => {
			const returnRate = round(
				((base.currentEquity -
					base.initialCash) /
					base.initialCash) *
					100,
			);

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
					base.initialCash,
				returnRate,
				maxDrawdown: 0,
				consistencyScore: 0,
				activityScore: 0,
				totalScore: 0,
				filledTradeCount:
					base.filledTradeCount,
				activeTradingDays:
					base.activeTradingDays,
				isEligible: true,
				branchRank: null,
				overallRank: null,
				badge: null,
			};
		});

	return assignLiveRanks(entries);
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

export async function syncMonthlyPerformance(
	month = getMonthKey(),
): Promise<PerformanceEntry[]> {
	const bases =
		await buildAccountPerformanceBase(
			month,
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

	for (const base of bases) {
		const existing =
			currentMap.get(
				base.userId,
			);

		const monthStartEquity =
			Math.max(
				1,
				Number(
					existing?.monthStartEquity ??
						base.currentEquity,
				),
			);

		const history = updateTodayHistory(
			Array.isArray(
				existing?.equityHistory,
			)
				? existing.equityHistory
				: [],
			base.currentEquity,
		);

		const returnRate = round(
			((base.currentEquity -
				monthStartEquity) /
				monthStartEquity) *
				100,
		);

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

		await MonthlyTradingPerformance.findOneAndUpdate(
			{
				month,
				userId: base.userId,
				market: "DOMESTIC",
			},
			{
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
			{
				upsert: true,
				new: true,
				runValidators: true,
			},
		);
	}

	const ranked =
		assignMonthlyRanksAndBadges(
			entries,
		);

	if (ranked.length > 0) {
		await Promise.all(
			ranked.map(async (entry) => {
				await MonthlyTradingPerformance.updateOne(
					{
						month,
						userId:
							entry.userId,
						market:
							"DOMESTIC",
					},
					{
						$set: {
							branchRank:
								entry.branchRank,
							overallRank:
								entry.overallRank,
							badge:
								entry.badge,
						},
					},
				);

				await CommunityMonthlyRank.findOneAndUpdate(
					{
						month,
						userId:
							entry.userId,
						market:
							"DOMESTIC",
					},
					{
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
					{
						upsert: true,
						new: true,
						runValidators: true,
					},
				);
			}),
		);
	}

	return ranked;
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
