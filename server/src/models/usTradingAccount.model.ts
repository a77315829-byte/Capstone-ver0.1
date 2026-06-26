import mongoose, {
	Document,
	Model,
	Schema,
} from "mongoose";

export interface UsTradingAccountDocument
	extends Document {
	userId: string;

	cash: number;
	reservedCash: number;
	initialCash: number;
	totalDeposits: number;
	manualDeposits: number;

	currency: "USD";

	createdAt: Date;
	updatedAt: Date;
}

const UsTradingAccountSchema =
	new Schema<UsTradingAccountDocument>(
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
			currency: {
				type: String,
				enum: ["USD"],
				default: "USD",
				required: true,
			},
		},
		{
			timestamps: true,
		},
	);

const UsTradingAccount =
	(mongoose.models
		.UsTradingAccount as Model<UsTradingAccountDocument>) ||
	mongoose.model<UsTradingAccountDocument>(
		"UsTradingAccount",
		UsTradingAccountSchema,
	);

export default UsTradingAccount;
