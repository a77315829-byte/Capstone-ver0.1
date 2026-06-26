import mongoose, { Schema, Document } from "mongoose";

export interface TradingAccountDocument extends Document {
	userId: string;
	cash: number;
	reservedCash: number;
	initialCash: number;
	totalDeposits: number;
	manualDeposits: number;
	salaryPlanDeposits: number;
	salaryPlanFundingEnabled: boolean;
	salaryPlanFundingAmount: number;
	salaryPlanId?: string;
	lastSalaryFundingPeriod?: string;
	currency: string;
	createdAt: Date;
	updatedAt: Date;
}

const TradingAccountSchema = new Schema<TradingAccountDocument>(
	{
		userId: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		cash: {
			type: Number,
			required: true,
			default: 0,
		},
		reservedCash: {
			type: Number,
			required: true,
			default: 0,
		},
		initialCash: {
			type: Number,
			required: true,
			default: 0,
		},
		totalDeposits: {
			type: Number,
			required: true,
			default: 0,
		},
		manualDeposits: {
			type: Number,
			required: true,
			default: 0,
		},
		salaryPlanDeposits: {
			type: Number,
			required: true,
			default: 0,
		},
		salaryPlanFundingEnabled: {
			type: Boolean,
			required: true,
			default: false,
		},
		salaryPlanFundingAmount: {
			type: Number,
			required: true,
			default: 0,
		},
		salaryPlanId: {
			type: String,
			default: undefined,
		},
		lastSalaryFundingPeriod: {
			type: String,
			default: undefined,
		},
		currency: {
			type: String,
			default: "KRW",
		},
	},
	{
		timestamps: true,
	},
);

export default mongoose.model<TradingAccountDocument>(
	"TradingAccount",
	TradingAccountSchema,
);