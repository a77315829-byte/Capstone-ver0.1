import mongoose, {
	Document,
	Model,
	Schema,
} from "mongoose";

import type {
	UsExchangeCode,
	UsMarketName,
} from "../data/usStocks";

export interface UsHoldingDocument
	extends Document {
	userId: string;

	symbol: string;
	name: string;

	exchange: UsExchangeCode;
	market: UsMarketName;
	currency: "USD";

	quantity: number;
	reservedQuantity: number;

	avgPrice: number;
	totalBuyAmount: number;

	createdAt: Date;
	updatedAt: Date;
}

const UsHoldingSchema =
	new Schema<UsHoldingDocument>(
		{
			userId: {
				type: String,
				required: true,
				index: true,
			},
			symbol: {
				type: String,
				required: true,
				index: true,
				uppercase: true,
				trim: true,
			},
			name: {
				type: String,
				required: true,
				trim: true,
			},
			exchange: {
				type: String,
				enum: [
					"NAS",
					"NYS",
					"AMS",
				],
				required: true,
				index: true,
			},
			market: {
				type: String,
				enum: [
					"NASDAQ",
					"NYSE",
					"AMEX",
				],
				required: true,
			},
			currency: {
				type: String,
				enum: ["USD"],
				default: "USD",
				required: true,
			},
			quantity: {
				type: Number,
				required: true,
				default: 0,
			},
			reservedQuantity: {
				type: Number,
				required: true,
				default: 0,
			},
			avgPrice: {
				type: Number,
				required: true,
				default: 0,
			},
			totalBuyAmount: {
				type: Number,
				required: true,
				default: 0,
			},
		},
		{
			timestamps: true,
		},
	);

UsHoldingSchema.index(
	{
		userId: 1,
		exchange: 1,
		symbol: 1,
	},
	{
		unique: true,
	},
);

const UsHolding =
	(mongoose.models
		.UsHolding as Model<UsHoldingDocument>) ||
	mongoose.model<UsHoldingDocument>(
		"UsHolding",
		UsHoldingSchema,
	);

export default UsHolding;
