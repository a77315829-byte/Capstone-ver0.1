import mongoose, {
	Document,
	Model,
	Schema,
} from "mongoose";

import type {
	UsExchangeCode,
	UsMarketName,
} from "../data/usStocks";

export type UsTradeSide =
	| "BUY"
	| "SELL";

export type UsTradeOrderType =
	| "MARKET"
	| "LIMIT";

export type UsTradeOrderStatus =
	| "PENDING"
	| "FILLED"
	| "CANCELED"
	| "REJECTED";

export interface UsTradeOrderDocument
	extends Document {
	userId: string;

	symbol: string;
	name: string;

	exchange: UsExchangeCode;
	market: UsMarketName;
	currency: "USD";

	side: UsTradeSide;
	orderType: UsTradeOrderType;
	status: UsTradeOrderStatus;

	quantity: number;
	filledQuantity: number;

	orderPrice: number;
	limitPrice?: number | null;
	executedPrice?: number | null;

	reservedAmount: number;
	reservedQuantity: number;

	realizedProfit: number;
	rejectReason?: string;

	createdAt: Date;
	updatedAt: Date;

	executedAt?: Date | null;
	canceledAt?: Date | null;
}

const UsTradeOrderSchema =
	new Schema<UsTradeOrderDocument>(
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
			side: {
				type: String,
				enum: ["BUY", "SELL"],
				required: true,
			},
			orderType: {
				type: String,
				enum: [
					"MARKET",
					"LIMIT",
				],
				required: true,
			},
			status: {
				type: String,
				enum: [
					"PENDING",
					"FILLED",
					"CANCELED",
					"REJECTED",
				],
				required: true,
				default: "PENDING",
				index: true,
			},
			quantity: {
				type: Number,
				required: true,
			},
			filledQuantity: {
				type: Number,
				default: 0,
			},
			orderPrice: {
				type: Number,
				default: 0,
			},
			limitPrice: {
				type: Number,
				default: null,
			},
			executedPrice: {
				type: Number,
				default: null,
			},
			reservedAmount: {
				type: Number,
				default: 0,
			},
			reservedQuantity: {
				type: Number,
				default: 0,
			},
			realizedProfit: {
				type: Number,
				default: 0,
			},
			rejectReason: {
				type: String,
				default: "",
			},
			executedAt: {
				type: Date,
				default: null,
			},
			canceledAt: {
				type: Date,
				default: null,
			},
		},
		{
			timestamps: true,
		},
	);

UsTradeOrderSchema.index({
	userId: 1,
	createdAt: -1,
});

UsTradeOrderSchema.index({
	userId: 1,
	status: 1,
});

UsTradeOrderSchema.index({
	exchange: 1,
	symbol: 1,
	status: 1,
});

const UsTradeOrder =
	(mongoose.models
		.UsTradeOrder as Model<UsTradeOrderDocument>) ||
	mongoose.model<UsTradeOrderDocument>(
		"UsTradeOrder",
		UsTradeOrderSchema,
	);

export default UsTradeOrder;
