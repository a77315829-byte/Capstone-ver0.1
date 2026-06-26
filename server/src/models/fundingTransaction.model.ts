import mongoose, {
	Document,
	Model,
	Schema,
} from "mongoose";

export type FundingMarket =
	| "KR"
	| "US";

export type FundingType =
	| "MANUAL_TOP_UP"
	| "SALARY_PLAN_MONTHLY";

export interface FundingTransactionDocument
	extends Document {
	userId: string;
	market: FundingMarket;
	type: FundingType;
	amount: number;
	currency: "KRW" | "USD";
	fundingKey?: string;
	referenceId?: string;
	periodKey?: string;
	createdAt: Date;
	updatedAt: Date;
}

const FundingTransactionSchema =
	new Schema<FundingTransactionDocument>(
		{
			userId: {
				type: String,
				required: true,
				index: true,
			},
			market: {
				type: String,
				enum: ["KR", "US"],
				required: true,
				index: true,
			},
			type: {
				type: String,
				enum: [
					"MANUAL_TOP_UP",
					"SALARY_PLAN_MONTHLY",
				],
				required: true,
				index: true,
			},
			amount: {
				type: Number,
				required: true,
				min: 0,
			},
			currency: {
				type: String,
				enum: ["KRW", "USD"],
				required: true,
			},
			fundingKey: {
				type: String,
				default: undefined,
			},
			referenceId: {
				type: String,
				default: undefined,
			},
			periodKey: {
				type: String,
				default: undefined,
			},
		},
		{
			timestamps: true,
		},
	);

FundingTransactionSchema.index(
	{
		userId: 1,
		market: 1,
		fundingKey: 1,
	},
	{
		unique: true,
		sparse: true,
	},
);

const FundingTransaction =
	(mongoose.models
		.FundingTransaction as Model<FundingTransactionDocument>) ||
	mongoose.model<FundingTransactionDocument>(
		"FundingTransaction",
		FundingTransactionSchema,
	);

export default FundingTransaction;
