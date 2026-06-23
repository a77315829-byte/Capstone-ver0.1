import mongoose, {
	Document,
	Model,
	Schema,
} from "mongoose";

import type {
	MilitaryBranch,
} from "./militaryProfile.model";

export interface EquityHistoryPoint {
	date: string;
	equity: number;
}

export interface IMonthlyTradingPerformance
	extends Document {
	month: string;
	userId: string;
	branch: MilitaryBranch;
	branchName: string;
	nickname: string;
	authorCode: string;
	market: "DOMESTIC";

	monthStartEquity: number;
	currentEquity: number;
	returnRate: number;
	maxDrawdown: number;
	dailyVolatility: number;

	filledTradeCount: number;
	activeTradingDays: number;
	reasonEntryCount: number;
	isEligible: boolean;

	returnScore: number;
	drawdownScore: number;
	consistencyScore: number;
	activityScore: number;
	totalScore: number;

	branchRank: number | null;
	overallRank: number | null;
	badge:
		| "투자왕"
		| "수익왕"
		| "안정왕"
		| null;

	equityHistory: EquityHistoryPoint[];
	createdAt: Date;
	updatedAt: Date;
}

const EquityHistorySchema = new Schema<EquityHistoryPoint>(
	{
		date: {
			type: String,
			required: true,
		},
		equity: {
			type: Number,
			required: true,
			min: 0,
		},
	},
	{
		_id: false,
	},
);

const MonthlyTradingPerformanceSchema =
	new Schema<IMonthlyTradingPerformance>(
		{
			month: {
				type: String,
				required: true,
				index: true,
			},
			userId: {
				type: String,
				required: true,
				index: true,
			},
			branch: {
				type: String,
				enum: [
					"ARMY",
					"NAVY",
					"AIR_FORCE",
					"MARINE",
					"SOCIAL_SERVICE",
					"ETC",
				],
				required: true,
				index: true,
			},
			branchName: {
				type: String,
				required: true,
			},
			nickname: {
				type: String,
				default: "ㅇㅇ",
				required: true,
			},
			authorCode: {
				type: String,
				required: true,
			},
			market: {
				type: String,
				enum: ["DOMESTIC"],
				default: "DOMESTIC",
				required: true,
			},
			monthStartEquity: {
				type: Number,
				required: true,
				min: 0,
			},
			currentEquity: {
				type: Number,
				required: true,
				min: 0,
			},
			returnRate: {
				type: Number,
				default: 0,
			},
			maxDrawdown: {
				type: Number,
				default: 0,
			},
			dailyVolatility: {
				type: Number,
				default: 0,
			},
			filledTradeCount: {
				type: Number,
				default: 0,
				min: 0,
			},
			activeTradingDays: {
				type: Number,
				default: 0,
				min: 0,
			},
			reasonEntryCount: {
				type: Number,
				default: 0,
				min: 0,
			},
			isEligible: {
				type: Boolean,
				default: false,
				index: true,
			},
			returnScore: {
				type: Number,
				default: 0,
			},
			drawdownScore: {
				type: Number,
				default: 0,
			},
			consistencyScore: {
				type: Number,
				default: 0,
			},
			activityScore: {
				type: Number,
				default: 0,
			},
			totalScore: {
				type: Number,
				default: 0,
				index: true,
			},
			branchRank: {
				type: Number,
				default: null,
			},
			overallRank: {
				type: Number,
				default: null,
			},
			badge: {
				type: String,
				enum: [
					"투자왕",
					"수익왕",
					"안정왕",
					null,
				],
				default: null,
			},
			equityHistory: {
				type: [EquityHistorySchema],
				default: [],
			},
		},
		{
			timestamps: true,
		},
	);

MonthlyTradingPerformanceSchema.index(
	{
		month: 1,
		userId: 1,
		market: 1,
	},
	{
		unique: true,
	},
);

MonthlyTradingPerformanceSchema.index({
	month: 1,
	branch: 1,
	branchRank: 1,
});

const MonthlyTradingPerformance =
	(mongoose.models
		.MonthlyTradingPerformance as Model<IMonthlyTradingPerformance>) ||
	mongoose.model<IMonthlyTradingPerformance>(
		"MonthlyTradingPerformance",
		MonthlyTradingPerformanceSchema,
	);

export default MonthlyTradingPerformance;
