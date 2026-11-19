import mongoose, { Schema, Document } from "mongoose";

export interface ChartPoint {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export interface StockChartCacheDocument extends Document {
	symbol: string;
	period: string;
	interval: string;
	points: ChartPoint[];
	source: string;
	timestampVersion: number;
	cumulativeVolume?: number | null;
	snapshotDate?: string;
	hasMore?: boolean;
	nextCursor?: number | null;
	fetchedAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

const ChartPointSchema = new Schema<ChartPoint>(
	{
		time: {
			type: Number,
			required: true,
		},
		open: {
			type: Number,
			required: true,
		},
		high: {
			type: Number,
			required: true,
		},
		low: {
			type: Number,
			required: true,
		},
		close: {
			type: Number,
			required: true,
		},
		volume: {
			type: Number,
			default: 0,
		},
	},
	{ _id: false },
);

const StockChartCacheSchema = new Schema<StockChartCacheDocument>(
	{
		symbol: {
			type: String,
			required: true,
			index: true,
		},
		period: {
			type: String,
			required: true,
		},
		interval: {
			type: String,
			required: true,
		},
		points: {
			type: [ChartPointSchema],
			default: [],
		},
		source: {
			type: String,
			default: "KIS",
		},
		timestampVersion: { type: Number, default: 2 },
		cumulativeVolume: { type: Number },
		snapshotDate: { type: String },
		hasMore: { type: Boolean },
		nextCursor: { type: Number },
		fetchedAt: {
			type: Date,
			required: true,
			index: true,
		},
	},
	{
		timestamps: true,
	},
);

StockChartCacheSchema.index(
	{ symbol: 1, period: 1, interval: 1 },
	{ unique: true },
);

export default mongoose.model<StockChartCacheDocument>(
	"StockChartCache",
	StockChartCacheSchema,
);
