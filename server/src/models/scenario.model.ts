import mongoose, { Schema, Document } from "mongoose";

export type ScenarioDecisionAction = "BUY" | "SELL" | "HOLD";

export interface ScenarioStock {
	symbol: string;
	name: string;
	price: number;
	changeRate: number;
	volume: number;
	sector?: string;
	reason?: string;
}

export interface ScenarioStep {
	stepNumber: number;
	title: string;
	dateLabel: string;
	marketInfo: {
		indexFlow: string;
		sectorFlow: string;
		volatility: string;
		volume: string;
	};
	stockInfo: {
		symbol: string;
		name: string;
		price: number;
		changeRate: number;
		volume: number;
	};
	marketStocks?: ScenarioStock[];
	newsCards: {
		title: string;
		summary: string;
		publishedAt: string;
		source: string;
	}[];
	eventInfo: string;
	hint: string;
	referenceDecision: ScenarioDecisionAction;
	referenceReason: string;
}

export interface ScenarioDocument extends Document {
	chapterId: number;
	chapterSlug: string;
	chapterTitle: string;
	chapterDescription: string;
	coreAttitude: string;
	learningGoal: string;
	chapterOrder: number;

	scenarioNo: string;
	scenarioSlug: string;
	title: string;
	eventPeriod: string;
	summary: string;
	background: string;
	difficulty: "쉬움" | "보통" | "어려움";
	estimatedMinutes: number;
	keywords: string[];
	learningPoints: string[];
	decisionOptions: ScenarioDecisionAction[];

	aiEvaluationPoints: string[];
	expectedFeedback: string;

	steps: ScenarioStep[];

	isPublished: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const NewsCardSchema = new Schema(
	{
		title: { type: String, required: true },
		summary: { type: String, required: true },
		publishedAt: { type: String, default: "" },
		source: { type: String, default: "Antitude 시나리오 DB" },
	},
	{ _id: false },
);

const ScenarioStockSchema = new Schema(
	{
		symbol: { type: String, required: true },
		name: { type: String, required: true },
		price: { type: Number, required: true },
		changeRate: { type: Number, required: true },
		volume: { type: Number, required: true },
		sector: { type: String, default: "" },
		reason: { type: String, default: "" },
	},
	{ _id: false },
);

const ScenarioStepSchema = new Schema(
	{
		stepNumber: { type: Number, required: true },
		title: { type: String, required: true },
		dateLabel: { type: String, default: "" },
		marketInfo: {
			indexFlow: { type: String, default: "" },
			sectorFlow: { type: String, default: "" },
			volatility: { type: String, default: "" },
			volume: { type: String, default: "" },
		},
		stockInfo: {
			symbol: { type: String, default: "005930" },
			name: { type: String, default: "삼성전자" },
			price: { type: Number, default: 0 },
			changeRate: { type: Number, default: 0 },
			volume: { type: Number, default: 0 },
		},
		marketStocks: {
			type: [ScenarioStockSchema],
			default: [],
		},
		newsCards: {
			type: [NewsCardSchema],
			default: [],
		},
		eventInfo: { type: String, default: "" },
		hint: { type: String, default: "" },
		referenceDecision: {
			type: String,
			enum: ["BUY", "SELL", "HOLD"],
			default: "HOLD",
		},
		referenceReason: { type: String, default: "" },
	},
	{ _id: false },
);

const ScenarioSchema = new Schema<ScenarioDocument>(
	{
		chapterId: {
			type: Number,
			required: true,
			index: true,
		},
		chapterSlug: {
			type: String,
			required: true,
			index: true,
		},
		chapterTitle: {
			type: String,
			required: true,
		},
		chapterDescription: {
			type: String,
			default: "",
		},
		coreAttitude: {
			type: String,
			default: "",
		},
		learningGoal: {
			type: String,
			default: "",
		},
		chapterOrder: {
			type: Number,
			required: true,
			index: true,
		},

		scenarioNo: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		scenarioSlug: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		title: {
			type: String,
			required: true,
		},
		eventPeriod: {
			type: String,
			default: "",
		},
		summary: {
			type: String,
			default: "",
		},
		background: {
			type: String,
			default: "",
		},
		difficulty: {
			type: String,
			enum: ["쉬움", "보통", "어려움"],
			default: "보통",
		},
		estimatedMinutes: {
			type: Number,
			default: 20,
		},
		keywords: {
			type: [String],
			default: [],
		},
		learningPoints: {
			type: [String],
			default: [],
		},
		decisionOptions: {
			type: [String],
			enum: ["BUY", "SELL", "HOLD"],
			default: ["BUY", "SELL", "HOLD"],
		},

		aiEvaluationPoints: {
			type: [String],
			default: [],
		},
		expectedFeedback: {
			type: String,
			default: "",
		},

		steps: {
			type: [ScenarioStepSchema],
			default: [],
		},

		isPublished: {
			type: Boolean,
			default: true,
			index: true,
		},
	},
	{
		timestamps: true,
	},
);

ScenarioSchema.index({ chapterId: 1, scenarioNo: 1 });
ScenarioSchema.index({ chapterSlug: 1, chapterOrder: 1 });

export default mongoose.model<ScenarioDocument>("Scenario", ScenarioSchema);
