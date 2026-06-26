import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import "../utils/db";

import User from "../models/user.model";
import MilitaryProfile, {
	type MilitaryBranch,
} from "../models/militaryProfile.model";
import CommunityProfile from "../models/communityProfile.model";
import TradingAccount from "../models/tradingAccount.model";
import Holding from "../models/holding.model";
import TradeOrder from "../models/tradeOrder.model";
import FundingTransaction from "../models/fundingTransaction.model";
import MonthlyTradingPerformance from "../models/monthlyTradingPerformance.model";
import CommunityMonthlyRank from "../models/communityMonthlyRank.model";

const DEMO_USER_COUNT_PER_BRANCH = 16;
const DEMO_PASSWORD_PREFIX = "LeaderboardDemo!";
const DEMO_USERNAME_PREFIX = "leaderboard_demo_";
const DEMO_FUNDING_PREFIX = "LEADERBOARD_DEMO";

const BRANCHES: Array<{
	code: Exclude<MilitaryBranch, "ETC">;
	label: string;
	serviceMonths: number;
}> = [
	{
		code: "ARMY",
		label: "육군",
		serviceMonths: 18,
	},
	{
		code: "NAVY",
		label: "해군",
		serviceMonths: 20,
	},
	{
		code: "AIR_FORCE",
		label: "공군",
		serviceMonths: 21,
	},
	{
		code: "MARINE",
		label: "해병",
		serviceMonths: 18,
	},
	{
		code: "SOCIAL_SERVICE",
		label: "사회복무",
		serviceMonths: 21,
	},
];

const SYMBOLS = [
	{
		symbol: "005930",
		name: "삼성전자",
		price: 82_000,
	},
	{
		symbol: "000660",
		name: "SK하이닉스",
		price: 205_000,
	},
	{
		symbol: "035420",
		name: "NAVER",
		price: 194_000,
	},
	{
		symbol: "005380",
		name: "현대차",
		price: 285_000,
	},
];

function round(
	value: number,
	digits = 2,
): number {
	const multiplier = 10 ** digits;
	return Math.round(value * multiplier) /
		multiplier;
}

function seededRandom(seed: number): number {
	const value =
		Math.sin(seed * 12.9898) *
		43_758.5453;

	return value - Math.floor(value);
}

function getMonthKey(
	date = new Date(),
): string {
	return [
		date.getUTCFullYear(),
		String(
			date.getUTCMonth() + 1,
		).padStart(2, "0"),
	].join("-");
}

function addServiceMonthsMinusOneDay(
	enlistmentDate: Date,
	serviceMonths: number,
): Date {
	const dischargeDate = new Date(
		Date.UTC(
			enlistmentDate.getUTCFullYear(),
			enlistmentDate.getUTCMonth() +
				serviceMonths,
			enlistmentDate.getUTCDate(),
		),
	);

	dischargeDate.setUTCDate(
		dischargeDate.getUTCDate() - 1,
	);

	return dischargeDate;
}

function getCurrentMonthDate(
	day: number,
	hour = 3,
): Date {
	const now = new Date();
	const lastAvailableDay = Math.max(
		1,
		now.getUTCDate(),
	);
	const safeDay = Math.min(
		Math.max(1, day),
		lastAvailableDay,
	);

	return new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			safeDay,
			hour,
			0,
			0,
		),
	);
}

function buildActiveDays(): number[] {
	const currentDay = new Date().getUTCDate();

	if (currentDay >= 15) {
		return [2, 6, 10, 14, 18, 22];
	}

	if (currentDay >= 7) {
		return [1, 3, 5, 7, 9, 11];
	}

	return [1, 2, 3, 4, 5, 6];
}

interface DemoUserDefinition {
	index: number;
	username: string;
	password: string;
	nickname: string;
	branch: Exclude<MilitaryBranch, "ETC">;
	serviceMonths: number;
	depositAmount: number;
	returnRate: number;
	tradeCount: number;
}

function buildDemoDefinitions(): DemoUserDefinition[] {
	const definitions: DemoUserDefinition[] = [];
	let globalIndex = 0;

	for (const branch of BRANCHES) {
		for (
			let branchIndex = 1;
			branchIndex <=
			DEMO_USER_COUNT_PER_BRANCH;
			branchIndex += 1
		) {
			globalIndex += 1;

			const random = seededRandom(
				globalIndex,
			);
			const returnRate = round(
				-8 + random * 27 +
					globalIndex * 0.0001,
			);
			const depositAmount =
				500_000 +
				(globalIndex % 4) * 250_000;

			definitions.push({
				index: globalIndex,
				username:
					`${DEMO_USERNAME_PREFIX}` +
					String(globalIndex).padStart(
						3,
						"0",
					),
				password:
					`${DEMO_PASSWORD_PREFIX}` +
					String(globalIndex).padStart(
						3,
						"0",
					),
				nickname:
					`${branch.label}개미` +
					String(branchIndex).padStart(
						2,
						"0",
					),
				branch: branch.code,
				serviceMonths:
					branch.serviceMonths,
				depositAmount,
				returnRate,
				tradeCount:
					3 + (globalIndex % 6),
			});
		}
	}

	return definitions;
}

async function removeStaleDemoUsers(
	targetUsernames: Set<string>,
): Promise<void> {
	const existingDemoUsers = await User.find({
		username: {
			$regex:
				`^${DEMO_USERNAME_PREFIX}\\d{3}$`,
		},
	})
		.select("_id username")
		.lean();

	const staleUsers = existingDemoUsers.filter(
		(user) =>
			!targetUsernames.has(
				String(user.username),
			),
	);

	if (staleUsers.length === 0) {
		return;
	}

	const objectIds = staleUsers.map(
		(user) => user._id,
	);
	const stringIds = objectIds.map((id) =>
		String(id),
	);

	await Promise.all([
		CommunityProfile.deleteMany({
			userId: {
				$in: objectIds,
			},
		}),
		MilitaryProfile.deleteMany({
			userId: {
				$in: objectIds,
			},
		}),
		TradingAccount.deleteMany({
			userId: {
				$in: stringIds,
			},
		}),
		Holding.deleteMany({
			userId: {
				$in: stringIds,
			},
		}),
		TradeOrder.deleteMany({
			userId: {
				$in: stringIds,
			},
		}),
		FundingTransaction.deleteMany({
			userId: {
				$in: stringIds,
			},
		}),
		MonthlyTradingPerformance.deleteMany({
			userId: {
				$in: stringIds,
			},
		}),
		CommunityMonthlyRank.deleteMany({
			userId: {
				$in: stringIds,
			},
		}),
	]);

	await User.deleteMany({
		_id: {
			$in: objectIds,
		},
	});
}

async function seedLeaderboard(): Promise<void> {
	await mongoose.connection.asPromise();

	const definitions =
		buildDemoDefinitions();
	const targetUsernames = new Set(
		definitions.map(
			(definition) =>
				definition.username,
		),
	);

	await removeStaleDemoUsers(
		targetUsernames,
	);

	const seededUsers: Array<{
		definition: DemoUserDefinition;
		userId: mongoose.Types.ObjectId;
	}> = [];

	for (const definition of definitions) {
		let user = await User.findOne({
			username: definition.username,
		});

		if (!user) {
			const passwordHash =
				await bcrypt.hash(
					definition.password,
					6,
				);

			user = await User.create({
				username:
					definition.username,
				password: passwordHash,
				watchlist: [],
				ledger: [],
				positions: [],
				cash: 0,
			});
		}

		seededUsers.push({
			definition,
			userId: new mongoose.Types.ObjectId(
				String(user._id),
			),
		});
	}

	const objectIds = seededUsers.map(
		(item) => item.userId,
	);
	const stringIds = objectIds.map((id) =>
		String(id),
	);

	await Promise.all([
		Holding.deleteMany({
			userId: {
				$in: stringIds,
			},
		}),
		TradeOrder.deleteMany({
			userId: {
				$in: stringIds,
			},
		}),
		FundingTransaction.deleteMany({
			userId: {
				$in: stringIds,
			},
		}),
		MonthlyTradingPerformance.deleteMany({
			userId: {
				$in: stringIds,
			},
		}),
		CommunityMonthlyRank.deleteMany({
			userId: {
				$in: stringIds,
			},
		}),
	]);

	const monthKey = getMonthKey();
	const activeDays = buildActiveDays();
	const fundingDocuments: any[] = [];
	const orderDocuments: any[] = [];

	for (const {
		definition,
		userId,
	} of seededUsers) {
		const userIdString = String(userId);
		const enlistmentDate = new Date(
			Date.UTC(
				2025,
				5 +
					(definition.index % 3),
				1 +
					(definition.index % 20),
			),
		);
		const dischargeDate =
			addServiceMonthsMinusOneDay(
				enlistmentDate,
				definition.serviceMonths,
			);
		const currentEquity = Math.max(
			0,
			Math.round(
				definition.depositAmount *
					(1 +
						definition.returnRate /
							100),
			),
		);

		await Promise.all([
			CommunityProfile.findOneAndUpdate(
				{
					userId,
				},
				{
					$set: {
						nickname:
							definition.nickname,
						branch:
							definition.branch,
					},
					$setOnInsert: {
						userId,
					},
				},
				{
					upsert: true,
					new: true,
					runValidators: true,
				},
			),
			MilitaryProfile.findOneAndUpdate(
				{
					userId,
				},
				{
					$set: {
						branch:
							definition.branch,
						enlistmentDate,
						dischargeDate,
						dischargeDateSource:
							"AUTO",
						selectedRank:
							"CORPORAL",
						rankMode: "AUTO",
					},
					$setOnInsert: {
						userId,
					},
				},
				{
					upsert: true,
					new: true,
					runValidators: true,
				},
			),
			TradingAccount.findOneAndUpdate(
				{
					userId: userIdString,
				},
				{
					$set: {
						cash: currentEquity,
						reservedCash: 0,
						initialCash: 0,
						currency: "KRW",
					},
					$setOnInsert: {
						userId: userIdString,
					},
				},
				{
					upsert: true,
					new: true,
					runValidators: true,
				},
			),
		]);

		const fundingCreatedAt =
			getCurrentMonthDate(1, 1);

		fundingDocuments.push({
			userId: userIdString,
			market: "KR",
			type: "MANUAL_TOP_UP",
			amount: definition.depositAmount,
			currency: "KRW",
			fundingKey:
				`${DEMO_FUNDING_PREFIX}:` +
				definition.username,
			referenceId:
				definition.username,
			periodKey: monthKey,
			createdAt: fundingCreatedAt,
			updatedAt: fundingCreatedAt,
		});

		for (
			let orderIndex = 0;
			orderIndex <
			definition.tradeCount;
			orderIndex += 1
		) {
			const stock =
				SYMBOLS[
					(definition.index +
						orderIndex) %
						SYMBOLS.length
				];
			const quantity =
				1 +
				((definition.index +
					orderIndex) %
					3);
			const executedAt =
				getCurrentMonthDate(
					activeDays[
						orderIndex %
							activeDays.length
					],
					3 +
						(orderIndex % 8),
				);
			const side =
				orderIndex % 2 === 0
					? "BUY"
					: "SELL";
			const priceFactor =
				1 +
				(definition.returnRate /
					100) *
					0.15;
			const executedPrice =
				Math.max(
					1,
					Math.round(
						stock.price *
							priceFactor,
					),
				);

			orderDocuments.push({
				userId: userIdString,
				symbol: stock.symbol,
				name: stock.name,
				market: "KRX",
				side,
				orderType: "MARKET",
				status: "FILLED",
				quantity,
				filledQuantity: quantity,
				orderPrice: executedPrice,
				limitPrice: null,
				executedPrice,
				reservedAmount: 0,
				reservedQuantity: 0,
				realizedProfit:
					side === "SELL"
						? Math.round(
							definition.depositAmount *
								(definition.returnRate /
									100) /
								Math.max(
									1,
									definition.tradeCount,
								),
						)
						: 0,
				rejectReason: "",
				executedAt,
				canceledAt: null,
				createdAt: executedAt,
				updatedAt: executedAt,
			});
		}
	}

	await Promise.all([
		FundingTransaction.insertMany(
			fundingDocuments,
		),
		TradeOrder.insertMany(
			orderDocuments,
		),
	]);

	const branchCounts = BRANCHES.map(
		(branch) => ({
			branch: branch.label,
			count: definitions.filter(
				(definition) =>
					definition.branch ===
					branch.code,
			).length,
		}),
	);

	console.log(
		`랭킹 더미 사용자 ${definitions.length}명 생성 완료`,
	);
	console.table(branchCounts);
	console.log(
		`거래 내역 ${orderDocuments.length}건, 입금 내역 ${fundingDocuments.length}건 생성 완료`,
	);
	console.log(
		"커뮤니티 랭킹 화면을 새로고침하면 실제 랭킹 API에 반영됩니다.",
	);
}

seedLeaderboard()
	.catch((error) => {
		console.error(
			"랭킹 더미 데이터 생성 실패:",
			error,
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await mongoose.disconnect();
	});
